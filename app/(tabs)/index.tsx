import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, StatusBar, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '../../constants/theme';

export default function LostAndFoundScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, 'lost_found'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = items.filter(item => {
    const matchSearch = item.title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || item.type === filter;
    return matchSearch && matchFilter;
  });

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.image} />}
      <View style={styles.cardContent}>
        <View style={styles.badgeRow}>
          <LinearGradient
            colors={item.type === 'lost' ? Gradients.lostBadge : Gradients.foundBadge}
            style={styles.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.badgeText}>{item.type === 'lost' ? '● LOST' : '✓ FOUND'}</Text>
          </LinearGradient>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.metaText}>{item.location}</Text>
          <Ionicons name="time-outline" size={13} color={Colors.textMuted} style={{ marginLeft: 10 }} />
          <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search lost & found..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {['all', 'lost', 'found'].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.pill, filter === f && styles.pillActive]}>
            {filter === f
              ? <LinearGradient colors={Gradients.primary} style={styles.pillGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.pillTextActive}>{f === 'all' ? 'All Items' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                </LinearGradient>
              : <Text style={styles.pillText}>{f === 'all' ? 'All Items' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            }
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No items found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fabWrapper} onPress={() => router.push('/post-item')}>
        <LinearGradient colors={Gradients.primary} style={styles.fab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={28} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15, marginLeft: 10 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  pill: {
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  pillActive: { borderColor: 'transparent' },
  pillGradient: { paddingHorizontal: 16, paddingVertical: 8 },
  pillText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 8 },
  pillTextActive: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: 18, marginBottom: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  image: { width: '100%', height: 180, resizeMode: 'cover' },
  cardContent: { padding: 16 },
  badgeRow: { marginBottom: 10 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: Colors.textMuted, marginLeft: 4 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: Colors.textMuted, fontSize: 16, marginTop: 12 },
  fabWrapper: { position: 'absolute', bottom: 24, right: 24 },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
});
