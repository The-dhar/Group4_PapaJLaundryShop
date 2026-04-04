import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

function eachYmdInRange(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  const cur = parseYmd(fromYmd);
  const end = parseYmd(toYmd);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(toYmd(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function formatRangeSummary(fromYmd: string, toYmd: string): string {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.toLocaleDateString("en-US", { ...o, year: "numeric" })} – ${b.toLocaleDateString("en-US", { ...o, year: "numeric" })}`;
  }
  return `${a.toLocaleDateString("en-US", o)} – ${b.toLocaleDateString("en-US", o)}, ${b.getFullYear()}`;
}

// BarChart typing workaround to allow runtime onDataPointClick
const AnyBarChart: any = BarChart;

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const chartPadding = isSmallScreen ? 40 : 60;
const chartWidth = screenWidth - chartPadding;

// Responsive chart width helper: ensures enough horizontal space for x-axis labels on small screens
const getResponsiveChartWidth = (labels: string[]) => {
  const perLabel = isSmallScreen ? 36 : 56; // pixels per label
  const computed = labels.length * perLabel + 80; // extra padding
  return Math.max(chartWidth, computed);
};

export default function DashboardAnalytics() {
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

  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const loadDashboard = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
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

      const [txRes, brRes] = await Promise.all([
        fetch(`${API_URL}/transactions?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
        fetch(`${API_URL}/branches`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
      ]);

      const txData = txRes.ok ? await txRes.json() : [];
      const brData = brRes.ok ? await brRes.json() : [];

      setTransactions(Array.isArray(txData) ? txData : []);
      setBranches(Array.isArray(brData) ? brData : []);
    } catch (error) {
      console.log(error);
    }
  }, [rangeFrom, rangeTo]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

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

  const branchNames = branches.map((b) => b.name);
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

  // Compute responsive chart widths so x-axis labels fit on narrow screens
  const revenueChartWidth = getResponsiveChartWidth(currentLabels);
  const branchComparisonChartWidth = getResponsiveChartWidth(currentBranchLabels);
  const branchPerformanceChartWidth = getResponsiveChartWidth(currentBranchLabels);
  
  const totalSales = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOrders = transactions.length;
  const salesTrend = currentRevenue.length ? Math.round(currentRevenue[currentRevenue.length - 1] || 0) : 0;
  const ordersTrend = Math.max(0, transactions.filter((t) => String(t.payment_status) === "paid").length);
  
  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };
  
  const handleLogout = () => {
    setOpen(false);
    router.push("/login");
  };

  const applyPickedDate = (d: Date, target: "from" | "to") => {
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

  const handlePrint = (section: string) => {
    // Simple, cross-platform fallback: use window.print on web, otherwise inform the user
    if (typeof window !== 'undefined' && (window as any).print) {
      (window as any).print();
      return;
    }
    Alert.alert('Print', 'Printing is available on web. For mobile, please take a screenshot or use export feature.');
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

        <View style={styles.dateRangeCard}>
          <Text style={styles.dateRangeTitle}>Date range</Text>
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
            {!isSmallScreen ? (
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.printBtn} onPress={() => handlePrint("Revenue")}>
                  <Ionicons name="print-outline" size={14} color="#1e293b" />
                  <Text style={styles.printText}>Print</Text>
                </TouchableOpacity>
              </View>
            ) : null}
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
                  ₱{tooltipPos.value.toLocaleString()}
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
                    formatYLabel: (y: string) => `₱${parseInt(y).toLocaleString()}`,
                    propsForBackgroundLines: {
                      stroke: "#00000051",
                      strokeWidth: 1,
                    },
                  }}
                  bezier
                  style={{ marginLeft: -20, borderRadius: 16 }}
                  formatYLabel={(yValue) => `₱${parseInt(yValue).toLocaleString()}`}
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
              {!isSmallScreen ? (
                <View style={styles.headerRight}>
                  <TouchableOpacity style={styles.printBtn} onPress={() => handlePrint("Branch Revenue Comparison")}>
                    <Ionicons name="print-outline" size={14} color="#1e293b" />
                    <Text style={styles.printText}>Print</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
                    {branchTooltip.label}: ₱{branchTooltip.value.toLocaleString()}
                  </Text>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', marginLeft: 0 }}>
                <Pressable
                  onPressIn={() => setBranchTooltip(prev => ({ ...prev, visible: true }))}
                  onPressOut={() => setBranchTooltip(prev => ({ ...prev, visible: false }))}
                  style={{ width: branchComparisonChartWidth + 140 }}
                >
                  <AnyBarChart
                    data={{
                      labels: currentBranchLabels,
                      datasets: [{ data: currentBranchValues }],
                    }}
                    width={branchComparisonChartWidth + 200}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 0,
                      color: () => `rgba(59, 130, 246, 1)`,
                      labelColor: () => `rgba(30, 41, 59, 1)`,
                      // Make x-axis labels slightly larger on small screens and make y-axis labels more readable
                      propsForLabels: {
                        fontSize: isSmallScreen ? 10 : 12,
                      },
                      formatYLabel: (y: string) => `₱${parseInt(y).toLocaleString()}`,
                      propsForBackgroundLines: {
                        stroke: "#00000051",
                        strokeWidth: 1,
                      },
                    }}
                    verticalLabelRotation={0}
                    fromZero={true}
                    showValuesOnTopOfBars={true}
                    style={{ marginLeft: -120, paddingRight: 40, paddingLeft: 15, borderRadius: 12, marginTop: 8 }}
                    // @ts-ignore - BarChart typings don't include onDataPointClick but runtime supports it
                    onDataPointClick={(data: any) => {
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
            {!isSmallScreen ? (
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.printBtn} onPress={() => handlePrint("Branch Performance")}>
                  <Ionicons name="print-outline" size={14} color="#1e293b" />
                  <Text style={styles.printText}>Print</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <View style={styles.barChartWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', marginLeft: 0 }}>
              <BarChart
                data={{
                  labels: currentBranchLabels,
                  datasets: [{ data: currentBranchValues }]
                }}
                width={branchPerformanceChartWidth + 200}
                height={isSmallScreen ? 260 : 300}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
                  // Make x-axis labels slightly larger on small screens and ensure y-axis labels are readable
                  propsForLabels: {
                    fontSize: isSmallScreen ? 10 : 12,
                  },
                  // Ensure y-axis values render as numbers with peso sign
                  formatYLabel: (y: string) => `₱${parseInt(y).toLocaleString()}`,
                  barPercentage: currentBranchLabels.length > 10 ? 0.4 : 0.6,
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    stroke: "#e2e8f0",
                    strokeWidth: 1,
                  },
                }}
                style={{ marginLeft: -120, paddingRight: 40, paddingLeft: 15, borderRadius: 12, marginTop: 10 }}
                verticalLabelRotation={0}
                fromZero={true}
                yAxisLabel=""
                yAxisSuffix=""
                segments={4}
                showValuesOnTopOfBars={true}
              />
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
  chartTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "flex-start",
  },
  printBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    maxWidth: 70,
  },
  printText: {
    marginLeft: 4,
    fontSize: 11,
    color: "#1e293b",
    fontWeight: "600",
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