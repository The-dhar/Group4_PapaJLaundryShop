import React, { useState } from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const chartPadding = isSmallScreen ? 40 : 60;
const chartWidth = screenWidth - chartPadding;

export default function DashboardAnalytics() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [revenueView, setRevenueView] = useState("weekly");
  const [branchView, setBranchView] = useState("weekly");

  // Weekly Revenue Data
  const weeklyRevenueData = [20000, 85000, 45000, 15000, 5000, 35000, 55000, 75000, 25000, 10000];
  const weeklyLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  const monthlyRevenueData = [45000, 65000, 55000, 75000];
  const monthlyLabels = ["W1", "W2", "W3", "W4"];

  const currentRevenue = revenueView === "weekly" ? weeklyRevenueData : monthlyRevenueData;
  const currentLabels = revenueView === "weekly" ? weeklyLabels : monthlyLabels;

  // Branch Data - Weekly
  const weeklyBranchData = [3, 4, 7, 10, 3, 5, 8, 8, 3, 3, 3];
  const weeklyBranchLabels = [
    "Upper Calarian",
    "San Roque 1",
    "Pasonanca",
    "Pasonanca",
    "Lower Calarian",
    "Tumaga",
    "Lunzuran",
    "brgy sta cruz",
    "brgy sunrise)",
    "brgy santa cruz",
    "brgy santa cruz"
  ];

  // Branch Data - Monthly
  const monthlyBranchData = [15, 25, 70, 100, 40, 60, 80, 35, 35, 40];
  const monthlyBranchLabels = [
    "Upper Calarian",
    "San roque1",
    "San roque2",
    "Pasonanca",
    "Lower Calarian",
    "Tumaga",
    "Lunzuran",
    "brgy sta cruz",
    "brgy sunrise)",
    "brgy santa cruz"
  ];

  const currentBranchValues = branchView === "weekly" ? weeklyBranchData : monthlyBranchData;
  const currentBranchLabels = branchView === "weekly" ? weeklyBranchLabels : monthlyBranchLabels;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerText}>Dashboard</Text>
          <View style={styles.headerAccent} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* CARDS */}
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Sales</Text>
            <Text style={styles.cardValue}>₱1,000,505.72</Text>
            <View style={styles.cardTrend}>
              <Ionicons name="trending-up" size={16} color="#22c55e" />
              <Text style={styles.trendText}>+1,000</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Orders</Text>
            <Text style={styles.cardValue}>505</Text>
            <View style={styles.cardTrend}>
              <Ionicons name="trending-up" size={16} color="#22c55e" />
              <Text style={styles.trendText}>+100</Text>
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

          <View style={styles.chartWrapper}>
            <LineChart
              data={{
                labels: currentLabels,
                datasets: [{ data: currentRevenue }]
              }}
              width={chartWidth}
              height={isSmallScreen ? 200 : 220}
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                strokeWidth: isSmallScreen ? 2.5 : 3,
                barPercentage: 0.7,
                propsForBackgroundLines: {
                  strokeDasharray: "",
                  stroke: "#e2e8f0",
                  strokeWidth: 1,
                },
                propsForLabels: {
                  fontSize: isSmallScreen ? 10 : 12,
                },
              }}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              withDots={!isSmallScreen}
              withShadow={true}
              withVerticalLines={false}
              withHorizontalLines={true}
              segments={isSmallScreen ? 4 : 5}
            />
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
                datasets: [{
                  data: currentBranchValues
                }]
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
                barPercentage: isSmallScreen ? 0.5 : 0.6,
                propsForBackgroundLines: {
                  strokeDasharray: "",
                  stroke: "#e2e8f0",
                  strokeWidth: 1,
                },
                propsForLabels: {
                  fontSize: isSmallScreen ? 9 : 11,
                  rotation: isSmallScreen ? -45 : -30,
                },
              }}
              style={styles.barChart}
              showValuesOnTopOfBars={!isSmallScreen}
              fromZero={true}
              yAxisLabel=""
              yAxisSuffix=""
              withInnerLines={true}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              segments={isSmallScreen ? 4 : 5}
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
  },
  headerContent: {
    flex: 1,
    position: "relative",
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
  userIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cardRow: {
    flexDirection: "row",
    padding: 20,
    gap: 16,
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
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: "500",
    color: "#1e293b",
    marginBottom: 8,
    letterSpacing: -0.5,
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
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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
  chart: {
    borderRadius: 12,
    marginTop: 10,
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
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#1f2937",
    paddingVertical: 10,
  },
  navItem: {
    alignItems: "center",
  },
});
