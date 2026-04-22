import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  StatusBar, ScrollView, Image, Dimensions, Platform, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const GRID_ITEM = (width - 36 - 8) / 2; // 2 columns with padding

type Post = {
  id: string;
  title: string;
  imageUrl?: string;
  price?: number;
  status?: string;
  type?: string;
  category?: string;
  collection: 'marketplace' | 'lost_found' | 'skills';
};

type TabKey = 'posts' | 'saved' | 'archives';

export default function ProfileScreen() {
  const { profile, signOutUser, isLoading, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [counts, setCounts] = useState({ posts: 0, sold: 0, skills: 0 });

  // ------------------------------------------------------------------
  //  Fetch real counts (marketplace + lost_found + skills)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user || user.uid === 'guest-user-123') return;
    const uid = user.uid;

    const fetch = async () => {
      try {
        const [marketSnap, lostSnap, skillSnap] = await Promise.all([
          getDocs(query(collection(db, 'marketplace'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'lost_found'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'skills'), where('userId', '==', uid))),
        ]);

        const soldCount = marketSnap.docs.filter(d => d.data().status === 'sold').length;

        setCounts({
          posts: marketSnap.size + lostSnap.size,
          sold: soldCount,
          skills: skillSnap.size,
        });
      } catch (error) {
        console.warn('📊 [Profile] Stats fetch error:', error);
      }
    };

    fetch();
  }, [user]);

  // ------------------------------------------------------------------
  //  Fetch posts for selected tab
  // ------------------------------------------------------------------
  const fetchTabPosts = useCallback(async (tab: TabKey) => {
    if (!user || user.uid === 'guest-user-123') return;
    const uid = user.uid;
    setLoadingPosts(true);

    try {
      let all: Post[] = [];

      if (tab === 'posts') {
        const [mSnap, lSnap, sSnap] = await Promise.all([
          getDocs(query(collection(db, 'marketplace'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'lost_found'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'skills'), where('userId', '==', uid))),
        ]);
        mSnap.forEach(d => all.push({ id: d.id, ...d.data() as any, collection: 'marketplace' }));
        lSnap.forEach(d => all.push({ id: d.id, ...d.data() as any, collection: 'lost_found' }));
        sSnap.forEach(d => all.push({ id: d.id, ...d.data() as any, collection: 'skills' }));
      }

      if (tab === 'archives') {
        const mSnap = await getDocs(
          query(collection(db, 'marketplace'), where('userId', '==', uid), where('status', '==', 'sold'))
        );
        mSnap.forEach(d => all.push({ id: d.id, ...d.data() as any, collection: 'marketplace' }));
      }

      // Sort all results by createdAt descending in memory to avoid Index requirements
      all.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      // 'saved' would require a savedItems subcollection – show empty for now
      setPosts(all);
    } catch (error) {
      console.warn('📊 [Profile] Post fetch error:', error);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTabPosts(activeTab);
  }, [activeTab, fetchTabPosts]);

  // ------------------------------------------------------------------
  //  Handlers
  // ------------------------------------------------------------------
  const handleSignOut = async () => {
    try { await signOutUser(); } catch {}
    router.replace('/(auth)/login');
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
  };

  // ------------------------------------------------------------------
  //  Loading screen
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const initials = profile?.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase() || 'S';

  const settingsItems = [
    { icon: 'chatbubbles', label: 'My Messages', route: '/messages' },
    { icon: 'shield-half', label: 'Privacy & Safety', route: '/settings' },
    ...(__DEV__ ? [{ icon: 'hammer', label: 'Admin Dashboard', route: '/admin' }] : []),
  ];

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'posts', label: 'My Posts' },
    { key: 'saved', label: 'Saved' },
    { key: 'archives', label: 'Archives' },
  ];

  // ------------------------------------------------------------------
  //  Render
  // ------------------------------------------------------------------
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
      >
        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topBarLeft}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.topBarAvatar} />
            ) : (
              <LinearGradient colors={Gradients.primary} style={styles.topBarAvatar}>
                <Text style={styles.topBarInitial}>{initials[0]}</Text>
              </LinearGradient>
            )}
            <Text style={styles.topBarName}>{profile?.name?.split(' ')[0] || 'Campus'} {profile?.name?.split(' ')[1] || 'Member'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} style={styles.bellBtn}>
            <Ionicons name="settings-outline" size={24} color={Colors.on_background} />
          </TouchableOpacity>
        </View>

        {/* ── Avatar + name + badge ── */}
        <View style={styles.heroSection}>
          {/* Avatar ring */}
          <TouchableOpacity 
            style={styles.avatarRing} 
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              style={styles.avatarRingGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={styles.avatarInner}>
                {profile?.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <LinearGradient colors={Gradients.primary} style={styles.avatarImg}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </LinearGradient>
                )}
              </View>
            </LinearGradient>
            {/* Verified badge */}
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
            </View>
          </TouchableOpacity>

          <Text style={styles.heroName}>{profile?.name || 'Campus Member'}</Text>

          {/* College chip */}
          <View style={styles.collegeChip}>
            <Ionicons name="school" size={13} color={Colors.secondary} style={{ marginRight: 4 }} />
            <Text style={styles.collegeText}>
              {profile?.collegeName || profile?.college || 'College'} • {profile?.gradYear ? profile.gradYear.toString().slice(-2) : new Date().getFullYear().toString().slice(-2)}
            </Text>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{counts.posts}</Text>
            <Text style={styles.statLbl}>Posts</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{counts.sold}</Text>
            <Text style={styles.statLbl}>Sold</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{counts.skills}</Text>
            <Text style={styles.statLbl}>Skills</Text>
          </View>
        </View>

        {/* ── Tab filter ── */}
        <View style={styles.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              onPress={() => handleTabChange(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Post Grid ── */}
        {loadingPosts ? (
          <View style={styles.gridLoader}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyGrid}>
            <Ionicons name="images-outline" size={48} color={Colors.on_surface_variant} />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {posts.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={styles.gridCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (item.collection === 'marketplace') {
                    router.push({ pathname: '/market-details/[id]', params: { id: item.id } } as any);
                  } else if (item.collection === 'lost_found') {
                    router.push({ pathname: '/item-details/[id]', params: { id: item.id } } as any);
                  } else if (item.collection === 'skills') {
                    router.push({ pathname: '/skill-details/[id]', params: { id: item.id } } as any);
                  }
                }}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.gridImg} />
                ) : (
                  <LinearGradient colors={Gradients.card} style={styles.gridImgPlaceholder}>
                    <Ionicons
                      name={item.collection === 'skills' ? 'flash' : item.collection === 'lost_found' ? 'search' : 'bag'}
                      size={32}
                      color={Colors.on_surface_variant}
                    />
                  </LinearGradient>
                )}
                {/* Price or Type badge */}
                {item.price && (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>₹{item.price}</Text>
                  </View>
                )}
                {item.collection === 'skills' && (
                  <View style={[styles.priceBadge, styles.serviceBadge]}>
                    <Text style={styles.priceBadgeText}>Service</Text>
                  </View>
                )}
                {item.collection === 'lost_found' && (
                  <View style={[styles.priceBadge, { backgroundColor: item.type === 'lost' ? Colors.error : Colors.success }]}>
                    <Text style={[styles.priceBadgeText, { opacity: 1 }]}>{(item.type || 'item').toUpperCase()}</Text>
                  </View>
                )}
                {item.status === 'sold' && (
                  <View style={styles.soldOverlay}>
                    <Text style={styles.soldOverlayText}>SOLD</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Settings section ── */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <View style={styles.settingsList}>
            {settingsItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.settingsItem, i < settingsItems.length - 1 && styles.settingsItemBorder]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
              >
                <View style={styles.settingsIconBox}>
                  <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
                </View>
                <Text style={styles.settingsLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.on_surface_variant} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Sign out ── */}
        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <LinearGradient
              colors={['#3a1010', '#2a0808']}
              style={styles.signOutGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scrollContent: {},

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarAvatar: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  topBarInitial: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  topBarName: { fontSize: 16, fontWeight: '700', color: Colors.on_background, fontFamily: 'PlusJakartaSans_700Bold' },
  bellBtn: { padding: 4 },

  // ── Hero ──
  heroSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 20 },
  avatarRing: { position: 'relative', marginBottom: 14 },
  avatarRingGrad: {
    width: 108, height: 108, borderRadius: 54,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: Colors.background,
    borderRadius: 12, padding: 1,
  },
  heroName: {
    fontSize: 26, fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: Colors.on_background,
    marginBottom: 6,
  },
  collegeChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(107,82,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20,
  },
  collegeText: {
    color: Colors.secondary, fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    backgroundColor: Colors.surface_container,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    ...Shadows.ambient,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  statNum: {
    fontSize: 24, fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: Colors.on_background,
  },
  statLbl: {
    fontSize: 11, color: Colors.on_surface_variant,
    fontFamily: 'Manrope_500Medium',
    marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // ── Tabs ──
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: Colors.surface_container_low,
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabLabel: {
    fontSize: 13, color: Colors.on_surface_variant,
    fontFamily: 'Manrope_600SemiBold',
  },
  tabLabelActive: { color: '#fff' },

  // ── Grid ──
  gridLoader: { height: 160, justifyContent: 'center', alignItems: 'center' },
  emptyGrid: {
    height: 160, justifyContent: 'center', alignItems: 'center', gap: 12,
    marginHorizontal: 18,
  },
  emptyText: { color: Colors.on_surface_variant, fontSize: 14, fontFamily: 'Manrope_500Medium' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 18, gap: 8,
    marginBottom: 28,
  },
  gridCard: {
    width: GRID_ITEM, height: GRID_ITEM,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: Colors.surface_container,
    position: 'relative',
  },
  gridImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  gridImgPlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  priceBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(10,10,18,0.75)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  priceBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Manrope_700Bold', opacity: 0.95 },
  serviceBadge: { backgroundColor: 'rgba(107,82,255,0.7)' },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  soldOverlayText: {
    color: '#fff', fontSize: 16, fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 2,
  },

  // ── Settings ──
  settingsSection: { marginHorizontal: 18, marginBottom: 24 },
  settingsTitle: {
    fontSize: 20, fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: Colors.on_background,
    marginBottom: 12,
  },
  settingsList: {
    backgroundColor: Colors.surface_container_low,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    gap: 14,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  settingsIconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(107,82,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  settingsLabel: {
    flex: 1, fontSize: 15, color: Colors.on_background,
    fontFamily: 'Manrope_600SemiBold',
  },

  // ── Sign out ──
  signOutSection: { marginHorizontal: 18, marginBottom: 12 },
  signOutBtn: { borderRadius: 16, overflow: 'hidden' },
  signOutGrad: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 10,
    paddingVertical: 18,
  },
  signOutText: {
    color: Colors.error, fontSize: 16, fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
