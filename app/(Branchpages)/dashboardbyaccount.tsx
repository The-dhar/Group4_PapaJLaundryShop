import { useRouter } from "expo-router";
import React, { useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
const { width } = Dimensions.get('window');
export default function RevenueDashboard() {
  const [activeFilter, setActiveFilter] = useState('Weekly');
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
        {/* Chart Card */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Revenue</Text>

          {/* Filter Buttons */}
          <View style={styles.filterRow}>
            {['Weekly', 'Monthly'].map((filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[
                  styles.filterButton,
                  activeFilter === filter && styles.filterBtnActive
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === filter && styles.filterTextActive
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart */}
          <View style={styles.chartWrapper}>
            <svg width="100%" height="100%" viewBox="0 0 320 200">

              {/* Y-axis Labels */}
              {[100000, 80000, 60000, 40000, 20000, 0].map((label, index) => (
                <text key={index} x="10" y={20 + index * 30} fontSize="10" fill="#666">
                  {label}
                </text>
              ))}

              {/* Grid */}
              {[20, 50, 80, 110, 140, 170].map((y, i) => (
                <line key={i} x1="50" y1={y} x2="310" y2={y} stroke="#e5e5e5" strokeWidth="1" />
              ))}

              {/* Gradient */}
              <defs>
                <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Area */}
              <path
                d="M50,50 L75,70 L100,130 L125,140 L150,120 L175,100 L200,120 L225,60 L250,80 L275,140 L300,170"
                fill="url(#areaGradient)"
              />

              {/* Line */}
              <path
                d="M50,50 L75,70 L100,130 L125,140 L150,120 L175,100 L200,120 L225,60 L250,80 L275,140 L300,170"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
              />

              {/* X-axis Labels */}
              {[0,1,2,3,4,5,6,7,8,9].map((n, i) => (
                <text
                  key={i}
                  x={50 + i * 28}
                  y="190"
                  fontSize="10"
                  textAnchor="middle"
                  fill="#666"
                >
                  {n}
                </text>
              ))}
            </svg>
          </View>
        </View>

        {/* Receipts Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Receipt ID</Text>
            <Text style={styles.tableHeaderText}>Name</Text>
            <Text style={styles.tableHeaderText}>Status</Text>
            <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Total</Text>
          </View>

          {receipts.map((r, i) => (
            <View
              key={r.id}
              style={[styles.tableRow, i !== receipts.length - 1 && styles.tableRowBorder]}
            >
              <Text style={styles.tableCell}>{r.id}</Text>
              <Text style={styles.tableCell}>{r.name}</Text>
              <Text style={styles.tableCell}>{r.status}</Text>
              <Text style={[styles.tableCell, styles.tableCellRight]}>{r.total}</Text>
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
    paddingTop: 12,
    paddingBottom: 20,
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
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },

  chartCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  chartTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterBtnActive: {
    backgroundColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  filterText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  chartWrapper: {
    marginTop: 20,
    height: 200
  },

  table: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 18,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3,
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
  tableCellRight: {
    textAlign: 'right',
    fontWeight: '700',
    color: '#1e293b',
  },
});
