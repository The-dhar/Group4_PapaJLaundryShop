import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";
const ROWS_PER_PAGE = 5;

// Type Definitions
type ClerkLog = {
  id: number;
  receipt_id: string;
  clerk_name: string;
  branch: string;
  customer_name: string;
  amount: number;
  status: string;
  inventory_status: string;
  due_date: string;
};

// -----------------------------
// Helpers
// -----------------------------
const getStatusColor = (status: string) =>
  status === "paid" ? "#22C55E" : "#EF4444";

// -----------------------------
// Main Component
// -----------------------------
export default function ClerkLogsList() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<ClerkLog | null>(null);
  const [clerkLogs, setClerkLogs] = useState<ClerkLog[]>([]);

  const totalPages = Math.max(1, Math.ceil(clerkLogs.length / ROWS_PER_PAGE));
  const startIndex = (page - 1) * ROWS_PER_PAGE;
  const pageData = clerkLogs.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  React.useEffect(() => {
    const loadClerkLogs = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${API_URL}/transactions?include_archived=1`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        const mapped: ClerkLog[] = (Array.isArray(data) ? data : []).map((txn: any) => ({
          id: Number(txn.id),
          receipt_id: txn.receipt || `REC-${txn.id}`,
          clerk_name: txn.clerk_username || "Unassigned",
          branch: txn.branch_name || "Unknown branch",
          customer_name: txn.customer_name || "Unknown customer",
          amount: Number(txn.amount || 0),
          status: String(txn.payment_status || "unpaid"),
          inventory_status: String(txn.inventory_status || "").replace("_", " ").toUpperCase(),
          due_date: txn.due_date || "N/A",
        }));

        setClerkLogs(mapped);
      } catch (error) {
        console.log(error);
      }
    };

    loadClerkLogs();
  }, []);
   
  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };
  
  const handleLogout = () => {
    setOpen(false);
    router.push("/login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
     <View style={styles.header}>
             {/* LEFT SIDE: Dashboard title + underline */}
             <View style={styles.headerLeft}>
               <Text style={styles.headerText}>Clerk Logs</Text>
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

        {/* Table Container */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colReceipt}>Receipt ID</Text>
            <Text style={styles.colName}>Clerk Name</Text>
            <Text style={styles.colBranch}>Branch</Text>
            <Text style={styles.colCustomer}>Customer</Text>
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
                <Text style={styles.colReceiptText}>{item.receipt_id}</Text>
                <Text style={styles.colNameText}>{item.clerk_name}</Text>
                <Text style={styles.colBranchText}>{item.branch}</Text>
                <Text style={styles.colCustomerText}>{item.customer_name}</Text>
                
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(item.status) + "20" },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: getStatusColor(item.status) }]}
                  >
                    {item.status.toUpperCase()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setSelectedLog(item)}
                >
                  <Ionicons name="eye-outline" size={20} color="#1e293b" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Pagination */}
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
              <Text style={[styles.pageText, page === totalPages && styles.disabledText]}>
                Next
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal */}
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
                    <Text style={styles.modalLabel}>Clerk Name:</Text>
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
                    <Text style={styles.modalValue}>₱{selectedLog.amount}.00</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Payment Status:</Text>
                    <View style={[styles.modalStatusBadge, { backgroundColor: getStatusColor(selectedLog.status) + '20' }]}>
                      <Text style={[styles.modalStatusText, { color: getStatusColor(selectedLog.status) }]}>
                        {selectedLog.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Inventory Status:</Text>
                    <Text style={styles.modalValue}>{selectedLog.inventory_status}</Text>
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

// -----------------------------
// Styles
// -----------------------------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },

  headerContent: { position: "relative" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#1e293b", letterSpacing: -0.5 },
  headerAccent: { position: "absolute", bottom: -8, left: 0, width: 60, height: 4, backgroundColor: "#3b82f6", borderRadius: 2 },
  tableContainer: { margin: 20, backgroundColor: "#ffffff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12, borderWidth: 1,borderColor: "#e2e8f0", },
  tableHeader: { flexDirection: "row", paddingVertical: 18, paddingHorizontal: 20, backgroundColor: "#f8fafc", borderBottomWidth: 2, borderBottomColor: "#e2e8f0" },
  tableBody: { paddingVertical: 8 },
  tableRow: { flexDirection: "row", paddingVertical: 18, paddingHorizontal: 20, alignItems: "center", backgroundColor: "#ffffff" },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  colReceipt: { width: "15%", fontWeight: "700", fontSize: 13, color: "#475569" },
  colName: { width: "20%", fontWeight: "700", fontSize: 13, color: "#475569" },
  colBranch: { width: "15%", fontWeight: "700", fontSize: 13, color: "#475569" },
  colCustomer: { width: "20%", fontWeight: "700", fontSize: 13, color: "#475569" },
  colStatus: { width: "15%", fontWeight: "700", fontSize: 13, color: "#475569" },
  colAction: { width: "15%", fontWeight: "700", fontSize: 13, color: "#475569", textAlign: "center" },
  colReceiptText: { width: "15%", fontSize: 14, color: "#1e293b", fontWeight: "600" },
  colNameText: { width: "20%", fontSize: 14, color: "#1e293b", fontWeight: "600" },
  colBranchText: { width: "15%", fontSize: 14, color: "#1e293b", fontWeight: "500" },
  colCustomerText: { width: "20%", fontSize: 14, color: "#1e293b", fontWeight: "500" },
  statusBadge: { width: "15%", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: "center" },
  statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  eyeButton: { width: "15%", alignItems: "center" },
  pagination: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 20, paddingHorizontal: 20, gap: 16, backgroundColor: "#ffffff", borderTopWidth: 2, borderTopColor: "#e2e8f0" },
  pageBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#1e293b", borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
  disabledBtn: { backgroundColor: "#cbd5e1", shadowOpacity: 0, elevation: 0 },
  pageText: { color: "#ffffff", fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  disabledText: { color: "#94a3b8" },
  pageNumberContainer: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 2, borderColor: "#e2e8f0" },
  pageNumber: { fontWeight: "700", fontSize: 14, color: "#1e293b", letterSpacing: 0.3 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.6)", padding: 20, justifyContent: "center", alignItems: "center" },
  modalBox: { width: "100%", maxWidth: 400, backgroundColor: "#ffffff", borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontWeight: "800", fontSize: 22, color: "#1e293b", letterSpacing: -0.5 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  modalCloseText: { fontSize: 20, color: "#64748b", fontWeight: "600" },
  modalContent: { padding: 24 },
  modalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalLabel: { fontSize: 14, fontWeight: "600", color: "#64748b", letterSpacing: 0.2 },
  modalValue: { fontSize: 15, fontWeight: "700", color: "#1e293b", letterSpacing: 0.2 },
  modalStatusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  modalStatusText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  closeBtn: { margin: 24, marginTop: 8, backgroundColor: "#1e293b", padding: 16, borderRadius: 12, alignItems: "center", shadowColor: "#1e293b", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  closeBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
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
