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
const ROWS_PER_PAGE = 5;

// -----------------------------
// Mock Data
// -----------------------------

const mockClerkLogs = [
  {
    id: "1",
    receipt_id: "REC-001",
    clerk_name: "John Doe",
    branch: "Brgy Sta Cruz",
    customer_name: "Johnny",
    amount: 300,
    status: "paid",
    inventory_status: "IN SHOP",
    due_date: "2025-12-05",
  },
  {
    id: "2",
    receipt_id: "REC-002",
    clerk_name: "Jane Smith",
    branch: "Tumaga",
    customer_name: "Rashdy",
    amount: 500,
    status: "unpaid",
    inventory_status: "IN SHOP",
    due_date: "2025-11-26",
  },
  {
    id: "3",
    receipt_id: "REC-003",
    clerk_name: "Elaine Foster",
    branch: "Brgy Santa Cruz 2",
    customer_name: "Claire",
    amount: 350,
    status: "paid",
    inventory_status: "IN SHOP",
    due_date: "2025-12-01",
  },
  {
    id: "4",
    receipt_id: "REC-0091",
    clerk_name: "Camil santos",
    branch: "Brgy Sunrise",
    customer_name: "Nadia",
    amount: 150,
    status: "paid",
    inventory_status: "IN SHOP",
    due_date: "2025-12-01",
  },
{
    id: "5",
    receipt_id: "REC-007",
    clerk_name: "Camil santos",
    branch: "Brgy Sunrise",
    customer_name: "Radia",
    amount: 170,
    status: "paid",
    inventory_status: "IN SHOP",
    due_date: "2025-12-01",
  },
{
    id: "6",
    receipt_id: "REC-009",
    clerk_name: "Carlos Mendoza",
    branch: "Lower Calarian",
    customer_name: "Shadia",
    amount: 450,
    status: "paid",
    inventory_status: "IN SHOP",
    due_date: "2025-12-01",
  },
{
    id: "7",
    receipt_id: "REC-008",
    clerk_name: "Carlos Mendoza",
    branch: "Lower Calarian",
    customer_name: "Amani",
    amount: 350,
    status: "paid",
    inventory_status: "IN SHOP",
    due_date: "2025-12-01",
  },

];

// -----------------------------
// Helpers
// -----------------------------
const getStatusColor = (status) =>
  status === "paid" ? "#22C55E" : "#EF4444";

// -----------------------------
// Main Component
// -----------------------------
export default function ClerkLogsList() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  const totalPages = Math.ceil(mockClerkLogs.length / ROWS_PER_PAGE);
  const startIndex = (page - 1) * ROWS_PER_PAGE;
  const pageData = mockClerkLogs.slice(startIndex, startIndex + ROWS_PER_PAGE);
  const router = useRouter();
  const [open, setOpen] = useState(false);
   
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
      <Modal
  visible={!!selectedLog}
  transparent
  animationType="slide"
>
  <View style={styles.modalOverlay}>
    {selectedLog && (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Receipt Details</Text>
        <Text style={styles.modalText}>Receipt ID: {selectedLog.receipt_id}</Text>
        <Text style={styles.modalText}>Customer: {selectedLog.customer_name}</Text>
        <Text style={styles.modalText}>Amount: ₱{selectedLog.amount}.00</Text>
        <Text style={styles.modalText}>
          Payment Status: {selectedLog.status.toUpperCase()}
        </Text>
        <Text style={styles.modalText}>Inventory Status: {selectedLog.inventory_status}</Text>
        <Text style={styles.modalText}>Due Date: {selectedLog.due_date}</Text>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => setSelectedLog(null)}
        >
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    )}
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
  tableContainer: { margin: 20, backgroundColor: "#ffffff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "85%", backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12, color: "#1e293b" },
  modalText: { fontSize: 16, fontWeight: "500", marginVertical: 4, color: "#334155" },
  closeBtn: { marginTop: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: "#1e293b", alignItems: "center" },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
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
