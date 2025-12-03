import React, { useState } from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Pressable,} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useRouter } from "expo-router";
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const chartPadding = isSmallScreen ? 40 : 60;
const chartWidth = screenWidth - chartPadding;

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
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Weekly Revenue Data
  const weeklyRevenueData = [20000, 85000, 45000, 15000, 5000, 35000, 55000,];
  const weeklyLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",];

  const monthlyRevenueData = [100000, 200000, 300000, 400000];
  const monthlyLabels = ["W1", "W2", "W3", "W4"];

  const currentRevenue = revenueView === "weekly" ? weeklyRevenueData : monthlyRevenueData;
  const currentLabels = revenueView === "weekly" ? weeklyLabels : monthlyLabels;

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
  
  const currentBranchValues = branchView === "weekly" ? weeklyBranchData : monthlyBranchData;
  const currentBranchLabels = branchView === "weekly" ? weeklyBranchLabels : monthlyBranchLabels;
  
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

            {/* Pressable wrapping the chart */}
            <Pressable
              onPressIn={() => setTooltipPos(prev => ({ ...prev, visible: true }))}
              onPressOut={() => setTooltipPos(prev => ({ ...prev, visible: false }))}
              style={{}}
            >
              <LineChart
                data={{
                  labels: currentLabels,
                  datasets: [{ data: currentRevenue }],
                }}
                width={chartWidth}
                height={200}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => `rgba(59, 130, 246, 1)`,
                  labelColor: () => `#64748b`,
                  formatYLabel: y => `₱${parseInt(y).toLocaleString()}`,
                  propsForBackgroundLines: {
                    stroke: "#00000051",
                    strokeWidth: 1,
                  },
                }}
                bezier
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
          </View>
        </View>

        {/* BRANCH PERFORMANCE - Separate Container */}
        <View style={styles.branchPerformanceBox}>
          <View style={styles.branchPerformanceHeader}>
            <Text style={styles.branchPerformanceTitle}>Branch Performance</Text>
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
            </View>
          </View>
          <View style={styles.barChartWrapper}>
            <BarChart
              data={{
                labels: currentBranchLabels,
                datasets: [{ data: currentBranchValues }]
              }}
              width={chartWidth}
              height={isSmallScreen ? 260 : 300}
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                barPercentage: currentBranchLabels.length > 10 ? 0.4 : 0.6,
                propsForBackgroundLines: {
                  strokeDasharray: "",
                  stroke: "#e2e8f0",
                  strokeWidth: 1,
                },
              }}
              style={styles.barChart}
              fromZero={true}
              yAxisLabel=""
              yAxisSuffix="  orders"
              segments={4}
              showValuesOnTopOfBars={true}
            />
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
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
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
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  branchPerformanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  branchPerformanceTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  barChartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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