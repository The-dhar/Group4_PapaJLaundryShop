import React, { useState } from "react";
import { Modal,SafeAreaView,StyleSheet,Text,TouchableOpacity,View, ScrollView} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
const ROWS_PER_PAGE = 5;

// -----------------------------
// Mock Data
// -----------------------------
const mockTransactions = [
  {
    id: "1",receipt: "REC-001",customer_name: "John Doe",payment_status: "paid",inventory_status: "picked_up",amount: 350.0,due_date: "2025-11-25"},
  {id: "2",receipt: "REC-002",customer_name: "Jane Smith",payment_status: "unpaid",inventory_status: "in_shop",amount: 500.0,due_date: "2025-11-26",},
  {id: "3",receipt: "REC-003",customer_name: "Carlos Mendoza",payment_status: "paid",inventory_status: "in_shop",amount: 280.0,due_date: "2025-11-24",},
  {id: "4",receipt: "REC-004",customer_name: "Alex Ray",payment_status: "unpaid",inventory_status: "picked_up",amount: 420.0,due_date: "2025-11-28",},
  {id: "5",receipt: "REC-005",customer_name: "Maria Cruz",payment_status: "paid",inventory_status: "in_shop",amount: 300.0,due_date: "2025-11-27",},
  {id: "6",receipt: "REC-006",customer_name: "Vincent Cruz",payment_status: "unpaid",inventory_status: "in_shop",amount: 900.0,due_date: "2025-11-27",},
];

// -----------------------------
// Helpers
// -----------------------------
const getPaymentColor = (status: string) =>
  status === "paid" ? "#22C55E" : "#EF4444";

const getInventoryColor = (status: string) =>
  status === "picked_up" ? "#2563EB" : "#F59E0B";

// -----------------------------
// Main Component
// -----------------------------
export default function TransactionDeviceList() {
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(mockTransactions.length / ROWS_PER_PAGE);
  const startIndex = (page - 1) * ROWS_PER_PAGE;
  const pageData = mockTransactions.slice(startIndex, startIndex + ROWS_PER_PAGE);

  return (
    <SafeAreaView style={styles.safeArea}>
   <ScrollView style={{ flex: 1 }}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Transactions</Text>
          <View style={styles.headerAccent} />
         </View>
        <Text style={styles.breadcrumbs}>Dashboard / Transactions</Text>

      </View>

      {/* Table Container */}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.colReceipt}>Receipt</Text>
          <Text style={styles.colName}>Customer</Text>
          <Text style={styles.colAmt}>Amount</Text>
          <Text style={styles.colStatus}>Status</Text>
          <Text style={styles.colAction}>Action</Text>
        </View>

        {/* Table Rows */}
        <View style={styles.tableBody}>
  {pageData.map((item, index) => (
    <View
      key={item.id}
      style={[
        styles.tableRow,
        index < pageData.length - 1 && styles.rowDivider,
      ]}
    >
      <Text style={styles.colReceiptText}>{item.receipt}</Text>
      <Text style={styles.colNameText}>{item.customer_name}</Text>
      <Text style={styles.colAmtText}>₱{item.amount.toFixed(2)}</Text>

      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getPaymentColor(item.payment_status) + "20" },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            { color: getPaymentColor(item.payment_status) },
          ]}
        >
          {item.payment_status.toUpperCase()}
        </Text>
      </View>

      <View style={styles.colActionContainer}>
  <TouchableOpacity
    style={styles.actionBtn}
    onPress={() => setSelected(item)}
  >
    <Ionicons name="eye-outline" size={20} color="#1e293b" />
  </TouchableOpacity>
</View>

    </View>
  ))}
</View>

{/* Pagination (must be outside the map) */}
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
    <Text style={styles.pageNumber}>Page {page} of {totalPages}</Text>
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
      {/* Modal */}
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
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalContent}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Receipt ID:</Text>
                    <Text style={styles.modalValue}>{selected.receipt}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Customer:</Text>
                    <Text style={styles.modalValue}>{selected.customer_name}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Amount:</Text>
                    <Text style={styles.modalValue}>₱{selected.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Payment Status:</Text>
                    <View style={[styles.modalStatusBadge, { backgroundColor: getPaymentColor(selected.payment_status) + '20' }]}>
                      <Text style={[styles.modalStatusText, { color: getPaymentColor(selected.payment_status) }]}>
                        {selected.payment_status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Inventory Status:</Text>
                    <View style={[styles.modalStatusBadge, { backgroundColor: getInventoryColor(selected.inventory_status) + '20' }]}>
                      <Text style={[styles.modalStatusText, { color: getInventoryColor(selected.inventory_status) }]}>
                        {selected.inventory_status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Due Date:</Text>
                    <Text style={styles.modalValue}>{selected.due_date}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelected(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
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

// -----------------------------
// Styles
// -----------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
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
  },
  headerContent: {
    position: "relative",
  },
  headerTitle: {
    fontSize: 28,
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
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#e2e8f0",
  },
  tableBody: {
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  colReceipt: {
    width: "25%",
    fontWeight: "700",
    fontSize: 13,
    color: "#475569",
    letterSpacing: 0.3,
  },
  colName: {
    width: "30%",
    fontWeight: "700",
    fontSize: 13,
    color: "#475569",
    letterSpacing: 0.3,
  },
  colAmt: {
    width: "20%",
    fontWeight: "700",
    fontSize: 13,
    color: "#475569",
    letterSpacing: 0.3,
  },
  colStatus: {
    width: "25%",
    fontWeight: "700",
    fontSize: 13,
    color: "#475569",
    letterSpacing: 0.3,
  },
  colReceiptText: {
    width: "25%",
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "600",
  },
  colNameText: {
    width: "30%",
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  colAmtText: {
    width: "20%",
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "700",
  },
  statusBadge: {
    width: "25%",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  disabledBtn: {
    backgroundColor: "#cbd5e1",
    shadowOpacity: 0,
    elevation: 0,
  },
  pageText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  disabledText: {
    color: "#94a3b8",
  },
  pageNumberContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  pageNumber: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1e293b",
    letterSpacing: 0.3,
  },
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
  modalTitle: {
    fontWeight: "800",
    fontSize: 22,
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 20,
    color: "#64748b",
    fontWeight: "600",
  },
  modalContent: {
    padding: 24,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.2,
  },
  modalValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    letterSpacing: 0.2,
  },
  modalStatusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
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
  closeBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  breadcrumbs: {
  marginTop: 10,
  fontSize: 14,
  color: "#64748b",
  textAlign: "center",
  fontWeight: "600",
},
colAction: {
  width: "15%",
  fontWeight: "700",
  fontSize: 13,
  color: "#475569",
  letterSpacing: 0.3,
  textAlign: "center",
},

colActionContainer: {
  width: "15%",
  justifyContent: "center",
  alignItems: "center",
},

actionBtn: {
  padding: 8,
  backgroundColor: "#f1f5f9",
  borderRadius: 10,
},

});