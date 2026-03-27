import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '../../constants/theme';
import { startChat } from '../../utils/chat';

import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function LostFoundScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    const q = query(collection(db, 'lost_found'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const handleResolve = async (id: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'lost_found', id), {
        status: currentStatus === 'resolved' ? 'open' : 'resolved'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = items.filter(item => {
    const matchSearch = item.title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || item.type === filter;
    return matchSearch && matchFilter;
  });

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.status === 'resolved' && styles.cardResolved]}>
      {item.imageUrl && (
        <View>
          <Image source={{ uri: item.imageUrl }} style={[styles.image, item.status === 'resolved' && { opacity: 0.6 }]} />
          {item.status === 'resolved' && (
            <View style={styles.resolvedOverlay}>
              <Text style={styles.resolvedOverlayText}>RESOLVED</Text>
            </View>
          )}
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.badgeRow}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <LinearGradient
              colors={item.type === 'lost' ? Gradients.lostBadge : Gradients.foundBadge}
              style={styles.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.badgeText}>{item.type === 'lost' ? '● LOST' : '✓ FOUND'}</Text>
            </LinearGradient>
            {item.status === 'resolved' && (
              <View style={[styles.badge, { backgroundColor: Colors.success }]}>
                <Text style={styles.badgeText}>COMPLETED</Text>
              </View>
            )}
          </View>

          {uid === item.userId ? (
            <TouchableOpacity 
              style={[styles.actionBtn, item.status === 'resolved' && styles.actionBtnActive]} 
              onPress={() => handleResolve(item.id, item.status)}
            >
              <Ionicons name={item.status === 'resolved' ? "refresh-outline" : "checkmark-done-outline"} size={16} color={item.status === 'resolved' ? Colors.textPrimary : Colors.success} />
              <Text style={[styles.actionBtnText, item.status === 'resolved' && { color: Colors.textPrimary }]}>
                {item.status === 'resolved' ? 'Reopen' : 'Resolve'}
              </Text>
            </TouchableOpacity>
          ) : (
            uid !== item.userId && item.status !== 'resolved' && (
              <TouchableOpacity 
                style={styles.msgBtn} 
                onPress={() => startChat(item.userId, item.userEmail?.split('@')[0] || 'Student', router)}
              >
                <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                <Text style={styles.msgBtnText}>Message</Text>
              </TouchableOpacity>
            )
          )}
        </View>
        <Text style={[styles.cardTitle, item.status === 'resolved' && { color: Colors.textMuted }]}>{item.title}</Text>
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
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {['all', 'lost', 'found'].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.pill, filter === f && styles.pillActive]}>
            {filter === f
              ? <LinearGradient colors={Gradients.primary} style={styles.pillGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.pillTextActive}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                </LinearGradient>
              : <Text style={styles.pillText}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            }
          </TouchableOpacity>
        ))}
        <Text style={styles.resultCount}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
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
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>Be the first to report a lost or found item!</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8, alignItems: 'center' },
  pill: { borderRadius: 20, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  pillActive: { borderColor: 'transparent' },
  pillGradient: { paddingHorizontal: 16, paddingVertical: 8 },
  pillText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 8 },
  pillTextActive: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  resultCount: { marginLeft: 'auto', fontSize: 13, color: Colors.textMuted },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: 18, marginBottom: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  image: { width: '100%', height: 180, resizeMode: 'cover' },
  cardContent: { padding: 16 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  msgBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.bgSurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  msgBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  cardResolved: { opacity: 0.8, borderColor: Colors.success },
  resolvedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolvedOverlayText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    borderWidth: 2,
    borderColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: 'rgba(52,238,154,0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: Colors.success 
  },
  actionBtnActive: { 
    backgroundColor: Colors.bgSurface, 
    borderColor: Colors.border 
  },
  actionBtnText: { 
    color: Colors.success, 
    fontSize: 12, 
    fontWeight: '700' 
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: Colors.textMuted, marginLeft: 4 },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyText: { color: Colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },
  fabWrapper: { position: 'absolute', bottom: 24, right: 24 },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
});

