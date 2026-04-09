import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, TextInput, Platform, StatusBar
} from 'react-native';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function LostFoundScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const router = useRouter();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.collegeId) return;
    const q = query(
      collection(db, 'lost_found'), 
      where('collegeId', '==', profile.collegeId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [profile?.collegeId]);

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals: { [key: string]: number } = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 };
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval > 0) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    return 'Just now';
  };

  const filtered = items.filter(item => {
    const matchSearch = item.title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || item.type === filter;
    return matchSearch && matchFilter;
  });

  const renderItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: '/item-details/[id]', params: { id: item.id } } as any)}
        style={styles.card}
      >
        {item.imageUrl ? (
          <View style={styles.imageWrap}>
             <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
             <View style={styles.absBadges}>
               <View style={[
                  styles.typeBadge, 
                  { backgroundColor: item.type === 'lost' ? '#D9214E' : '#6B52FF' }
               ]}>
                 <Text style={styles.typeBadgeText}>{item.type?.toUpperCase()}</Text>
               </View>
             </View>
          </View>
        ) : null}

        <View style={[styles.cardInfo, !item.imageUrl && { paddingTop: Spacing.xl }]}>
          {!item.imageUrl && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
               <View style={[
                  styles.typeBadge, 
                  { backgroundColor: item.type === 'lost' ? '#D9214E' : '#6B52FF', paddingVertical: 4, paddingHorizontal: 12 }
               ]}>
                 <Text style={styles.typeBadgeText}>{item.type?.toUpperCase()}</Text>
               </View>
               <Text style={[styles.cardTime, { marginLeft: 'auto' }]}>{formatTimeAgo(item.createdAt)}</Text>
            </View>
          )}

          <View style={styles.cardTitleRow}>
             <Text style={styles.cardTitle} numberOfLines={item.imageUrl ? 1 : 2}>{item.title}</Text>
             {item.imageUrl && <Text style={styles.cardTime}>{formatTimeAgo(item.createdAt)}</Text>}
          </View>

          {!item.imageUrl && item.description && (
             <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          )}

          <View style={styles.locationRow}>
             <Ionicons name="location-outline" size={14} color="#6B52FF" />
             <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.avatar}>
           <Ionicons name="person" size={16} color="#FFF" />
        </View>
        <Text style={styles.headerTitle}>{profile?.collegeShortName || profile?.collegeName || 'Campus'}</Text>
        <TouchableOpacity>
           <Ionicons name="notifications-outline" size={20} color="#6B52FF" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: Spacing.margin, marginBottom: Spacing.md }}>
         <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#6B52FF" />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search for items..."
              placeholderTextColor={Colors.on_surface_variant}
              value={search}
              onChangeText={setSearch}
            />
         </View>
      </View>

      <View style={styles.filterContainer}>
         {[
           { id: 'all', label: 'All Items' },
           { id: 'lost', label: 'Lost' },
           { id: 'found', label: 'Found' }
         ].map(f => (
           <TouchableOpacity 
             key={f.id} 
             style={[styles.filterPill, filter === f.id && styles.filterPillActive]}
             onPress={() => setFilter(f.id)}
           >
             <Text style={[styles.filterPillText, filter === f.id && styles.filterPillTextActive]}>
                {f.label}
             </Text>
           </TouchableOpacity>
         ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 160 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100}}>
               <Ionicons name="scan-outline" size={48} color="#1A1C23" />
               <Text style={{color: '#8A8D93', marginTop: 12}}>No matching items found</Text>
            </View>
          }
        />
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.md,
    backgroundColor: '#15151A',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1E24',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  headerTitle: { ...Typography.title, color: '#FFF', fontSize: 18 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: Roundness.full,
    paddingHorizontal: Spacing.lg,
    height: 48,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  filterContainer: { flexDirection: 'row', paddingHorizontal: Spacing.margin, gap: Spacing.sm, marginBottom: Spacing.lg },
  filterPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Roundness.full, backgroundColor: '#1A1C23' },
  filterPillActive: { backgroundColor: '#6B52FF' },
  filterPillText: { ...Typography.label, color: '#A0A0A5', fontSize: 13 },
  filterPillTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: Spacing.margin, gap: 24 },
  card: { backgroundColor: '#1E1E24', borderRadius: 24, overflow: 'hidden', paddingBottom: Spacing.lg },
  imageWrap: { height: 300, width: '100%', position: 'relative', backgroundColor: '#1A1D24' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  absBadges: { position: 'absolute', top: 16, left: 16 },
  typeBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: Roundness.full },
  typeBadgeText: { ...Typography.label, color: '#FFF', fontSize: 11, letterSpacing: 1 },
  cardInfo: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { ...Typography.headline, color: '#FFF', fontSize: 18, flex: 1, marginRight: Spacing.sm },
  cardDesc: { ...Typography.body, color: '#A0A0A5', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  cardTime: { ...Typography.caption, color: '#8A8D93', fontSize: 11 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { ...Typography.caption, color: '#6B52FF', fontSize: 12 },
  fab: { 
    position: 'absolute', bottom: 100, right: 20, width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, zIndex: 999
  },
  fabGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
