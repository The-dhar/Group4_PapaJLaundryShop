import React, { useState } from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Pressable, Alert } from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useRouter } from "expo-router";
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [revenueView, setRevenueView] = useState("weekly");
  const [branchView, setBranchView] = useState("weekly");
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

  // Weekly Revenue Data
  const weeklyRevenueData = [20000, 85000, 45000, 15000, 5000, 35000, 55000,];
  const weeklyLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",];

  const monthlyRevenueData = [100000, 200000, 300000, 400000];
  const monthlyLabels = ["W1", "W2", "W3", "W4"];

  // Yearly Revenue Data (12 months)
  const yearlyRevenueData = [120000, 110000, 130000, 140000, 150000, 160000, 170000, 180000, 190000, 200000, 210000, 220000];
  const yearlyRevenueLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const currentRevenue = revenueView === "weekly" ? weeklyRevenueData : revenueView === "monthly" ? monthlyRevenueData : yearlyRevenueData;
  const currentLabels = revenueView === "weekly" ? weeklyLabels : revenueView === "monthly" ? monthlyLabels : yearlyRevenueLabels;

  const weeklyBranchData = [300, 400, 700, 1000, 300, 500, 800, 800, 300, 300, 300];
  const weeklyBranchLabels = [
    "Upper Calarian",
    "San Roque 1",
    "Pasonanca",
    "Lower Calarian",
    "Tumaga",
    "Lunzuran",
    "Brgy Sta Cruz",
    "Brgy Sunrise",
    "Brgy Santa Cruz 1",
    "Brgy Santa Cruz 2",
    "Brgy Santa Cruz 3"
  ];

  // Monthly Branch Data
  const monthlyBranchData = [10000, 25000, 30000, 40000, 50000, 60000, 10000, 35000, 10000, 40000, 50000];
  const monthlyBranchLabels = [
    "Upper Calarian",
    "San Roque 1",
    "San Roque 2",
    "Pasonanca",
    "Lower Calarian",
    "Tumaga",
    "Lunzuran",
    "Brgy Sta Cruz",
    "Brgy Sunrise",
    "Brgy Santa Cruz 1",
    "Brgy Santa Cruz 2"
  ];

  // Yearly Branch Data (same branch order as monthly)
  const yearlyBranchData = [120000, 250000, 300000, 400000, 500000, 600000, 100000, 350000, 100000, 400000, 500000];
  const yearlyBranchLabels = monthlyBranchLabels;

  const currentBranchValues = branchView === "weekly" ? weeklyBranchData : branchView === "monthly" ? monthlyBranchData : yearlyBranchData;
  const currentBranchLabels = branchView === "weekly" ? weeklyBranchLabels : branchView === "monthly" ? monthlyBranchLabels : yearlyBranchLabels;

  // Compute responsive chart widths so x-axis labels fit on narrow screens
  const revenueChartWidth = getResponsiveChartWidth(currentLabels);
  const branchComparisonChartWidth = getResponsiveChartWidth(currentBranchLabels);
  const branchPerformanceChartWidth = getResponsiveChartWidth(currentBranchLabels);
  
  const totalSales = 10001;
  const totalOrders = 505;
  const salesTrend = 1000;
  const ordersTrend = 100;
  
  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };
  
  const handleLogout = () => {
    setOpen(false);
    router.push("/login");
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

        {/* REVENUE */}
        <View style={styles.chartBox}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Revenue</Text>
            <View style={styles.headerRight}>
              <View style={styles.switchBox}>
                <TouchableOpacity 
                  onPress={() => setRevenueView("weekly")}
                  style={[styles.switchBtn, revenueView === "weekly" && styles.switchActive]}
                >
                  <Text style={[styles.switchText, revenueView === "weekly" && styles.switchTextActive]}>Weekly</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setRevenueView("monthly")}
                  style={[styles.switchBtn, revenueView === "monthly" && styles.switchActive]}
                >
                  <Text style={[styles.switchText, revenueView === "monthly" && styles.switchTextActive]}>Monthly</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setRevenueView("yearly")}
                  style={[styles.switchBtn, revenueView === "yearly" && styles.switchActive]}
                >
                  <Text style={[styles.switchText, revenueView === "yearly" && styles.switchTextActive]}>Yearly</Text>
                </TouchableOpacity>
              </View>

                {!isSmallScreen && (
                  <TouchableOpacity style={styles.printBtn} onPress={() => handlePrint('Revenue')}>
                    <Ionicons name="print-outline" size={14} color="#1e293b" />
                    <Text style={styles.printText}>Print</Text>
                  </TouchableOpacity>
                )}
            </View>
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
              <View style={styles.headerRight}>
                <View style={styles.switchBox}>
                  <TouchableOpacity 
                    onPress={() => setBranchView("weekly")}
                    style={[styles.switchBtn, branchView === "weekly" && styles.switchActive]}
                  >
                    <Text style={[styles.switchText, branchView === "weekly" && styles.switchTextActive]}>Weekly</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => setBranchView("monthly")}
                    style={[styles.switchBtn, branchView === "monthly" && styles.switchActive]}
                  >
                    <Text style={[styles.switchText, branchView === "monthly" && styles.switchTextActive]}>Monthly</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => setBranchView("yearly")}
                    style={[styles.switchBtn, branchView === "yearly" && styles.switchActive]}
                  >
                    <Text style={[styles.switchText, branchView === "yearly" && styles.switchTextActive]}>Yearly</Text>
                  </TouchableOpacity>
                </View>

                {!isSmallScreen && (
                  <TouchableOpacity style={styles.printBtn} onPress={() => handlePrint('Branch Revenue Comparison')}>
                    <Ionicons name="print-outline" size={14} color="#1e293b" />
                    <Text style={styles.printText}>Print</Text>
                  </TouchableOpacity>
                )}
              </View>
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
            <View style={styles.headerRight}>
              <View style={styles.switchBox}>
                <TouchableOpacity 
                  onPress={() => setBranchView("weekly")}
                  style={[styles.switchBtn, branchView === "weekly" && styles.switchActive]}
                >
                  <Text style={[styles.switchText, branchView === "weekly" && styles.switchTextActive]}>Weekly</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setBranchView("monthly")}
                  style={[styles.switchBtn, branchView === "monthly" && styles.switchActive]}
                >
                  <Text style={[styles.switchText, branchView === "monthly" && styles.switchTextActive]}>Monthly</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setBranchView("yearly")}
                  style={[styles.switchBtn, branchView === "yearly" && styles.switchActive]}
                >
                  <Text style={[styles.switchText, branchView === "yearly" && styles.switchTextActive]}>Yearly</Text>
                </TouchableOpacity>
              </View>

              {!isSmallScreen && (
                <TouchableOpacity style={styles.printBtn} onPress={() => handlePrint('Branch Performance')}>
                  <Ionicons name="print-outline" size={14} color="#1e293b" />
                  <Text style={styles.printText}>Print</Text>
                </TouchableOpacity>
              )}
            </View>
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
  switchBox: {
    flexDirection: "row",
    backgroundColor: "#e0e7ff",
    borderRadius: 12,
    padding: 4,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  switchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchActive: {
    backgroundColor: "#3b82f6",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  switchText: {
    color: "#6366f1",
    fontSize: 13,
    fontWeight: "600",
  },
  switchTextActive: {
    color: "#ffffff",
    fontWeight: "700",
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