import { useAuth } from "@/contexts/AuthContext";
import { useBranchPages } from "@/contexts/BranchPagesContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../../config/api";

const { width } = Dimensions.get('window');

export default function RevenueDashboard() {
  const [revenueView, setRevenueView] = useState("weekly");
  const router = useRouter();
  const { token } = useAuth();
  const { setBranch } = useBranchPages();
  const { branchId, branchName } = useLocalSearchParams<{ branchId?: string; branchName?: string }>();

  useEffect(() => {
    setBranch(branchId ?? null, branchName ?? null);
  }, [branchId, branchName, setBranch]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    value: 0,
    visible: false
  });

  const loadBranchTransactions = useCallback(async () => {
    setFetchError(null);
    try {
      if (!token) {
        setReceipts([]);
        setFetchError("You are not signed in. Please log in again.");
        return;
      }

      const response = await fetch(`${API_URL}/transactions?include_archived=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        setReceipts([]);
        setFetchError(`Could not load branch data (error ${response.status}).`);
        return;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setReceipts([]);
        setFetchError("Received an invalid response from the server.");
        return;
      }

      const list = Array.isArray(data) ? data : [];
      const branchTx = list.filter(
        (txn: any) => String(txn.branch_id) === String(branchId || "")
      );
      setReceipts(branchTx);
    } catch (error) {
      console.log(error);
      setReceipts([]);
      setFetchError("Something went wrong. Check your connection and try again.");
    }
  }, [branchId, token]);

  useFocusEffect(
    useCallback(() => {
      loadBranchTransactions();
    }, [loadBranchTransactions])
  );

  const now = new Date();
  const weeklyRevenueData = [0, 0, 0, 0, 0, 0, 0];
  const monthlyRevenueData = [0, 0, 0, 0];

  receipts.forEach((txn) => {
    const created = new Date(txn.created_at || now);
    const amount = Number(txn.amount || 0);

    const monday = new Date(now);
    const day = monday.getDay();
    const diffToMonday = (day + 6) % 7;
    monday.setDate(monday.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((created.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      weeklyRevenueData[diffDays] += amount;
    }

    if (created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) {
      const bucket = Math.min(3, Math.floor((created.getDate() - 1) / 7));
      monthlyRevenueData[bucket] += amount;
    }
  });

  const dailyRevenueData = useMemo(() => {
    const dailyData = [0, 0, 0, 0, 0, 0, 0];
    receipts.forEach((txn) => {
      const created = new Date(txn.created_at || now);
      const amount = Number(txn.amount || 0);
      const dayDiff = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff >= 0 && dayDiff < 7) {
        dailyData[6 - dayDiff] += amount;
      }
    });
    return dailyData;
  }, [receipts]);

  const yearlyRevenueData = useMemo(() => {
    const yearlyData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    receipts.forEach((txn) => {
      const created = new Date(txn.created_at || now);
      const amount = Number(txn.amount || 0);
      if (created.getFullYear() === now.getFullYear()) {
        yearlyData[created.getMonth()] += amount;
      }
    });
    return yearlyData;
  }, [receipts]);

  const currentRevenue = revenueView === "weekly" ? weeklyRevenueData : monthlyRevenueData;
  const currentLabels = revenueView === "weekly" 
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] 
    : ["W1", "W2", "W3", "W4"];

    const finalRevenue = revenueView === "daily" 
      ? dailyRevenueData 
      : revenueView === "yearly" 
        ? yearlyRevenueData 
        : currentRevenue;

    const finalLabels = revenueView === "daily"
      ? ["7d", "6d", "5d", "4d", "3d", "2d", "1d"]
      : revenueView === "yearly"
        ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        : currentLabels;

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
            <Text style={styles.headerTitle}>{branchName ? `${branchName} Dashboard` : "Branch Dashboard"}</Text>
            <View style={styles.headerAccent} />
          </View>
           </View>

        {fetchError ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorBannerText}>{fetchError}</Text>
            <TouchableOpacity
              style={styles.errorRetryButton}
              onPress={() => loadBranchTransactions()}
              activeOpacity={0.8}
            >
              <Text style={styles.errorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
                <TouchableOpacity
                  style={[styles.filterButton, revenueView === "daily" && styles.filterBtnActive]}
                  onPress={() => setRevenueView("daily")}
                >
                  <Text style={[styles.filterText, revenueView === "daily" && styles.filterTextActive]}>
                    Daily
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, revenueView === "yearly" && styles.filterBtnActive]}
                  onPress={() => setRevenueView("yearly")}
                >
                  <Text style={[styles.filterText, revenueView === "yearly" && styles.filterTextActive]}>
                    Yearly
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
                    ₱{Number(tooltipPos.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}

              <LineChart
                data={{
                    labels: finalLabels,
                    datasets: [{ data: finalRevenue }],
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
                  decimalPlaces: 2,
                  color: () => `rgba(59, 130, 246, 1)`,
                  labelColor: () => `#64748b`,
                  propsForBackgroundLines: { stroke: "#e2e8f0", strokeWidth: 1 },
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: "#3b82f6"
                  },
                  formatYLabel: (y: string) => `₱${Number(y).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }}
                bezier
                formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
              key={String(r.id)}
              style={[styles.tableRow, i !== receipts.length - 1 && styles.tableRowBorder]}
            >
              <Text style={[styles.tableCell, { flex: 1 }]}>{r.receipt || r.id}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{r.customer_name || 'Unknown'}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{String(r.payment_status || '').toUpperCase()}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>₱{Number(r.amount || 0).toFixed(2)}</Text>
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

  errorBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '600',
    marginBottom: 12,
  },
  errorRetryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  errorRetryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
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
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 0,
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