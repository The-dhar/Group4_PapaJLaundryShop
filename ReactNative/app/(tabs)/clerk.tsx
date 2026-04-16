import React, { createElement, useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import { cacheDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { API_URL } from "../../config/api";
import type {
  ClerkLogPdfRow,
  ClerkLogsExportContext,
} from "../../lib/clerkLogsPdfExport.types";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { dateFrom: toYmd(start), dateTo: toYmd(end) };
}

/** Parse YYYY-MM-DD to local Date (no UTC shift). */
function parseYmdToDate(s: string): Date | null {
  const t = String(s ?? "").trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toDateMaybe(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—") return null;

  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return parseYmdToDate(ymd);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeDateOnly(value: unknown): string {
  const dt = toDateMaybe(value);
  return dt ? toYmd(dt) : "—";
}

function sanitizeDateTimeLabel(value: unknown): string {
  const dt = toDateMaybe(value);
  if (!dt) return "—";

  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${toYmd(dt)} ${hh}:${mm}`;
}

function paymentFilterLabel(value: PaymentFilter): string {
  if (value === "paid") return "Paid only";
  if (value === "unpaid") return "Unpaid only";
  return "All";
}

function inventoryFilterLabel(value: InventoryFilter): string {
  if (value === "in_shop") return "In shop only";
  if (value === "picked_up") return "Picked up only";
  return "All";
}

function buildDateRangeLabel(dateFrom: string, dateTo: string): string {
  const from = sanitizeDateOnly(dateFrom);
  const to = sanitizeDateOnly(dateTo);
  if (from === "—" && to === "—") return "All dates";
  return `${from} to ${to}`;
}

/**
 * RN Web's TextInput does not reliably forward `type="date"` to the DOM, so the
 * browser shows a plain text field. A real HTML input opens the native calendar popover.
 */
const WEB_DATE_INPUT_STYLE: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderStyle: "solid",
  borderWidth: 1,
  borderColor: "#e2e8f0",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  backgroundColor: "#f8fafc",
  color: "#1e293b",
  minHeight: 44,
  cursor: "pointer",
};

type BranchOption = {
  id: number;
  name: string;
};

/** Web: native <select> for branch filter (RN Web has no built-in dropdown). */
function WebBranchSelect({
  value,
  branches,
  onChange,
}: {
  value: number | null;
  branches: BranchOption[];
  onChange: (branchId: number | null) => void;
}) {
  const v = value == null ? "" : String(value);
  return (
    <View style={{ marginBottom: 8 }}>
      {createElement(
        "select",
        {
          value: v,
          onChange: (e: ChangeEvent<HTMLSelectElement>) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw));
          },
          style: WEB_DATE_INPUT_STYLE,
        },
        [
          createElement("option", { key: "all", value: "" }, "All branches"),
          ...branches.map((b) =>
            createElement("option", { key: b.id, value: String(b.id) }, b.name)
          ),
        ]
      )}
    </View>
  );
}

function WebHtmlDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (ymd: string) => void;
}) {
  const v = String(value ?? "").trim();
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.miniLabel}>{label}</Text>
      {createElement("input", {
        type: "date",
        value: safe,
        onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        style: WEB_DATE_INPUT_STYLE,
      })}
    </View>
  );
}

/** More rows on taller phones/tablets; fills space above pagination */
function computeRowsPerPage(windowHeight: number): number {
  const reserved =
    88 + // header
    48 + // toolbar (filters/export)
    72 + // pagination bar
    120 + // bottom tab bar + safe inset (approx)
    56 + // table header row
    24 + // padding
    40 + // table card bottom inset + gap above pagination (approx)
    14; // table card top margin (match sides)
  const rowHeight = 46;
  const n = Math.floor((windowHeight - reserved) / rowHeight);
  return Math.max(12, Math.min(48, n));
}

type PaymentFilter = "all" | "paid" | "unpaid";
type InventoryFilter = "all" | "in_shop" | "picked_up";

type FilterState = {
  dateFrom: string;
  dateTo: string;
  includeArchived: boolean;
  /** Owner only: `null` = all branches. Ignored for non-owners (API scopes by login). */
  branchId: number | null;
  payment: PaymentFilter;
  inventory: InventoryFilter;
};

type ClerkLog = {
  id: number;
  receipt_id: string;
  created_at: string;
  clerk_name: string;
  branch: string;
  customer_name: string;
  amount: number;
  status: string;
  inventory_status: string;
  inventory_raw: string;
  due_date: string;
};

const getStatusColor = (status: string) =>
  status === "paid" ? "#22C55E" : "#EF4444";

/** Matches ReactJS `inventorystyle.css` `.status-in_shop` / `.status-picked_up` */
function getInventoryPillColors(raw: string): { bg: string; fg: string } {
  const r = String(raw ?? "").toLowerCase().trim();
  if (r === "in_shop") return { bg: "#e0f2fe", fg: "#0369a1" };
  if (r === "picked_up") return { bg: "#ede9fe", fg: "#5b21b6" };
  return { bg: "#f1f5f9", fg: "#475569" };
}

function InventoryStatusPill({ raw, label }: { raw: string; label: string }) {
  const inv = getInventoryPillColors(raw);
  return (
    <View style={[styles.inventoryPill, { backgroundColor: inv.bg }]}>
      <Text style={[styles.inventoryPillText, { color: inv.fg }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const COL = {
  receipt: 118,
  clerk: 120,
  branch: 126,
  customer: 148,
  amount: 92,
  payment: 96,
  inventory: 108,
  due: 102,
  action: 52,
} as const;

const TABLE_MIN_WIDTH =
  COL.receipt +
  COL.clerk +
  COL.branch +
  COL.customer +
  COL.amount +
  COL.payment +
  COL.inventory +
  COL.due +
  COL.action;

function formatInventoryLabel(raw: string) {
  const s = String(raw ?? "").trim();
  if (!s || s === "N/A") return "—";
  return s
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function applyClientFilters(
  rows: ClerkLog[],
  payment: PaymentFilter,
  inventory: InventoryFilter
): ClerkLog[] {
  return rows.filter((row) => {
    if (payment === "paid" && row.status !== "paid") return false;
    if (payment === "unpaid" && row.status === "paid") return false;
    if (inventory === "in_shop" && row.inventory_raw !== "in_shop") return false;
    if (inventory === "picked_up" && row.inventory_raw !== "picked_up") return false;
    return true;
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }
  const g = globalThis as unknown as {
    Buffer?: { from: (data: Uint8Array) => { toString: (enc: string) => string } };
  };
  if (g.Buffer) {
    return g.Buffer.from(Uint8Array.from(bytes)).toString("base64");
  }
  throw new Error("Base64 encoding is not available.");
}

function buildExportRows(rows: ClerkLog[]): ClerkLogPdfRow[] {
  return rows.map((r, index) => ({
    row_no: index + 1,
    receipt_id: String(r.receipt_id || "—"),
    created_at: sanitizeDateTimeLabel(r.created_at),
    clerk_name: String(r.clerk_name || "—"),
    branch: String(r.branch || "—"),
    customer_name: String(r.customer_name || "—"),
    amount: Number(r.amount) || 0,
    status: String(r.status || "—").toUpperCase(),
    inventory_status: String(r.inventory_status || "—"),
    due_date: sanitizeDateOnly(r.due_date),
  }));
}

function buildClerkLogsXlsxBytes(
  rows: ClerkLogPdfRow[],
  context: ClerkLogsExportContext
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ["Papa J's Laundry Shop"],
    ["Clerk Logs Export"],
    [],
    ["Generated at", context.generated_at],
    ["Requested by", context.requested_by],
    ["Branch", context.branch_label],
    ["Date range", context.date_range_label],
    ["Payment filter", context.payment_label],
    ["Inventory filter", context.inventory_label],
    ["Include archived", context.include_archived_label],
    ["Exported rows", String(context.total_rows)],
    ["Total amount", context.total_amount],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const txnHeader = [
    "#",
    "Receipt ID",
    "Created",
    "Due",
    "Customer",
    "Clerk",
    "Branch",
    "Payment",
    "Inventory",
    "Amount (PHP)",
  ];
  const txnBody = rows.map((r) => [
    r.row_no,
    r.receipt_id,
    r.created_at,
    r.due_date,
    r.customer_name,
    r.clerk_name,
    r.branch,
    r.status,
    r.inventory_status,
    Number(r.amount) || 0,
  ]);
  const transactionsSheet = XLSX.utils.aoa_to_sheet([txnHeader, ...txnBody]);
  transactionsSheet["!cols"] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
  ];
  transactionsSheet["!autofilter"] = {
    ref: `A1:J${Math.max(1, txnBody.length + 1)}`,
  };
  XLSX.utils.book_append_sheet(wb, transactionsSheet, "Transactions");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(out);
}

/** Copy bytes into a plain `ArrayBuffer` for `Blob` (avoids SharedArrayBuffer typing issues). */
function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function downloadBlobWeb(blob: Blob, filename: string) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportClerkLogsExcel(rows: ClerkLogPdfRow[], context: ClerkLogsExportContext) {
  const bytes = buildClerkLogsXlsxBytes(rows, context);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `clerk-logs-${stamp}.xlsx`;
  if (Platform.OS === "web") {
    downloadBlobWeb(
      new Blob([uint8ToArrayBuffer(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename
    );
    return;
  }
  if (!cacheDirectory) {
    throw new Error("File storage is not available on this device.");
  }
  const uri = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(uri, uint8ToBase64(bytes), { encoding: "base64" });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Export Clerk Logs",
    });
  } else {
    Alert.alert("Export ready", `Saved: ${filename}`);
  }
}

/**
 * PDF export for web/native with the same structured content and active filter metadata.
 */
async function exportClerkLogsPdf(rows: ClerkLogPdfRow[], context: ClerkLogsExportContext) {
  if (Platform.OS === "web") {
    const { exportClerkLogsPdf: run } = await import("../../lib/clerkLogsPdfExport.web");
    await run(rows, context);
    return;
  }
  const { exportClerkLogsPdf: run } = await import("../../lib/clerkLogsPdfExport.native");
  await run(rows, context);
}

export default function ClerkLogsList() {
  const { height: windowHeight } = useWindowDimensions();
  const rowsPerPage = useMemo(
    () => computeRowsPerPage(windowHeight),
    [windowHeight]
  );

  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<ClerkLog | null>(null);
  const [allLogs, setAllLogs] = useState<ClerkLog[]>([]);

  const [filters, setFilters] = useState<FilterState>(() => ({
    ...defaultDateRange(),
    includeArchived: true,
    branchId: null,
    payment: "all",
    inventory: "all",
  }));

  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>(filters);

  /** 'from' | 'to' while Android dialog or iOS sheet is open */
  const [datePickerField, setDatePickerField] = useState<null | "from" | "to">(null);
  const [pickerTempDate, setPickerTempDate] = useState(() => new Date());
  const [iosDatePickerVisible, setIosDatePickerVisible] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  useEffect(() => {
    if (!filterModalVisible) {
      setDatePickerField(null);
      setIosDatePickerVisible(false);
      setBranchDropdownOpen(false);
    }
  }, [filterModalVisible]);

  const openFilterDateField = (field: "from" | "to") => {
    if (Platform.OS === "web") {
      return;
    }
    const raw = field === "from" ? draftFilters.dateFrom : draftFilters.dateTo;
    setPickerTempDate(parseYmdToDate(raw) ?? new Date());
    setDatePickerField(field);
    if (Platform.OS === "ios") {
      setIosDatePickerVisible(true);
    }
  };

  const commitPickerDateToDraft = (field: "from" | "to", date: Date) => {
    const ymd = toYmd(date);
    setDraftFilters((d) => ({
      ...d,
      [field === "from" ? "dateFrom" : "dateTo"]: ymd,
    }));
  };

  const filteredLogs = useMemo(
    () => applyClientFilters(allLogs, filters.payment, filters.inventory),
    [allLogs, filters.payment, filters.inventory]
  );

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const pageData = filteredLogs.slice(startIndex, startIndex + rowsPerPage);

  const router = useRouter();
  const { token, logout, user } = useAuth();
  const isOwner = String(user?.role ?? "") === "owner";
  const [open, setOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const draftBranchDisplayLabel = useMemo(() => {
    if (draftFilters.branchId == null) return "All branches";
    const b = branches.find((x) => x.id === draftFilters.branchId);
    return b?.name ?? "Branch";
  }, [draftFilters.branchId, branches]);

  const activeBranchDisplayLabel = useMemo(() => {
    if (!isOwner) return "Assigned branch scope";
    if (filters.branchId == null) return "All branches";
    const b = branches.find((x) => x.id === filters.branchId);
    return b?.name ?? `Branch ${filters.branchId}`;
  }, [branches, filters.branchId, isOwner]);

  const requestedBy = useMemo(() => {
    const name = String((user as { name?: string } | null)?.name ?? "").trim();
    if (name) return name;
    const email = String((user as { email?: string } | null)?.email ?? "").trim();
    return email || "Unknown user";
  }, [user]);

  const totalFilteredAmount = useMemo(
    () => filteredLogs.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [filteredLogs]
  );

  const runExport = useCallback(
    async (kind: "excel" | "pdf") => {
      setExportMenuOpen(false);
      if (filteredLogs.length === 0) {
        Alert.alert("Nothing to export", "No transactions match your current filters.");
        return;
      }
      try {
        // Export all filtered rows (not just the current page) with sanitized dates.
        const exportRows = buildExportRows(filteredLogs);
        const exportContext: ClerkLogsExportContext = {
          generated_at: sanitizeDateTimeLabel(new Date().toISOString()),
          requested_by: requestedBy,
          branch_label: activeBranchDisplayLabel,
          date_range_label: buildDateRangeLabel(filters.dateFrom, filters.dateTo),
          payment_label: paymentFilterLabel(filters.payment),
          inventory_label: inventoryFilterLabel(filters.inventory),
          include_archived_label: filters.includeArchived ? "Yes" : "No",
          total_rows: exportRows.length,
          total_amount: totalFilteredAmount,
        };

        if (kind === "excel") {
          await exportClerkLogsExcel(exportRows, exportContext);
        } else {
          await exportClerkLogsPdf(exportRows, exportContext);
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Export failed", e instanceof Error ? e.message : "Could not export.");
      }
    },
    [
      activeBranchDisplayLabel,
      filteredLogs,
      filters.dateFrom,
      filters.dateTo,
      filters.includeArchived,
      filters.inventory,
      filters.payment,
      requestedBy,
      totalFilteredAmount,
    ]
  );

  const loadBranches = useCallback(async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_URL}/branches`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setBranches(
        list
          .map((b: { id?: number; name?: string }) => ({
            id: Number(b.id),
            name: String(b.name ?? ""),
          }))
          .filter((b) => Number.isFinite(b.id) && b.name)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      );
    } catch (e) {
      console.log(e);
    }
  }, [token]);

  const loadClerkLogs = useCallback(async () => {
    try {
      if (!token) return;

      const qs = new URLSearchParams();
      qs.set("include_archived", filters.includeArchived ? "1" : "0");
      if (filters.dateFrom.trim()) qs.set("date_from", filters.dateFrom.trim());
      if (filters.dateTo.trim()) qs.set("date_to", filters.dateTo.trim());
      if (isOwner && filters.branchId != null) {
        qs.set("branch_id", String(filters.branchId));
      }

      const response = await fetch(`${API_URL}/transactions?${qs.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const mapped: ClerkLog[] = (Array.isArray(data) ? data : []).map((txn: any) => {
        const invRaw = String(txn.inventory_status || "").toLowerCase();
        const creatorName = String(txn.created_by_name || "").trim();
        return {
          id: Number(txn.id),
          receipt_id: txn.receipt || `REC-${txn.id}`,
          created_at: sanitizeDateTimeLabel(txn.created_at),
          clerk_name: creatorName || "Unknown creator",
          branch: txn.branch_name || "Unknown branch",
          customer_name: txn.customer_name || "Unknown customer",
          amount: Number(txn.amount || 0),
          status: String(txn.payment_status || "unpaid"),
          inventory_raw: invRaw,
          inventory_status: formatInventoryLabel(String(txn.inventory_status || "")),
          due_date: sanitizeDateOnly(txn.due_date),
        };
      });

      setAllLogs(mapped);
    } catch (error) {
      console.log(error);
    }
  }, [filters.dateFrom, filters.dateTo, filters.includeArchived, filters.branchId, isOwner, token]);

  useFocusEffect(
    useCallback(() => {
      void loadBranches();
      void loadClerkLogs();
    }, [loadBranches, loadClerkLogs])
  );

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p < 1 ? 1 : p));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [filteredLogs.length, rowsPerPage]);

  const openFilterModal = () => {
    setExportMenuOpen(false);
    setDraftFilters({ ...filters });
    setFilterModalVisible(true);
  };

  const applyPresetRange = (days: number | "all") => {
    if (days === "all") {
      setDraftFilters((d) => ({ ...d, dateFrom: "", dateTo: "" }));
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDraftFilters((d) => ({
      ...d,
      dateFrom: toYmd(start),
      dateTo: toYmd(end),
    }));
  };

  const applyFiltersFromModal = () => {
    setFilters({ ...draftFilters });
    setFilterModalVisible(false);
  };

  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace("/(openingApps)/login");
  };

  const Chip = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainFill}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerText}>Clerk Logs</Text>
            <View style={styles.headerAccent} />
          </View>

          <View style={styles.profileContainer}>
            <TouchableOpacity style={styles.profileBtn} onPress={() => setOpen(!open)}>
              <Ionicons name="person-circle-outline" size={30} color="#1e293b" />
            </TouchableOpacity>

            {open && (
              <View style={styles.dropdown}>
                <TouchableOpacity style={styles.dropdownItem} onPress={handleProfile}>
                  <Text style={styles.dropdownText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownItem, styles.dropdownItemLast]}
                  onPress={handleLogout}
                >
                  <Text style={styles.dropdownText}>Logout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={openFilterModal} activeOpacity={0.7}>
            <Ionicons name="filter-outline" size={20} color="#1e293b" />
            <Text style={styles.toolbarBtnText}>Filters</Text>
          </TouchableOpacity>
          <View style={styles.toolbarExportWrap}>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => {
                setOpen(false);
                setExportMenuOpen((v) => !v);
              }}
              activeOpacity={0.7}
              accessibilityLabel="Export, opens menu to choose Excel or PDF"
            >
              <Ionicons name="download-outline" size={20} color="#1e293b" />
              <Text style={styles.toolbarBtnText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={exportMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setExportMenuOpen(false)}
        >
          <View style={styles.exportMenuModalRoot}>
            <Pressable style={styles.exportMenuBackdrop} onPress={() => setExportMenuOpen(false)} />
            <View style={styles.exportMenuAnchor} pointerEvents="box-none">
              <View style={styles.exportDropdown}>
                <TouchableOpacity
                  style={styles.exportDropdownItem}
                  onPress={() => runExport("excel")}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text-outline" size={18} color="#1e293b" />
                  <Text style={styles.exportDropdownText}>Excel (.xlsx)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exportDropdownItem, styles.exportDropdownItemLast]}
                  onPress={() => runExport("pdf")}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-outline" size={18} color="#1e293b" />
                  <Text style={styles.exportDropdownText}>PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.tableCardWrap}>
          <View style={styles.tableOuter}>
          {/*
            Outer vertical ScrollView: horizontal ScrollView does not clip tall content on web/native,
            so rows were painting over the pagination. Vertical scroll keeps overflow inside this region.
          */}
          <View style={styles.tableScrollRegion}>
          <ScrollView
            style={styles.tableVerticalScroll}
            contentContainerStyle={styles.tableVerticalScrollContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={Platform.OS !== "web"}
            bounces={false}
          >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            bounces={false}
            nestedScrollEnabled
            style={styles.tableHorizontalScroll}
            contentContainerStyle={styles.tableScrollInner}
          >
            <View style={{ width: TABLE_MIN_WIDTH, alignSelf: "flex-start" }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { width: COL.receipt }]}>Receipt ID</Text>
                <Text style={[styles.thCell, { width: COL.clerk }]}>Created By</Text>
                <Text style={[styles.thCell, { width: COL.branch }]}>Branch</Text>
                <Text style={[styles.thCell, { width: COL.customer }]}>Customer</Text>
                <Text style={[styles.thCell, { width: COL.amount }]}>Amount</Text>
                <Text style={[styles.thCell, { width: COL.payment }]}>Payment</Text>
                <Text style={[styles.thCell, { width: COL.inventory }]}>Inventory</Text>
                <Text style={[styles.thCell, { width: COL.due }]}>Due</Text>
                <Text style={[styles.thCell, { width: COL.action, textAlign: "center" }]}>
                  View
                </Text>
              </View>

              <View style={styles.tableBody}>
                {pageData.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.tableRow,
                      index < pageData.length - 1 && styles.rowDivider,
                    ]}
                  >
                    <Text style={[styles.tdCell, { width: COL.receipt }]} numberOfLines={2}>
                      {item.receipt_id}
                    </Text>
                    <Text style={[styles.tdCell, { width: COL.clerk }]} numberOfLines={2}>
                      {item.clerk_name}
                    </Text>
                    <Text style={[styles.tdCellMuted, { width: COL.branch }]} numberOfLines={2}>
                      {item.branch}
                    </Text>
                    <Text style={[styles.tdCellMuted, { width: COL.customer }]} numberOfLines={2}>
                      {item.customer_name}
                    </Text>
                    <Text style={[styles.tdCell, { width: COL.amount }]}>₱{item.amount.toFixed(2)}</Text>
                    <View style={{ width: COL.payment, justifyContent: "center" }}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(item.status) + "20" },
                        ]}
                      >
                        <Text
                          style={[styles.statusText, { color: getStatusColor(item.status) }]}
                          numberOfLines={1}
                        >
                          {item.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        width: COL.inventory,
                        justifyContent: "center",
                        paddingRight: 8,
                      }}
                    >
                      <InventoryStatusPill raw={item.inventory_raw} label={item.inventory_status} />
                    </View>
                    <Text style={[styles.tdCellSmall, { width: COL.due }]} numberOfLines={1}>
                      {item.due_date}
                    </Text>
                    <TouchableOpacity
                      style={[styles.eyeButton, { width: COL.action }]}
                      onPress={() => setSelectedLog(item)}
                    >
                      <Ionicons name="eye-outline" size={20} color="#1e293b" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          </ScrollView>
          </View>

          <View style={styles.pagination}>
            <TouchableOpacity
              disabled={page === 1}
              onPress={() => setPage(page - 1)}
              style={[styles.pageBtn, page === 1 && styles.disabledBtn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageText, page === 1 && styles.disabledText]}>Prev</Text>
            </TouchableOpacity>

            <View style={styles.pageNumberContainer}>
              <Text style={styles.pageNumber}>
                Page {page} of {totalPages}
              </Text>
              <Text style={styles.pageSubtext}>{rowsPerPage} rows / page</Text>
            </View>

            <TouchableOpacity
              disabled={page === totalPages}
              onPress={() => setPage(page + 1)}
              style={[styles.pageBtn, page === totalPages && styles.disabledBtn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageText, page === totalPages && styles.disabledText]}>Next</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </View>

      {/* Filter modal */}
      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.filterOverlay}>
          <View style={styles.filterBox}>
            <Text style={styles.filterTitle}>Filters</Text>
            <Text style={styles.filterSectionLabel}>Date range (transaction date)</Text>
            <View style={styles.presetRow}>
              <Chip label="7d" selected={false} onPress={() => applyPresetRange(7)} />
              <Chip label="30d" selected={false} onPress={() => applyPresetRange(30)} />
              <Chip label="90d" selected={false} onPress={() => applyPresetRange(90)} />
              <Chip label="All" selected={false} onPress={() => applyPresetRange("all")} />
            </View>
            <Text style={styles.filterHint}>
              {Platform.OS === "web"
                ? "Click the field or the calendar icon — the browser date picker will open."
                : "Tap a date to open the calendar."}
            </Text>
            {Platform.OS === "web" ? (
              <View style={styles.dateRow}>
                <WebHtmlDateField
                  label="Start date"
                  value={draftFilters.dateFrom}
                  onChange={(ymd) => setDraftFilters((d) => ({ ...d, dateFrom: ymd }))}
                />
                <WebHtmlDateField
                  label="End date"
                  value={draftFilters.dateTo}
                  onChange={(ymd) => setDraftFilters((d) => ({ ...d, dateTo: ymd }))}
                />
              </View>
            ) : (
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Start date</Text>
                  <TouchableOpacity
                    style={styles.dateFieldBtn}
                    onPress={() => openFilterDateField("from")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateFieldText,
                        !draftFilters.dateFrom.trim() && styles.dateFieldPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {draftFilters.dateFrom.trim() || "yyyy-mm-dd"}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>End date</Text>
                  <TouchableOpacity
                    style={styles.dateFieldBtn}
                    onPress={() => openFilterDateField("to")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateFieldText,
                        !draftFilters.dateTo.trim() && styles.dateFieldPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {draftFilters.dateTo.trim() || "yyyy-mm-dd"}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Include archived</Text>
              <Switch
                value={draftFilters.includeArchived}
                onValueChange={(v) => setDraftFilters((d) => ({ ...d, includeArchived: v }))}
              />
            </View>

            {isOwner ? (
              <>
                <Text style={styles.filterSectionLabel}>Branch</Text>
                {Platform.OS === "web" ? (
                  <WebBranchSelect
                    value={draftFilters.branchId}
                    branches={branches}
                    onChange={(branchId) => setDraftFilters((d) => ({ ...d, branchId }))}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.branchDropdownBtn}
                    onPress={() => setBranchDropdownOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.branchDropdownBtnText} numberOfLines={1}>
                      {draftBranchDisplayLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#64748b" />
                  </TouchableOpacity>
                )}
              </>
            ) : null}

            <Text style={styles.filterSectionLabel}>Payment</Text>
            <View style={styles.presetRow}>
              <Chip
                label="All"
                selected={draftFilters.payment === "all"}
                onPress={() => setDraftFilters((d) => ({ ...d, payment: "all" }))}
              />
              <Chip
                label="Paid"
                selected={draftFilters.payment === "paid"}
                onPress={() => setDraftFilters((d) => ({ ...d, payment: "paid" }))}
              />
              <Chip
                label="Unpaid"
                selected={draftFilters.payment === "unpaid"}
                onPress={() => setDraftFilters((d) => ({ ...d, payment: "unpaid" }))}
              />
            </View>

            <Text style={styles.filterSectionLabel}>Inventory</Text>
            <View style={styles.presetRow}>
              <Chip
                label="All"
                selected={draftFilters.inventory === "all"}
                onPress={() => setDraftFilters((d) => ({ ...d, inventory: "all" }))}
              />
              <Chip
                label="In shop"
                selected={draftFilters.inventory === "in_shop"}
                onPress={() => setDraftFilters((d) => ({ ...d, inventory: "in_shop" }))}
              />
              <Chip
                label="Picked up"
                selected={draftFilters.inventory === "picked_up"}
                onPress={() => setDraftFilters((d) => ({ ...d, inventory: "picked_up" }))}
              />
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.filterCancelBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyBtn} onPress={applyFiltersFromModal}>
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
          {filterModalVisible && Platform.OS === "android" && datePickerField ? (
            <DateTimePicker
              value={pickerTempDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                if (event?.type === "dismissed") {
                  setDatePickerField(null);
                  return;
                }
                if (date && datePickerField) {
                  commitPickerDateToDraft(datePickerField, date);
                  setPickerTempDate(date);
                }
                setDatePickerField(null);
              }}
            />
          ) : null}
        </View>
      </Modal>

      {Platform.OS !== "web" && (
        <Modal
          visible={branchDropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setBranchDropdownOpen(false)}
        >
          <View style={styles.branchPickerModalRoot}>
            <Pressable style={styles.branchPickerBackdrop} onPress={() => setBranchDropdownOpen(false)} />
            <View style={styles.branchPickerSheetWrap} pointerEvents="box-none">
              <View style={styles.branchPickerCard}>
                <ScrollView style={styles.branchPickerScroll} keyboardShouldPersistTaps="handled">
                  <TouchableOpacity
                    style={[
                      styles.branchPickerRow,
                      draftFilters.branchId === null && styles.branchPickerRowSelected,
                    ]}
                    onPress={() => {
                      setDraftFilters((d) => ({ ...d, branchId: null }));
                      setBranchDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.branchPickerRowText,
                        draftFilters.branchId === null && styles.branchPickerRowTextSelected,
                      ]}
                    >
                      All branches
                    </Text>
                  </TouchableOpacity>
                  {branches.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.branchPickerRow,
                        draftFilters.branchId === b.id && styles.branchPickerRowSelected,
                      ]}
                      onPress={() => {
                        setDraftFilters((d) => ({ ...d, branchId: b.id }));
                        setBranchDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.branchPickerRowText,
                          draftFilters.branchId === b.id && styles.branchPickerRowTextSelected,
                        ]}
                        numberOfLines={2}
                      >
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === "ios" && (
        <Modal visible={iosDatePickerVisible && !!datePickerField} transparent animationType="slide">
          <View style={styles.iosPickerBackdrop}>
            <TouchableOpacity
              style={styles.iosPickerBackdropDismiss}
              activeOpacity={1}
              onPress={() => {
                setIosDatePickerVisible(false);
                setDatePickerField(null);
              }}
            />
            <View style={styles.iosPickerSheet}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setIosDatePickerVisible(false);
                    setDatePickerField(null);
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.iosPickerHeaderBtn}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (datePickerField) {
                      commitPickerDateToDraft(datePickerField, pickerTempDate);
                    }
                    setIosDatePickerVisible(false);
                    setDatePickerField(null);
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={[styles.iosPickerHeaderBtn, styles.iosPickerHeaderDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              {datePickerField ? (
                <DateTimePicker
                  value={pickerTempDate}
                  mode="date"
                  display="spinner"
                  onChange={(_, d) => {
                    if (d) setPickerTempDate(d);
                  }}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={!!selectedLog} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            {selectedLog && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Receipt Details</Text>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedLog(null)}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalContent}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Receipt ID:</Text>
                    <Text style={styles.modalValue}>{selectedLog.receipt_id}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Created By:</Text>
                    <Text style={styles.modalValue}>{selectedLog.clerk_name}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Customer:</Text>
                    <Text style={styles.modalValue}>{selectedLog.customer_name}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Branch:</Text>
                    <Text style={styles.modalValue}>{selectedLog.branch}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Amount:</Text>
                    <Text style={styles.modalValue}>₱{selectedLog.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Payment Status:</Text>
                    <View
                      style={[
                        styles.modalStatusBadge,
                        { backgroundColor: getStatusColor(selectedLog.status) + "20" },
                      ]}
                    >
                      <Text
                        style={[styles.modalStatusText, { color: getStatusColor(selectedLog.status) }]}
                      >
                        {selectedLog.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Inventory Status:</Text>
                    <InventoryStatusPill
                      raw={selectedLog.inventory_raw}
                      label={selectedLog.inventory_status}
                    />
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Due Date:</Text>
                    <Text style={styles.modalValue}>{selectedLog.due_date}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedLog(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  mainFill: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  headerLeft: { flexDirection: "column", position: "relative" },
  headerAccent: {
    position: "absolute",
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  profileContainer: { position: "relative", zIndex: 2000 },
  profileBtn: { padding: 6 },
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
    elevation: 999,
    minWidth: 120,
    zIndex: 9999,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownText: { fontSize: 14, color: "#1e293b", fontWeight: "600" },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toolbarBtnText: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  toolbarExportWrap: {
    position: "relative",
    zIndex: 20,
  },

  exportMenuModalRoot: {
    flex: 1,
  },
  exportMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  /** Align with Export button (header + toolbar); tweak if OS scales differ */
  exportMenuAnchor: {
    position: "absolute",
    top: 108,
    right: 14,
    zIndex: 2,
    elevation: 12,
  },
  exportDropdown: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minWidth: 208,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    overflow: "hidden",
  },
  exportDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  exportDropdownItemLast: {
    borderBottomWidth: 0,
  },
  exportDropdownText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },

  /** Inset card: breathing room on left, right, top, and bottom */
  tableCardWrap: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 14,
  },
  tableOuter: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  /** Fills space above pagination; outer vertical scroll clips tall tables. */
  tableScrollRegion: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  tableVerticalScroll: {
    flex: 1,
    minHeight: 0,
  },
  tableVerticalScrollContent: {
    flexGrow: 1,
    minWidth: "100%",
  },
  tableHorizontalScroll: {
    width: "100%",
  },
  tableScrollInner: { flexGrow: 1 },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
  },
  thCell: {
    fontWeight: "700",
    fontSize: 12,
    color: "#475569",
    paddingRight: 8,
  },
  /** Space between last row and pagination bar */
  tableBody: { paddingTop: 2, paddingBottom: 14 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
    minHeight: 44,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tdCell: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "600",
    paddingRight: 8,
  },
  tdCellMuted: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    paddingRight: 8,
  },
  tdCellSmall: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
    paddingRight: 8,
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  /** Web inventory pills: `.status-in_shop` / `.status-picked_up` */
  inventoryPill: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    maxWidth: "100%",
  },
  inventoryPillText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  eyeButton: { alignItems: "center", justifyContent: "center" },

  pagination: {
    flexShrink: 0,
    flexGrow: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 12,
    gap: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 2,
    borderTopColor: "#e2e8f0",
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    minWidth: 72,
    alignItems: "center",
  },
  disabledBtn: { backgroundColor: "#cbd5e1" },
  pageText: { color: "#ffffff", fontWeight: "700", fontSize: 13, letterSpacing: 0.3 },
  disabledText: { color: "#94a3b8" },
  pageNumberContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  pageNumber: { fontWeight: "700", fontSize: 13, color: "#1e293b" },
  pageSubtext: { fontSize: 11, color: "#64748b", marginTop: 2 },

  filterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 28,
  },
  filterBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "90%",
    width: "100%",
  },
  filterTitle: { fontSize: 20, fontWeight: "800", color: "#1e293b", marginBottom: 16 },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 8,
    marginTop: 8,
  },
  filterHint: { fontSize: 12, color: "#94a3b8", marginBottom: 6 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipSelected: { backgroundColor: "#dbeafe", borderColor: "#3b82f6" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  chipTextSelected: { color: "#1d4ed8" },
  dateRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  miniLabel: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  dateFieldBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  dateFieldText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1e293b" },
  dateFieldPlaceholder: { fontWeight: "500", color: "#94a3b8" },

  branchDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    gap: 8,
    marginBottom: 8,
  },
  branchDropdownBtnText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1e293b" },

  branchPickerModalRoot: { flex: 1 },
  branchPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  branchPickerSheetWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  branchPickerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxHeight: "70%",
    overflow: "hidden",
  },
  branchPickerScroll: { maxHeight: 400 },
  branchPickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  branchPickerRowSelected: { backgroundColor: "#eff6ff" },
  branchPickerRowText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  branchPickerRowTextSelected: { color: "#1d4ed8" },

  iosPickerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iosPickerBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  iosPickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 8,
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
  iosPickerHeaderBtn: { fontSize: 17, fontWeight: "600", color: "#64748b" },
  iosPickerHeaderDone: { color: "#3b82f6" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  filterActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  filterCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterCancelText: { fontWeight: "700", color: "#475569" },
  filterApplyBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  filterApplyText: { fontWeight: "700", color: "#fff" },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontWeight: "800", fontSize: 22, color: "#1e293b", letterSpacing: -0.5 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: { fontSize: 20, color: "#64748b", fontWeight: "600" },
  modalContent: { padding: 24 },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalLabel: { fontSize: 14, fontWeight: "600", color: "#64748b", letterSpacing: 0.2 },
  modalValue: { fontSize: 15, fontWeight: "700", color: "#1e293b", letterSpacing: 0.2 },
  modalStatusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  modalStatusText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  closeBtn: {
    margin: 24,
    marginTop: 8,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  closeBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
});
