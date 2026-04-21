import { useAuth } from '@/contexts/AuthContext';
import { BranchPagesProvider } from '@/contexts/BranchPagesContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';

export default function BranchPagesLayout() {
  const { token } = useAuth();

  if (!token) {
    return <Redirect href="/(openingApps)/login" />;
  }

  return (
    <BranchPagesProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      {/* Dashboard by Account */}
      <Tabs.Screen
        name="dashboardbyaccount"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Ionicons name="speedometer-outline" size={26} color={color} />
          ),
        }}
      />

      {/* Transaction */}
      <Tabs.Screen
        name="transaction"
        options={{
          title: 'Transaction',
          tabBarIcon: ({ color }) => (
            <Ionicons name="receipt-outline" size={26} color={color} />
          ),
        }}
      />

      {/* Reports */}
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => (
            <Ionicons name="bar-chart-outline" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
    </BranchPagesProvider>
  );
}
