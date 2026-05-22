import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Image, Dimensions, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Gradients } from '../constants/theme';

const { width } = Dimensions.get('window');

type SearchResult = {
  id: string;
  title: string;
  description?: string;
  type: 'lost' | 'found' | 'skill' | 'product';
  category?: string;
  price?: number;
  imageUrl?: string;
  createdAt: any;
};

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const router = useRouter();
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.collegeId) {
      fetchAllData();
    }
  }, [profile?.collegeId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const all: SearchResult[] = [];
      
      // 1. Lost & Found
      const lostSnap = await getDocs(query(collection(db, 'lost_found'), where('collegeId', '==', profile?.collegeId), orderBy('createdAt', 'desc')));
      lostSnap.forEach(doc => {
        const data = doc.data();
        all.push({ id: doc.id, title: data.title, description: data.description, type: data.type as any, imageUrl: data.imageUrl, createdAt: data.createdAt });
      });

      // 2. Skills
      const skillSnap = await getDocs(query(collection(db, 'skills'), where('collegeId', '==', profile?.collegeId), orderBy('createdAt', 'desc')));
      skillSnap.forEach(doc => {
        const data = doc.data();
        all.push({ id: doc.id, title: data.title, description: data.description, type: 'skill', category: data.category, createdAt: data.createdAt });
      });

      // 3. Marketplace
      const marketSnap = await getDocs(query(collection(db, 'marketplace'), where('collegeId', '==', profile?.collegeId), orderBy('createdAt', 'desc')));
      marketSnap.forEach(doc => {
        const data = doc.data();
        all.push({ id: doc.id, title: data.title, description: data.category, type: 'product', price: data.price, imageUrl: data.imageUrl, createdAt: data.createdAt });
      });

      setResults(all);
      setFilteredResults(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const term = search.toLowerCase();
    const filtered = results.filter(item => {
      const matchSearch = item.title.toLowerCase().includes(term) || item.description?.toLowerCase().includes(term);
      const matchType = filter === 'all' || 
                        (filter === 'lost_found' && (item.type === 'lost' || item.type === 'found')) ||
                        (filter === 'skills' && item.type === 'skill') ||
                        (filter === 'marketplace' && item.type === 'product');
      return matchSearch && matchType;
    });
    setFilteredResults(filtered);
  }, [search, filter, results]);

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'lost': return { colors: Gradients.lostBadge, label: 'LOST' };
      case 'found': return { colors: Gradients.foundBadge, label: 'FOUND' };
      case 'skill': return { colors: Gradients.skillOffer, label: 'SKILL' };
      case 'product': return { colors: Gradients.primary, label: 'MARKET' };
      default: return { colors: Gradients.card, label: 'ITEM' };
    }
  };

  const renderItem = ({ item }: { item: SearchResult }) => {
    const { colors, label } = getTypeStyle(item.type);
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => {
          // Navigate to appropriate tab/detail
          if (item.type === 'lost' || item.type === 'found') router.push('/(tabs)/lost-found');
          else if (item.type === 'skill') router.push('/(tabs)/skills');
          else router.push('/(tabs)/market');
        }}
      >
        <View style={styles.cardInner}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="search" size={24} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.info}>
            <View style={styles.badgeRow}>
              <LinearGradient colors={colors} style={styles.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.badgeText}>{label}</Text>
              </LinearGradient>
              {item.price && <Text style={styles.price}>₹{item.price}</Text>}
            </View>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }} 
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, skills, listings..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filters}>
        {['all', 'lost_found', 'skills', 'marketplace'].map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
              {f === 'all' ? 'All' : f.replace('_', ' ').charAt(0).toUpperCase() + f.replace('_', ' ').slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredResults}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={60} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>Try searching for something else or check your filters.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#0a0a0c',
    gap: 12
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  searchBar: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1c1c22', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  filterLabelActive: { color: '#FFF' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#1c1c22', borderRadius: 18, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', overflow: 'hidden',
  },
  cardInner: { flexDirection: 'row', padding: 12, gap: 14 },
  thumbnail: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#23232b' },
  thumbPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#23232b', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  price: { color: Colors.success, fontSize: 14, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  desc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
  empty: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 20 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8 },
});
