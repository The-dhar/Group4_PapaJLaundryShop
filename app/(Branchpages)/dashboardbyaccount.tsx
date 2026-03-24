import { useRouter } from "expo-router";
import React, { useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

export default function RevenueDashboard() {
  const [revenueView, setRevenueView] = useState("weekly");
  const router = useRouter(); 

  const receipts = [
    { id: 'ORD-100', name: 'Johnny', status: 'Completed', total: '₱250.00' },
    { id: 'ORD-101', name: 'Khymer', status: 'Completed', total: '₱250.00' },
    { id: 'ORD-102', name: 'Rashdy', status: 'Completed', total: '₱250.00' },
    { id: 'ORD-103', name: 'Paul', status: 'Completed', total: '₱250.00' },
    { id: 'ORD-104', name: 'Shadla', status: 'Completed', total: '₱250.00' },
    { id: 'ORD-105', name: 'Amani', status: 'Completed', total: '₱250.00' },
    { id: 'ORD-106', name: 'Dharelle', status: 'Completed', total: '₱250.00' }
  ];

  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    value: 0,
    visible: false
  });

  const weeklyRevenueData = [20000, 85000, 45000, 15000, 5000, 35000, 55000];
  const monthlyRevenueData = [100000, 200000, 300000, 400000];

  const currentRevenue = revenueView === "weekly" ? weeklyRevenueData : monthlyRevenueData;
  const currentLabels = revenueView === "weekly" 
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] 
    : ["W1", "W2", "W3", "W4"];

  const chartWidth = width - 32;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/(tabs)/branches")}
            activeOpacity={0.8}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Branch Dashboard</Text>
            <View style={styles.headerAccent} />
          </View>
           </View>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <Text style={styles.revenueTitle}>Revenue Overview</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterButton, revenueView === "weekly" && styles.filterBtnActive]}
                onPress={() => setRevenueView("weekly")}
              >
                <Text style={[styles.filterText, revenueView === "weekly" && styles.filterTextActive]}>
                  Weekly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, revenueView === "monthly" && styles.filterBtnActive]}
                onPress={() => setRevenueView("monthly")}
              >
                <Text style={[styles.filterText, revenueView === "monthly" && styles.filterTextActive]}>
                  Monthly
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.chartWrapper}>
            <Pressable
              onPressIn={() => setTooltipPos(prev => ({ ...prev, visible: true }))}
              onPressOut={() => setTooltipPos(prev => ({ ...prev, visible: false }))}
            >
              {tooltipPos.visible && (
                <View style={[styles.tooltip, { left: tooltipPos.x - 40, top: tooltipPos.y - 50 }]}>
                  <Text style={styles.tooltipText}>
                    ₱{tooltipPos.value.toLocaleString()}
                  </Text>
                </View>
              )}

              <LineChart
                data={{
                  labels: currentLabels,
                  datasets: [{ data: currentRevenue }],
                }}
                width={chartWidth - 48}
                height={220}
                yAxisLabel="₱"
                yAxisSuffix=""
                yLabelsOffset={10}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => `rgba(59, 130, 246, 1)`,
                  labelColor: () => `#64748b`,
                  propsForBackgroundLines: { stroke: "#e2e8f0", strokeWidth: 1 },
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: "#3b82f6"
                  }
                }}
                bezier
                style={styles.chart}
                onDataPointClick={(data) => setTooltipPos({ x: data.x, y: data.y, value: data.value, visible: true })}
              />
            </Pressable>
          </View>
        </View>

        {/* Receipts Table */}
        <View style={styles.table}>
          {/* Table Title */}
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderTitle}>Recent Transaction</Text>
          </View>

          {/* Column Headers */}
          <View style={[styles.tableRow, { backgroundColor: '#f1f5f9', paddingVertical: 8 }]}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Receipt ID</Text>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Total</Text>
          </View>

          {/* Table Rows */}
          {receipts?.map((r, i) => (
            <View
              key={r.id}
              style={[styles.tableRow, i !== receipts.length - 1 && styles.tableRowBorder]}
            >
              <Text style={[styles.tableCell, { flex: 1 }]}>{r.id}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{r.name}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{r.status}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{r.total}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },

  backIcon: {
    fontSize: 24,
    color: '#1e293b',
    fontWeight: '600',
  },

  headerContent: {
    flex: 1,
    position: 'relative',
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },

  headerAccent: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },

  revenueCard: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },

  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  revenueTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.3,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },

  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },

  filterBtnActive: {
    backgroundColor: '#3b82f6',
  },

  filterText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },

  filterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  chartWrapper: {
    alignItems: 'center',
    marginTop: 8,
  },

  chart: {
    borderRadius: 16,
  },

  tooltip: {
    position: 'absolute',
    backgroundColor: "#3b82f6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  tooltipText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },

  table: {
    margin: 16,
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },

  tableHeader: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  tableHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },

  tableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  
  tableRow: {
    flexDirection: 'row',
    padding: 18,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
  },

  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  tableCell: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
    breadcrumbs: {
  marginTop: 10,
  fontSize: 14,
  color: "#64748b",
  textAlign: "center",
  fontWeight: "600",
},
});