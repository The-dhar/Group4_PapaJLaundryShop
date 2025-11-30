import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
   <Tabs
  screenOptions={{
    tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
    headerShown: false,
    tabBarButton: HapticTab,
  }}>
  
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
    title: 'Settings',
    tabBarIcon: ({ color }) => (
      <Ionicons size={28} name="settings-outline" color={color} />
    ),
  }}
/>

<Tabs.Screen
  name="profile"
  options={{
    title: 'Profile',
    tabBarIcon: ({ color }) => (
      <Ionicons size={28} name="person-outline" color={color} />
    ),
  }}
/>
</Tabs>

  );
}
