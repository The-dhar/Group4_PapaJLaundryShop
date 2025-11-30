import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';

export default function BranchPagesLayout() {
  return (
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
    </Tabs>
  );
}
