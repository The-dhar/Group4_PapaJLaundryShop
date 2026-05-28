import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Redirect, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';

export default function TabLayout() {
  const { token } = useAuth();
  const colorScheme = useColorScheme();

  if (!token) {
    return <Redirect href="/(openingApps)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="grid-outline" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="branches"
        options={{
          title: 'Branch',
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="business-outline" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Emp. Settings',
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="settings-outline" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="clerk"
        options={{
          title: 'Clerk',
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="person-outline" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="employees"
        options={{
          title: 'Employees',
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="people-outline" color={color} />
          ),
        }}
      />

      {/* Hidden tab */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />

      {/* Visible PriceManager tab */}
      <Tabs.Screen
        name="price"
        options={{
          title: "Price",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}