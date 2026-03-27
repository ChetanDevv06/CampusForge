import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

export default function SavedItemsScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="bookmark-outline" size={56} color={Colors.textMuted} />
      <Text style={styles.title}>Saved Items</Text>
      <Text style={styles.sub}>Items you bookmark will show up here.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  sub: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
});
