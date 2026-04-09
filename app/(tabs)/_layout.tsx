import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';

type TabIconProps = {
  focused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
};

const TabIcon = ({ focused, iconName, label, color }: TabIconProps) => (
  <View style={styles.tabItem}>
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={focused ? iconName : (`${iconName}-outline` as keyof typeof Ionicons.glyphMap)}
        size={20}
        color={color}
      />
    </View>
    <Text style={[styles.label, { color }]}>{label}</Text>
  </View>
);

type PostIconProps = {
  focused: boolean;
  color: string;
};

const PostIcon = ({ focused, color }: PostIconProps) => (
  <View style={styles.tabItem}>
    <View style={[styles.postCircle, focused && styles.postCircleActive]}>
      <Ionicons name="add" size={22} color={focused ? '#FFF' : color} />
    </View>
    <Text style={[styles.label, { color }]}>POST</Text>
  </View>
);

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6B52FF',
        tabBarInactiveTintColor: '#6B7280',
        tabBarShowLabel: false,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#09090B',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.07)',
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          height: 56,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} iconName="home" label="HOME" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lost-found"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} iconName="search" label="FIND" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <PostIcon focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} iconName="bag" label="SHOP" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} iconName="person" label="ME" color={color} />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 36,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(107, 82, 255, 0.15)',
  },
  postCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postCircleActive: {
    backgroundColor: '#6B52FF',
    borderColor: '#6B52FF',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});