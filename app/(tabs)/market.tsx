import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors, Fonts, Gradients, Roundness, Shadows, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../firebaseConfig';
import { consumeMarketTab } from '../../utils/marketTabStore';

const { width } = Dimensions.get('window');

export default function MarketScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Market' | 'Skills'>('Market');
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      const tab = consumeMarketTab();
      if (tab) setActiveTab(tab);
    }, [])
  );
  const uid = auth.currentUser?.uid;
  const { profile } = useAuth();

  const categories = activeTab === 'Market'
    ? ['All', 'Textbooks', 'Electronics', 'Furniture', 'Apparel', 'Services']
    : ['All', 'Tutoring', 'Tech', 'Arts', 'Fitness'];

  useEffect(() => {
    if (!profile?.collegeId) return;
    setLoading(true);

    const marketQ = query(collection(db, 'marketplace'), where('collegeId', '==', profile.collegeId), orderBy('createdAt', 'desc'));
    const unsubMarket = onSnapshot(marketQ, (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const skillsQ = query(collection(db, 'skills'), where('collegeId', '==', profile.collegeId), orderBy('createdAt', 'desc'));
    const unsubSkills = onSnapshot(skillsQ, (snap) => {
      setSkills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubMarket(); unsubSkills(); };
  }, [profile?.collegeId]);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'marketplace', id), {
        status: currentStatus === 'sold' ? 'available' : 'sold'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = useMemo(() => {
    const source = activeTab === 'Market' ? products : skills;
    return source.filter(p => {
      const matchCat = category === 'All' || p.category === category || (activeTab === 'Market' && category === 'Textbooks' && p.category === 'Books');
      const matchSearch = p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, skills, activeTab, category, searchQuery]);

  const renderItem = ({ item }: { item: any }) => {
    const isSold = item.status === 'sold';
    const isSkill = activeTab === 'Skills';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: isSkill ? '/skill-details/[id]' : '/market-details/[id]', params: { id: item.id } } as any)}
        style={[styles.card, isSold && styles.cardSold]}
      >
        <View style={styles.imageBox}>
          {item.imageUrl || item.videoUrl || (item.imageUrls && item.imageUrls.length > 0) ? (
            <Image source={{ uri: item.imageUrl || item.videoUrl || item.imageUrls[0] }} style={[styles.image, isSold && { opacity: 0.4 }]} />
          ) : (
            <LinearGradient colors={isSkill ? Gradients.secondary : Gradients.primary} style={styles.imagePlaceholder}>
              <Ionicons name={isSkill ? "school" : "cart"} size={32} color={Colors.on_primary} />
            </LinearGradient>
          )}

          <View style={styles.priceContainer}>
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>{isSkill && item.type === 'offer' ? '₹' : isSkill ? 'LF' : '₹'}{isSkill && item.type === 'request' ? 'Request' : item.price}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.heartBtn} onPress={(e) => {
            e.stopPropagation();
            // Handle like logic here
          }}>
            <Ionicons name="heart" size={18} color="#FFF" />
          </TouchableOpacity>

          {isSold && (
            <View style={styles.soldOverlay}>
              <Text style={styles.soldText}>SOLD</Text>
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, isSold && { color: Colors.on_surface_variant }]} numberOfLines={1}>
            {item.title}
          </Text>

          <View style={styles.authorRow}>
            <View style={styles.authorAvatar}>
              <Ionicons name="person" size={12} color="#FFF" />
            </View>
            <Text style={styles.authorName}>{item.userName || 'Campus User'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Marketplace</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/messages')}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <View style={[styles.searchInputRow, isSearchFocused && styles.searchFocused]}>
          <Ionicons name="search" size={20} color="#666" style={{ marginLeft: 16 }} />
          <TextInput
            style={styles.globalSearch}
            placeholder={activeTab === 'Market' ? "Search textbooks, electronics..." : "Search tutoring, coding..."}
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'Market' && styles.segmentBtnActive]}
            onPress={() => { setActiveTab('Market'); setCategory('All'); }}
          >
            <Text style={[styles.segmentText, activeTab === 'Market' && styles.segmentTextActive]}>Products</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'Skills' && styles.segmentBtnActive]}
            onPress={() => { setActiveTab('Skills'); setCategory('All'); }}
          >
            <Text style={[styles.segmentText, activeTab === 'Skills' && styles.segmentTextActive]}>Skills</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {categories.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.catPill, category === c && styles.catPillActive]}
            >
              <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="cart" size={48} color={Colors.surface_container_high} />
              </View>
              <Text style={styles.emptyTitle}>Nothing Listed</Text>
              <Text style={styles.emptySub}>No items match this category yet.</Text>
            </View>
          }
        />
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#15151A',
  },
  headerTitle: { ...Typography.display, color: '#FFF', fontSize: 24, fontWeight: '700' },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchWrapper: { paddingHorizontal: 16, marginBottom: 24 },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F12',
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchFocused: { borderColor: '#4C3BC9', backgroundColor: '#1A1A20' },
  globalSearch: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingHorizontal: 12,
    fontFamily: Fonts.medium
  },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: Roundness.full, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: Roundness.full },
  segmentBtnActive: { backgroundColor: '#4C3BC9' },
  segmentText: { ...Typography.label, color: '#888', fontWeight: '600' },
  segmentTextActive: { color: '#FFF' },
  categoryWrapper: { marginBottom: 20 },
  catRow: { paddingHorizontal: 16, gap: 10 },
  catPill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Roundness.full,
    backgroundColor: '#1C1C1E',
  },
  catPillActive: { backgroundColor: '#4C3BC9' },
  catText: { ...Typography.label, color: '#888', fontSize: 13, fontWeight: '600' },
  catTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: 10, paddingBottom: 160 },
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: '#1C1C23',
    borderRadius: 32,
    overflow: 'hidden',
  },
  cardSold: { opacity: 0.7 },
  imageBox: { height: 210, position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  priceContainer: { position: 'absolute', top: 16, left: 16 },
  priceBadge: {
    backgroundColor: '#6B52FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  priceText: { ...Typography.title, color: '#FFF', fontSize: 14, fontWeight: '700' },
  heartBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center'
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center'
  },
  soldText: { fontFamily: Fonts.bold, color: '#FFF', fontSize: 20, letterSpacing: 2 },
  cardContent: { padding: 16 },
  cardTitle: { ...Typography.title, color: '#FFF', fontSize: 18, marginBottom: 8, fontWeight: '600', fontFamily: Fonts.medium },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  authorName: { ...Typography.body, color: '#888', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, padding: 40, alignItems: 'center', marginTop: 40 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { ...Typography.headline, color: '#FFF', marginBottom: 8 },
  emptySub: { ...Typography.body, color: '#888', textAlign: 'center' },
  fab: { position: 'absolute', bottom: 110, right: 20, width: 64, height: 64, borderRadius: 32, overflow: 'hidden', ...Shadows.ambient, zIndex: 999 },
  fabGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
