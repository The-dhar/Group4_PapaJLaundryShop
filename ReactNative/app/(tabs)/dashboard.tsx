import { useAuth } from "@/contexts/AuthContext";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_URL } from "../../config/api";

/** Backend expects `Y-m-d` for `date_from` / `date_to` on GET /transactions */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [yy, mm, dd] = ymd.split("-").map((v) => parseInt(v, 10));
  return new Date(yy, mm - 1, dd);
}

function defaultRangeStartYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return toYmd(d);
}

function eachYmdInRange(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  const cur = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(toYmd(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function formatRangeSummary(startYmd: string, endYmd: string): string {
  const a = parseYmd(startYmd);
  const b = parseYmd(endYmd);
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.toLocaleDateString("en-US", { ...o, year: "numeric" })} – ${b.toLocaleDateString("en-US", { ...o, year: "numeric" })}`;
  }
  return `${a.toLocaleDateString("en-US", o)} – ${b.toLocaleDateString("en-US", o)}, ${b.getFullYear()}`;
}

/** Monday–Sunday week containing `d` (matches common business-week charts). */
function mondayOfCalendarWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatBranchLabel(name: unknown): string {
  return String(name || "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([.\/,:;!?])(\S)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

type PeriodPreset = "weekly" | "monthly" | "yearly" | "range";

function rangeForPreset(preset: Exclude<PeriodPreset, "range">): [string, string] {
  const now = new Date();
  if (preset === "weekly") {
    const mon = mondayOfCalendarWeek(now);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return [toYmd(mon), toYmd(sun)];
  }
  if (preset === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [toYmd(start), toYmd(end)];
  }
  const y = now.getFullYear();
  return [`${y}-01-01`, `${y}-12-31`];
}

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const chartPadding = isSmallScreen ? 40 : 60;
const chartWidth = screenWidth - chartPadding;

// Responsive chart width helper: ensures enough horizontal space for x-axis labels on small screens
const getResponsiveChartWidth = (labels: string[]) => {
  const basePadding = 100;
  const estimated = labels.reduce((sum, label) => {
    const len = label.length;
    const widthPerChar = isSmallScreen ? 10 : 8;
    return sum + Math.max(len * widthPerChar, isSmallScreen ? 50 : 80);
  }, 0);
  return Math.max(chartWidth, estimated + basePadding);
};

export default function DashboardAnalytics() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("range");
  const [rangeFrom, setRangeFrom] = useState<string>(defaultRangeStartYmd);
  const [rangeTo, setRangeTo] = useState<string>(() => toYmd(new Date()));
  const [pickerTarget, setPickerTarget] = useState<null | "from" | "to">(null);
  const [iosPickerDraft, setIosPickerDraft] = useState<Date>(() => new Date());

  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    value: 0,
    visible: false
  });

  // Tooltip state for branch comparison chart
  const [branchTooltip, setBranchTooltip] = useState({
    x: 0,
    y: 0,
    value: 0,
    label: '',
    visible: false,
  });
  const [branchPerfTooltip, setBranchPerfTooltip] = useState({
    x: 0,
    y: 0,
    value: 0,
    label: "",
    visible: false,
  });

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { token, logout } = useAuth();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [issueReports, setIssueReports] = useState<any[]>([]);
  const [disputeChartType, setDisputeChartType] = useState<"refund" | "backjob">("refund");
  const [disputeTooltip, setDisputeTooltip] = useState({
    x: 0,
    y: 0,
    value: 0,
    label: "",
    visible: false,
  });

  const loadDashboard = useCallback(async () => {
    try {
      if (!token) return;

      let from = rangeFrom;
      let to = rangeTo;
      if (from > to) {
        const t = from;
        from = to;
        to = t;
      }

      const qs = new URLSearchParams({
        include_archived: "1",
        date_from: from,
        date_to: to,
      });

      const [txRes, brRes, issueRes] = await Promise.all([
        fetch(`${API_URL}/transactions?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
        fetch(`${API_URL}/branches`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
        fetch(`${API_URL}/issue-reports`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
      ]);

      const txData = txRes.ok ? await txRes.json() : [];
      const brData = brRes.ok ? await brRes.json() : [];
      const issueData = issueRes.ok ? await issueRes.json() : [];

      setTransactions(Array.isArray(txData) ? txData : []);
      setBranches(Array.isArray(brData) ? brData : []);
      setIssueReports(Array.isArray(issueData) ? issueData : []);
    } catch (error) {
      console.log(error);
    }
  }, [rangeFrom, rangeTo, token]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  // Ensure charts refresh immediately when date range changes.
  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const dailyRevenue = useMemo(() => {
    const days = eachYmdInRange(rangeFrom <= rangeTo ? rangeFrom : rangeTo, rangeFrom <= rangeTo ? rangeTo : rangeFrom);
    const labels = days.map((day) => {
      const d = parseYmd(day);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
    const values = days.map((day) =>
      transactions.reduce((sum, txn) => {
        if (!txn.created_at) return sum;
        if (toYmd(new Date(txn.created_at)) === day) return sum + Number(txn.amount || 0);
        return sum;
      }, 0)
    );
    return { labels, values };
  }, [transactions, rangeFrom, rangeTo]);

  const currentLabels = dailyRevenue.labels;
  const currentRevenue = dailyRevenue.values;

  const branchNames = branches.map((b) => formatBranchLabel(b.name));
  const currentBranchLabels = branchNames.length > 0 ? branchNames : ["No Branches"];

  const currentBranchValues = useMemo(() => {
    const totals = new Map<number, number>();
    branches.forEach((branch) => totals.set(Number(branch.id), 0));
    transactions.forEach((txn) => {
      const branchId = Number(txn.branch_id);
      if (!totals.has(branchId)) return;
      totals.set(branchId, (totals.get(branchId) || 0) + Number(txn.amount || 0));
    });
    if (branches.length === 0) return [0];
    return branches.map((branch) => Number((totals.get(Number(branch.id)) || 0).toFixed(2)));
  }, [transactions, branches]);

  const revenueChartKey = useMemo(
    () => `rev-${rangeFrom}-${rangeTo}-${currentRevenue.join(",")}`,
    [rangeFrom, rangeTo, currentRevenue]
  );
  const branchComparisonChartKey = useMemo(
    () => `brc-${rangeFrom}-${rangeTo}-${currentBranchValues.join(",")}`,
    [rangeFrom, rangeTo, currentBranchValues]
  );
  const branchPerformanceChartKey = useMemo(
    () => `brp-${rangeFrom}-${rangeTo}-${currentBranchValues.join(",")}`,
    [rangeFrom, rangeTo, currentBranchValues]
  );

  // Compute responsive chart widths so x-axis labels fit on narrow screens
  const revenueChartWidth = getResponsiveChartWidth(currentLabels);
  const branchComparisonChartWidth = getResponsiveChartWidth(currentBranchLabels);
  const branchPerformanceChartWidth = getResponsiveChartWidth(currentBranchLabels);

  const filteredResolvedDisputes = useMemo(() => {
    const from = parseYmd(rangeFrom <= rangeTo ? rangeFrom : rangeTo);
    const to = parseYmd(rangeFrom <= rangeTo ? rangeTo : rangeFrom);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const resolutionType = disputeChartType === "refund" ? "refund" : "replacement";
    return issueReports.filter((row) => {
      if (String(row?.resolution_type || "").toLowerCase() !== resolutionType) return false;
      const dt = new Date(row?.resolved_at || row?.updated_at || 0);
      if (Number.isNaN(dt.getTime())) return false;
      return dt >= from && dt <= to;
    });
  }, [issueReports, rangeFrom, rangeTo, disputeChartType]);

  const disputeSeries = useMemo(() => {
    const amountFromReport = (row: any) => {
      const n = Number(row?.transaction?.amount);
      return Number.isFinite(n) ? n : 0;
    };

    if (periodPreset === "weekly") {
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const start = mondayOfCalendarWeek(parseYmd(rangeTo));
      const rows = labels.map((name, idx) => {
        const d = new Date(start);
        d.setDate(start.getDate() + idx);
        d.setHours(0, 0, 0, 0);
        return { name, key: toYmd(d), amount: 0 };
      });
      filteredResolvedDisputes.forEach((r) => {
        const dt = new Date(r?.resolved_at || r?.updated_at || 0);
        if (Number.isNaN(dt.getTime())) return;
        const key = toYmd(dt);
        const row = rows.find((x) => x.key === key);
        if (row) row.amount += amountFromReport(r);
      });
      return { labels: rows.map((r) => r.name), values: rows.map((r) => Number(r.amount.toFixed(2))) };
    }

    if (periodPreset === "monthly") {
      const rows = [
        { name: "Week 1", amount: 0 },
        { name: "Week 2", amount: 0 },
        { name: "Week 3", amount: 0 },
        { name: "Week 4", amount: 0 },
      ];
      filteredResolvedDisputes.forEach((r) => {
        const dt = new Date(r?.resolved_at || r?.updated_at || 0);
        if (Number.isNaN(dt.getTime())) return;
        const idx = Math.min(3, Math.floor((dt.getDate() - 1) / 7));
        rows[idx].amount += amountFromReport(r);
      });
      return { labels: rows.map((r) => r.name), values: rows.map((r) => Number(r.amount.toFixed(2))) };
    }

    if (periodPreset === "yearly") {
      const rows = [
        { name: "Jan", amount: 0 }, { name: "Feb", amount: 0 }, { name: "Mar", amount: 0 },
        { name: "Apr", amount: 0 }, { name: "May", amount: 0 }, { name: "Jun", amount: 0 },
        { name: "Jul", amount: 0 }, { name: "Aug", amount: 0 }, { name: "Sep", amount: 0 },
        { name: "Oct", amount: 0 }, { name: "Nov", amount: 0 }, { name: "Dec", amount: 0 },
      ];
      filteredResolvedDisputes.forEach((r) => {
        const dt = new Date(r?.resolved_at || r?.updated_at || 0);
        if (Number.isNaN(dt.getTime())) return;
        rows[dt.getMonth()].amount += amountFromReport(r);
      });
      return { labels: rows.map((r) => r.name), values: rows.map((r) => Number(r.amount.toFixed(2))) };
    }

    const days = eachYmdInRange(rangeFrom <= rangeTo ? rangeFrom : rangeTo, rangeFrom <= rangeTo ? rangeTo : rangeFrom);
    const rows = days.map((day) => ({ day, amount: 0 }));
    filteredResolvedDisputes.forEach((r) => {
      const dt = new Date(r?.resolved_at || r?.updated_at || 0);
      if (Number.isNaN(dt.getTime())) return;
      const key = toYmd(dt);
      const row = rows.find((x) => x.day === key);
      if (row) row.amount += amountFromReport(r);
    });
    return {
      labels: rows.map((r) => parseYmd(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
      values: rows.map((r) => Number(r.amount.toFixed(2))),
    };
  }, [filteredResolvedDisputes, periodPreset, rangeFrom, rangeTo]);

  const disputeChartWidth = getResponsiveChartWidth(disputeSeries.labels);
  const disputeKpiAmount = useMemo(
    () => filteredResolvedDisputes.reduce((sum, r) => sum + Number(r?.transaction?.amount || 0), 0),
    [filteredResolvedDisputes]
  );
  const disputeKpiCount = filteredResolvedDisputes.length;
  
  const totalSales = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOrders = transactions.length;
  const salesTrend = currentRevenue.length ? Math.round(currentRevenue[currentRevenue.length - 1] || 0) : 0;
  const ordersTrend = Math.max(0, transactions.filter((t) => String(t.payment_status) === "paid").length);
  
  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };
  
  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace("/(openingApps)/login");
  };

  const applyPeriodPreset = (p: PeriodPreset) => {
    setPeriodPreset(p);
    if (p === "range") return;
    const [from, to] = rangeForPreset(p);
    setRangeFrom(from);
    setRangeTo(to);
  };

  const applyPickedDate = (d: Date, target: "from" | "to") => {
    setPeriodPreset("range");
    const y = toYmd(d);
    let nf = target === "from" ? y : rangeFrom;
    let nt = target === "to" ? y : rangeTo;
    if (nf > nt) {
      const s = nf;
      nf = nt;
      nt = s;
    }
    setRangeFrom(nf);
    setRangeTo(nt);
  };

  const openDatePicker = (target: "from" | "to") => {
    setPickerTarget(target);
    setIosPickerDraft(parseYmd(target === "from" ? rangeFrom : rangeTo));
  };

  const onAndroidPickerChange = (event: { type?: string }, date?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!target || event?.type === "dismissed" || !date) return;
    applyPickedDate(date, target);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* LEFT SIDE: Dashboard title + underline */}
        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Dashboard</Text>
          <View style={styles.headerAccent} />
        </View>

        {/* RIGHT SIDE: Profile button */}
        <View style={styles.profileContainer}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setOpen(!open)}
          >
            <Ionicons name="person-circle-outline" size={30} color="#1e293b" />
          </TouchableOpacity>

          {open && (
            <View style={styles.dropdown}>
              <TouchableOpacity style={styles.dropdownItem} onPress={handleProfile}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemLast]} onPress={handleLogout}>
                <Text style={styles.dropdownText}>Logout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.dateRangeCard}>
            <Text style={styles.dateRangeTitle}>Date range</Text>
            <View style={styles.presetRow}>
              {(
                [
                  ["weekly", "Weekly"],
                  ["monthly", "Monthly"],
                  ["yearly", "Yearly"],
                  ["range", "Range"],
                ] as const
              ).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.presetChip, periodPreset === key && styles.presetChipActive]}
                  onPress={() => applyPeriodPreset(key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.presetChipText, periodPreset === key && styles.presetChipTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.dateRangeSummary}>{formatRangeSummary(rangeFrom, rangeTo)}</Text>
            <View style={styles.dateRangeRow}>
              <TouchableOpacity style={styles.dateChip} onPress={() => openDatePicker("from")} activeOpacity={0.85}>
                <Text style={styles.dateChipLabel}>From</Text>
                <Text style={styles.dateChipValue}>
                  {parseYmd(rangeFrom).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateChip} onPress={() => openDatePicker("to")} activeOpacity={0.85}>
                <Text style={styles.dateChipLabel}>To</Text>
                <Text style={styles.dateChipValue}>
                  {parseYmd(rangeTo).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* CARDS */}
        <View style={styles.cardRow}>
          {/* Total Sales Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Sales</Text>
            <Text style={styles.cardValue}>
              ₱{totalSales.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </Text>
            <View style={styles.cardTrend}>
              <Ionicons name="trending-up" size={16} color="#22c55e" />
              <Text style={styles.trendText}>
                +{salesTrend.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Total Orders Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Orders</Text>
            <Text style={styles.cardValue}>
              {totalOrders.toLocaleString()}
            </Text>
            <View style={styles.cardTrend}>
              <Ionicons name="trending-up" size={16} color="#22c55e" />
              <Text style={styles.trendText}>
                +{ordersTrend.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>


        {pickerTarget && Platform.OS === "android" ? (
          <DateTimePicker
            value={parseYmd(pickerTarget === "from" ? rangeFrom : rangeTo)}
            mode="date"
            display="default"
            onChange={onAndroidPickerChange}
          />
        ) : null}

        {pickerTarget && Platform.OS === "ios" ? (
          <Modal transparent animationType="fade" visible>
            <View style={styles.iosPickerOverlay}>
              <View style={styles.iosPickerSheet}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setPickerTarget(null)}>
                    <Text style={styles.iosPickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (pickerTarget) applyPickedDate(iosPickerDraft, pickerTarget);
                      setPickerTarget(null);
                    }}
                  >
                    <Text style={styles.iosPickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={iosPickerDraft}
                  mode="date"
                  display="spinner"
                  onChange={(_, d) => d && setIosPickerDraft(d)}
                  style={{ alignSelf: "stretch" }}
                />
              </View>
            </View>
          </Modal>
        ) : null}

        {/* REVENUE */}
        <View style={styles.chartBox}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Revenue</Text>
          </View>
          <View style={{ alignItems: "center" }}>

            {/* Tooltip */}
            {tooltipPos.visible && (
              <View
                style={{
                  position: "absolute",
                  left: tooltipPos.x - 40,
                  top: tooltipPos.y - 50,
                  backgroundColor: "#4188faff",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  zIndex: 20,
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  ₱{Number(tooltipPos.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            {/* Pressable wrapping the chart - responsive/horizontally scrollable */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
              <Pressable
                onPressIn={() => setTooltipPos(prev => ({ ...prev, visible: true }))}
                onPressOut={() => setTooltipPos(prev => ({ ...prev, visible: false }))}
                style={{ width: revenueChartWidth + 50 }}
              >
                <LineChart
                  key={revenueChartKey}
                  data={{
                    labels: currentLabels,
                    datasets: [{ data: currentRevenue }],
                  }}
                  width={revenueChartWidth + 50}
                  height={200}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: () => `rgba(59, 130, 246, 1)`,
                    labelColor: () => `rgba(30, 41, 59, 1)`,
                    propsForLabels: {
                      fontSize: isSmallScreen ? 10 : 12,
                    },
                    formatYLabel: (y: string) => `₱${Number(y).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    propsForBackgroundLines: {
                      stroke: "#00000051",
                      strokeWidth: 1,
                    },
                  }}
                  bezier
                  style={{ marginLeft: 20, borderRadius: 20 }}
                  formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  onDataPointClick={(data) => {
                    setTooltipPos({
                      x: data.x,
                      y: data.y,
                      value: data.value,
                      visible: true,
                    });
                  }}
                />
              </Pressable>
            </ScrollView>
          </View>
        </View>
          {/* BRANCH REVENUE COMPARISON */}
          <View style={styles.chartBox}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Branch Revenue Comparison</Text>
            </View>
            <View style={{ alignItems: "center" }}>

              {/* Branch Tooltip */}
              {branchTooltip.visible && (
                <View
                  style={{
                    position: "absolute",
                    left: branchTooltip.x - 40,
                    top: branchTooltip.y - 50,
                    backgroundColor: "#4188faff",
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    zIndex: 20,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    {branchTooltip.label}: ₱{Number(branchTooltip.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', marginLeft: 0 }}>
                <Pressable
                  onPressIn={() => setBranchTooltip(prev => ({ ...prev, visible: true }))}
                  onPressOut={() => setBranchTooltip(prev => ({ ...prev, visible: false }))}
                  style={{ width: branchComparisonChartWidth + 50 }}
                >
                  <LineChart
                    key={branchComparisonChartKey}
                    data={{
                      labels: currentBranchLabels,
                      datasets: [{ data: currentBranchValues }],
                    }}
                    width={branchComparisonChartWidth + 50}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 0,
                      color: () => `rgba(59, 130, 246, 1)`,
                      labelColor: () => `rgba(30, 41, 59, 1)`,
                      propsForLabels: {
                        fontSize: isSmallScreen ? 10 : 12,
                      },
                      propsForBackgroundLines: {
                        stroke: "#00000051",
                        strokeWidth: 1,
                      },
                    }}
                    formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    bezier
                    verticalLabelRotation={0}
                    fromZero={true}
                    style={{ marginLeft: 16, borderRadius: 12, marginTop: 8 }}
                    onDataPointClick={(data) => {
                      setBranchTooltip({
                        x: data.x,
                        y: data.y,
                        value: data.value,
                        label: currentBranchLabels[data.index],
                        visible: true,
                      });
                    }}
                  />
                </Pressable>
              </ScrollView>
            </View>
          </View>
        {/* BRANCH PERFORMANCE - Separate Container */}
        <View style={styles.branchPerformanceBox}>
          <View style={styles.branchPerformanceHeader}>
            <Text style={styles.branchPerformanceTitle}>Branch Performance</Text>
          </View>
          <View style={styles.barChartWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', marginLeft: 0 }}>
              <LineChart
                key={branchPerformanceChartKey}
                data={{
                  labels: currentBranchLabels,
                  datasets: [{ data: currentBranchValues }]
                }}
                width={branchPerformanceChartWidth + 50}
                height={isSmallScreen ? 260 : 300}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
                  propsForLabels: {
                    fontSize: isSmallScreen ? 10 : 12,
                  },
                  barPercentage: currentBranchLabels.length > 10 ? 0.4 : 0.6,
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    stroke: "#e2e8f0",
                    strokeWidth: 1,
                  },
                }}
                formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                bezier
                style={{ marginLeft: 16, borderRadius: 12, marginTop: 10 }}
                verticalLabelRotation={0}
                fromZero={true}
                segments={4}
                onDataPointClick={(data) => {
                  setBranchPerfTooltip({
                    x: data.x,
                    y: data.y,
                    value: data.value,
                    label: currentBranchLabels[data.index],
                    visible: true,
                  });
                }}
              />
            </ScrollView>
            {branchPerfTooltip.visible && (
              <View
                style={{
                  position: "absolute",
                  left: branchPerfTooltip.x - 40,
                  top: branchPerfTooltip.y - 50,
                  backgroundColor: "#4188faff",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  zIndex: 20,
                }}
              >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                  {branchPerfTooltip.label}: ₱{Number(branchPerfTooltip.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* OVERALL DISPUTES (ALL BRANCHES) */}
        <View style={styles.chartBox}>
          <View style={styles.disputeHeaderRow}>
            <Text style={styles.chartTitle}>Disputes</Text>
            <View style={styles.disputeTypeRow}>
              <TouchableOpacity
                style={[styles.disputeTypeChip, disputeChartType === "refund" && styles.disputeTypeChipActive]}
                onPress={() => setDisputeChartType("refund")}
                activeOpacity={0.85}
              >
                <Text style={[styles.disputeTypeChipText, disputeChartType === "refund" && styles.disputeTypeChipTextActive]}>
                  Refund
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.disputeTypeChip, disputeChartType === "backjob" && styles.disputeTypeChipActive]}
                onPress={() => setDisputeChartType("backjob")}
                activeOpacity={0.85}
              >
                <Text style={[styles.disputeTypeChipText, disputeChartType === "backjob" && styles.disputeTypeChipTextActive]}>
                  Backjob
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.disputeKpiRow}>
            <View style={styles.disputeKpiCard}>
              <Text style={styles.disputeKpiLabel}>
                {disputeChartType === "refund" ? "Total Refund Amount (Est.)" : "Total Backjob Amount (Est.)"}
              </Text>
              <Text style={styles.disputeKpiValue}>
                ₱{disputeKpiAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.disputeKpiCard}>
              <Text style={styles.disputeKpiLabel}>
                {disputeChartType === "refund" ? "Refund Cases Resolved" : "Backjob Cases Resolved"}
              </Text>
              <Text style={styles.disputeKpiValue}>{disputeKpiCount.toLocaleString()}</Text>
            </View>
          </View>

          <View style={{ alignItems: "center" }}>
            {disputeTooltip.visible && (
              <View
                style={{
                  position: "absolute",
                  left: disputeTooltip.x - 40,
                  top: disputeTooltip.y - 50,
                  backgroundColor: disputeChartType === "refund" ? "#0d9488" : "#7c3aed",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  zIndex: 20,
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {disputeTooltip.label}: ₱{Number(disputeTooltip.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center" }}>
              <Pressable
                onPressOut={() => setDisputeTooltip((prev) => ({ ...prev, visible: false }))}
                style={{ width: disputeChartWidth + 50 }}
              >
                <LineChart
                  key={`disp-${periodPreset}-${disputeChartType}-${disputeSeries.values.join(",")}`}
                  data={{
                    labels: disputeSeries.labels,
                    datasets: [{ data: disputeSeries.values.length ? disputeSeries.values : [0] }],
                  }}
                  width={disputeChartWidth + 50}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: () => (disputeChartType === "refund" ? "rgba(13,148,136,1)" : "rgba(124,58,237,1)"),
                    labelColor: () => `rgba(30, 41, 59, 1)`,
                    propsForLabels: {
                      fontSize: isSmallScreen ? 10 : 12,
                    },
                    propsForBackgroundLines: {
                      stroke: "#00000051",
                      strokeWidth: 1,
                    },
                  }}
                  formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  bezier
                  fromZero
                  style={{ marginLeft: 16, borderRadius: 12, marginTop: 8 }}
                  onDataPointClick={(data) => {
                    setDisputeTooltip({
                      x: data.x,
                      y: data.y,
                      value: data.value,
                      label: disputeSeries.labels[data.index] || "",
                      visible: true,
                    });
                  }}
                />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000, // Added high z-index to header
  },
  headerText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  headerAccent: {
    position: "absolute",
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  headerLeft: {
    flexDirection: "column",
    position: "relative",
  },
  profileContainer: {
    position: "relative",
    zIndex: 2000, // Higher z-index for profile container
  },
  profileBtn: {
    padding: 6,
  },
  cardRow: {
    flexDirection: "row",
    padding: 20,
    gap: 16,
    zIndex: 1, // Lower z-index for cards
  },
  card: {
    flex: 1,
    padding: 24,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
    letterSpacing: -0.5,
    flexShrink: 1,
    flexWrap: 'nowrap',
  },
  cardTrend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  trendText: {
    marginLeft: 6,
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "700",
  },
  dateRangeCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 8,
    padding: 18,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateRangeTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  presetChipActive: {
    backgroundColor: "#3b82f6",
  },
  presetChipText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  presetChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  dateRangeSummary: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 14,
  },
  dateRangeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateChip: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dateChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  dateChipValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  iosPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  iosPickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  iosPickerCancel: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
  },
  iosPickerDone: {
    fontSize: 16,
    color: "#3b82f6",
    fontWeight: "700",
  },
  chartBox: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 10,
    paddingLeft: 25,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: "visible", // allow axis labels to render outside rounded container
  },
  chartHeader: {
    marginBottom: 16,
  },
  disputeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 8,
    gap: 10,
  },
  disputeTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  disputeTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  disputeTypeChipActive: {
    backgroundColor: "#0f172a",
  },
  disputeTypeChipText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  disputeTypeChipTextActive: {
    color: "#ffffff",
  },
  disputeKpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  disputeKpiCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  disputeKpiLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 6,
  },
  disputeKpiValue: {
    fontSize: 22,
    color: "#0f172a",
    fontWeight: "800",
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  branchPerformanceBox: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 16,
    paddingLeft: 25,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: "visible",
  },
  branchPerformanceHeader: {
    marginBottom: 16,
  },
  branchPerformanceTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  barChartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  barChart: {
    borderRadius: 12,
    marginTop: 10,
  },
  dropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 999, // Very high elevation for dropdown
    minWidth: 120,
    zIndex: 9999, // Extremely high z-index
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownItemLast: {
    borderBottomWidth: 0, // Remove border from last item
  },
  dropdownText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "600",
  },
});