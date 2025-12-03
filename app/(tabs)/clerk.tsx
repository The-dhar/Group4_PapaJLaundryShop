import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const ROWS_PER_PAGE = 5;

// -----------------------------
// Mock Data
// -----------------------------
const mockClerkLogs = [
  {
    id: "1",
    clerk_name: "John Doe",
    branch: "Main Branch",
    status: "paid",
  },
  {
    id: "2",
    clerk_name: "Jane Smith",
    branch: "North Branch",
    status: "unpaid",
  },
  {
    id: "3",
    clerk_name: "Carlos Mendoza",
    branch: "South Branch",
    status: "paid",
  },
  {
    id: "4",
    clerk_name: "Alex Ray",
    branch: "East Branch",
    status: "unpaid",
  },
  {
    id: "5",
    clerk_name: "Maria Cruz",
    branch: "West Branch",
    status: "paid",
  },
  {
    id: "6",
    clerk_name: "Vincent Cruz",
    branch: "Main Branch",
    status: "unpaid",
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

  const totalPages = Math.ceil(mockClerkLogs.length / ROWS_PER_PAGE);
  const startIndex = (page - 1) * ROWS_PER_PAGE;
  const pageData = mockClerkLogs.slice(startIndex, startIndex + ROWS_PER_PAGE);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Clerk Logs</Text>
            <View style={styles.headerAccent} />
          </View>
        </View>

        {/* Table Container */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Clerk Name</Text>
            <Text style={styles.colBranch}>Branch</Text>
            <Text style={styles.colStatus}>Status</Text>
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
                <Text style={styles.colNameText}>{item.clerk_name}</Text>
                <Text style={styles.colBranchText}>{item.branch}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
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
            <Text style={[styles.pageText, page === 1 && styles.disabledText]}>Prev</Text>
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
            <Text style={[styles.pageText, page === totalPages && styles.disabledText]}>Next</Text>
          </TouchableOpacity>
        </View>
        </View>
      </View>
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
  colName: {
    width: "40%",
    fontWeight: "700",
    fontSize: 13,
    color: "#475569",
    letterSpacing: 0.3,
  },
  colBranch: {
    width: "35%",
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
  colNameText: {
    width: "40%",
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "600",
  },
  colBranchText: {
    width: "35%",
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
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
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 2,
    borderTopColor: "#e2e8f0",
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
});