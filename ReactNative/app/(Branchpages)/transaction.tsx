import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchPages } from "@/contexts/BranchPagesContext";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../../config/api";

const ROWS_PER_PAGE = 8;

type TransactionRow = {
  id: number;
  receipt: string;
  customer_name: string;
  payment_status: string;
  inventory_status: string;
  amount: number;
  due_date: string;
  branch_name: string;
  created_by_name: string;
  subtotal?: number;
  vat?: number;
  discount?: number;
  payment_received?: number;
  total?: number;
};

const getPaymentColor = (status: string) =>
  String(status).toLowerCase() === "paid" ? "#22C55E" : "#EF4444";

const getInventoryColor = (status: string) =>
  String(status).toLowerCase() === "picked_up" ? "#2563EB" : "#F59E0B";

export default function TransactionDeviceList() {
  const { token } = useAuth();
  const { branchId } = useBranchPages();
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [showAmountDetails, setShowAmountDetails] = useState(false);

  useEffect(() => {
    setShowAmountDetails(false);
  }, [selected]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / ROWS_PER_PAGE));
  const startIndex = (page - 1) * ROWS_PER_PAGE;
  const pageData = useMemo(
    () => transactions.slice(startIndex, startIndex + ROWS_PER_PAGE),
    [transactions, startIndex]
  );

  const loadTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!token) return;

      const response = await fetch(`${API_URL}/transactions?include_archived=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const raw = Array.isArray(data) ? data : [];
      const forBranch = branchId
        ? raw.filter((txn: any) => String(txn.branch_id) === String(branchId))
        : raw;
      const mapped: TransactionRow[] = forBranch
        .map((txn: any) => ({
          id: Number(txn.id),
          receipt: String(txn.receipt || `REC-${txn.id}`),
          customer_name: String(txn.customer_name || "Unknown"),
          payment_status: String(txn.payment_status || "unpaid"),
          inventory_status: String(txn.inventory_status || "in_shop"),
          amount: Number(txn.amount ?? txn.total ?? 0),
          subtotal: Number(txn.subtotal ?? txn.sub_total ?? 0),
          vat: Number(txn.vat ?? txn.tax ?? 0),
          discount: Number(txn.discount ?? 0),
          payment_received: Number(txn.payment_received ?? txn.amount_paid ?? txn.paid_amount ?? txn.paid ?? 0),
          total: Number(txn.total ?? txn.amount ?? 0),
          due_date: String(txn.due_date || "N/A"),
          branch_name: String(txn.branch_name || "Unknown branch"),
          created_by_name: String(txn.created_by_name || "Unknown creator"),
        }))
        .sort((a, b) => b.id - a.id);

      setTransactions(mapped);
      setPage(1);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }, [token, branchId]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={{ flex: 1 }} scrollEnabled={true}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Transactions</Text>
              <View style={styles.headerAccent} />
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadTransactions}>
              <Ionicons name="refresh-outline" size={16} color="#1e293b" />
              <Text style={styles.refreshText}>{isLoading ? "Loading..." : "Refresh"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tableContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tableInner}>
                <View style={styles.tableHeader}>
                  <Text style={styles.colReceipt}>Receipt</Text>
                  <Text style={styles.colName}>Customer</Text>
                  <Text style={styles.colAmt}>Amount</Text>
                </View>

                <View style={styles.tableBody}>
                  {pageData.map((item, index) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.6}
                      onPress={() => setSelected(item)}
                      style={[
                        styles.tableRow,
                        index < pageData.length - 1 && styles.rowDivider,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: getPaymentColor(item.payment_status) },
                        ]}
                      />
                      <Text style={styles.colReceiptText}>{item.receipt}</Text>
                      <Text style={styles.colNameText}>{item.customer_name}</Text>
                      <Text style={styles.colAmtText}>₱{item.amount.toFixed(2)}</Text>
                    </TouchableOpacity>
                  ))}

                  {pageData.length === 0 && !isLoading && (
                    <Text style={styles.emptyText}>No transactions found.</Text>
                  )}
                </View>
              </View>
            </ScrollView>

            <View style={styles.pagination}>
              <TouchableOpacity
                disabled={page === 1}
                onPress={() => setPage(page - 1)}
                style={[styles.pageBtn, page === 1 && styles.disabledBtn]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pageText, page === 1 && styles.disabledText]}>
                  Prev
                </Text>
              </TouchableOpacity>

              <View style={styles.pageNumberContainer}>
                <Text style={styles.pageNumber}>
                  Page {page} of {totalPages}
                </Text>
              </View>

              <TouchableOpacity
                disabled={page === totalPages}
                onPress={() => setPage(page + 1)}
                style={[styles.pageBtn, page === totalPages && styles.disabledBtn]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pageText,
                    page === totalPages && styles.disabledText,
                  ]}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Modal visible={!!selected} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalBox}>
                {selected && (
                  <>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Transaction Details</Text>
                      <TouchableOpacity
                        style={styles.modalCloseBtn}
                        onPress={() => setSelected(null)}
                      >
                        <Text style={styles.modalCloseText}>X</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modalContent}>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Receipt:</Text>
                        <Text style={styles.modalValue}>{selected.receipt}</Text>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Customer:</Text>
                        <Text style={styles.modalValue}>{selected.customer_name}</Text>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Branch:</Text>
                        <Text style={styles.modalValue}>{selected.branch_name}</Text>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Created By:</Text>
                        <Text style={styles.modalValue}>{selected.created_by_name}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.modalRow}
                        activeOpacity={0.8}
                        onPress={() => setShowAmountDetails((s) => !s)}
                      >
                        <Text style={styles.modalLabel}>Amount:</Text>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={styles.modalValue}>₱{selected.amount.toFixed(2)}</Text>
                          <Ionicons
                            name={showAmountDetails ? "chevron-up" : "chevron-down"}
                            size={18}
                            color="#64748b"
                            style={{ marginLeft: 8 }}
                          />
                        </View>
                      </TouchableOpacity>
                      {showAmountDetails && (
                        <View style={styles.modalBreakdown}>
                          <View style={styles.modalBreakdownRow}>
                            <Text style={styles.modalBreakdownLabel}>Subtotal</Text>
                            <Text style={styles.modalBreakdownValue}>
                              ₱{((selected.subtotal ?? (selected.amount - (selected.vat ?? 0) + (selected.discount ?? 0))) || 0).toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.modalBreakdownRow}>
                            <Text style={styles.modalBreakdownLabel}>VAT</Text>
                            <Text style={styles.modalBreakdownValue}>₱{(selected.vat ?? 0).toFixed(2)}</Text>
                          </View>
                          <View style={styles.modalBreakdownRow}>
                            <Text style={styles.modalBreakdownLabel}>Discount</Text>
                            <Text style={styles.modalBreakdownValue}>₱{(selected.discount ?? 0).toFixed(2)}</Text>
                          </View>
                          <View style={styles.modalBreakdownRow}>
                            <Text style={styles.modalBreakdownLabel}>Payment Received</Text>
                            <Text style={styles.modalBreakdownValue}>₱{(selected.payment_received ?? 0).toFixed(2)}</Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Payment:</Text>
                        <View
                          style={[
                            styles.modalStatusBadge,
                            {
                              backgroundColor:
                                getPaymentColor(selected.payment_status) + "20",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modalStatusText,
                              { color: getPaymentColor(selected.payment_status) },
                            ]}
                          >
                            {selected.payment_status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Inventory:</Text>
                        <View
                          style={[
                            styles.modalStatusBadge,
                            {
                              backgroundColor:
                                getInventoryColor(selected.inventory_status) + "20",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modalStatusText,
                              { color: getInventoryColor(selected.inventory_status) },
                            ]}
                          >
                            {selected.inventory_status.replace("_", " ").toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Due Date:</Text>
                        <Text style={styles.modalValue}>{selected.due_date}</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#ffffff",
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerContent: { position: "relative" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#1e293b", letterSpacing: -0.5 },
  headerAccent: {
    position: "absolute",
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refreshText: { color: "#1e293b", fontSize: 12, fontWeight: "700" },
  tableContainer: {
    margin: 20,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  tableInner: {
    minWidth: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 0,
    paddingLeft: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#e2e8f0",
    gap: 11,
    alignItems: "center",
  },
  tableBody: { paddingVertical: 8 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 13,
    paddingHorizontal: 12,
    paddingLeft: 0,
    alignItems: "center",
    backgroundColor: "#ffffff",
    gap: 11,
  },
  statusIndicator: {
    width: 3,
    height: "100%",
    minHeight: 55,
    borderRadius: 0,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  colReceipt: { width: 98, fontWeight: "700", fontSize: 11, color: "#475569" },
  colName: { width: 108, fontWeight: "700", fontSize: 11, color: "#475569" },
  colAmt: { width: 90, fontWeight: "700", fontSize: 11, color: "#475569", textAlign: "right" },
  colReceiptText: { width: 98, fontSize: 11, color: "#1e293b", fontWeight: "600" },
  colNameText: { width: 108, fontSize: 11, color: "#1e293b", fontWeight: "500" },
  colAmtText: { width: 90, fontSize: 12, color: "#1e293b", fontWeight: "700", textAlign: "right" },
  emptyText: {
    paddingVertical: 16,
    textAlign: "center",
    color: "#64748b",
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  pageBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
    borderRadius: 12,
  },
  disabledBtn: { backgroundColor: "#cbd5e1" },
  pageText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  disabledText: { color: "#94a3b8" },
  pageNumberContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  pageNumber: { fontWeight: "700", fontSize: 14, color: "#1e293b" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
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
  modalTitle: { fontWeight: "800", fontSize: 22, color: "#1e293b" },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: { fontSize: 16, color: "#64748b", fontWeight: "700" },
  modalContent: { padding: 24 },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalLabel: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  modalValue: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  modalStatusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  modalStatusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  modalBreakdown: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 8,
  },
  modalBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  modalBreakdownLabel: { fontSize: 12, color: "#64748b" },
  modalBreakdownValue: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
});
