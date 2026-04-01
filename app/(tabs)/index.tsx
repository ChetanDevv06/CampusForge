import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, TextInput, Dimensions, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [recentSkills, setRecentSkills] = useState<any[]>([]);
  const [stats, setStats] = useState({ lost: 0, skills: 0, market: 0 });
  const [search, setSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const username = profile?.name || (user?.email as string)?.split('@')[0] || 'Student';
  const initials = username.charAt(0).toUpperCase();

  useEffect(() => {
    // Recent Lost & Found
    const lostQ = query(collection(db, 'lost_found'), orderBy('createdAt', 'desc'), limit(3));
    const unsub1 = onSnapshot(lostQ, (s) => setRecentItems(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});

    // Recent Skills
    const skillQ = query(collection(db, 'skills'), orderBy('createdAt', 'desc'), limit(3));
    const unsub2 = onSnapshot(skillQ, (s) => setRecentSkills(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});

    // Stats
    Promise.all([
      getDocs(collection(db, 'lost_found')),
      getDocs(collection(db, 'skills')),
      getDocs(collection(db, 'marketplace')),
    ]).then(([l, s, m]) => setStats({ lost: l.size, skills: s.size, market: m.size })).catch(() => {});

    // Real-time unread messages check
    let unsub3 = () => {};
    if (user?.uid) {
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid)
      );
      unsub3 = onSnapshot(q, (snap) => {
        let total = 0;
        snap.forEach(d => {
          const data = d.data();
          total += data.unreadCount?.[user.uid] || 0;
        });
        setUnreadCount(total);
      });
    }

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  const quickActions = [
    { icon: 'search-outline', label: 'Report\nLost', colors: Gradients.lostBadge, route: '/post-item', param: 'lost' },
    { icon: 'checkmark-circle-outline', label: 'Found\nSomething', colors: Gradients.foundBadge, route: '/post-item', param: 'found' },
    { icon: 'storefront-outline', label: 'Sell\nItem', colors: Gradients.primary, route: '/post-market', param: '' },
    { icon: 'bulb-outline', label: 'Share\nSkill', colors: Gradients.skillOffer, route: '/post-skill', param: '' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Hero Header */}
        <LinearGradient colors={['#1A1535', '#0A0A12']} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.username}>{username}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/messages')}>
                <Ionicons name="chatbubble-outline" size={22} color={Colors.textPrimary} />
                {unreadCount > 0 && <View style={styles.notifDot} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                {profile?.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatarSmallImage} />
                ) : (
                  <LinearGradient colors={Gradients.primary} style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{initials}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items, skills, listings..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onFocus={() => router.push('/search')}
            />
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          {[
            { label: 'Items Reported', value: stats.lost, icon: 'flag-outline', colors: Gradients.lostBadge, route: '/(tabs)/lost-found' },
            { label: 'Skills Listed', value: stats.skills, icon: 'flash-outline', colors: Gradients.skillOffer, route: '/(tabs)/skills' },
            { label: 'On Market', value: stats.market, icon: 'storefront-outline', colors: Gradients.primary, route: '/(tabs)/market' },
          ].map((s, i) => (
            <TouchableOpacity key={i} style={styles.statCard} onPress={() => router.push(s.route as any)}>
              <LinearGradient colors={s.colors} style={styles.statIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name={s.icon as any} size={18} color="#FFF" />
              </LinearGradient>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickGrid}>
          {quickActions.map((a, i) => (
            <TouchableOpacity key={i} style={styles.quickCard} onPress={() => router.push(a.route as any)}>
              <LinearGradient colors={a.colors} style={styles.quickIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name={a.icon as any} size={26} color="#FFF" />
              </LinearGradient>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Lost & Found */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Lost & Found</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/lost-found' as any)}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyCardText}>No items reported yet</Text>
          </View>
        ) : (
          recentItems.map(item => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.itemCard}
              onPress={() => router.push({ pathname: '/item-details/[id]', params: { id: item.id } } as any)}
            >
              <LinearGradient
                colors={item.type === 'lost' ? Gradients.lostBadge : Gradients.foundBadge}
                style={styles.itemBadgeIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name={item.type === 'lost' ? 'alert-circle' : 'checkmark-circle'} size={20} color="#FFF" />
              </LinearGradient>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>
                  <Ionicons name="location-outline" size={11} /> {item.location}
                </Text>
              </View>
              <View style={[styles.typePill, { backgroundColor: item.type === 'lost' ? 'rgba(255,107,107,0.15)' : 'rgba(52,238,154,0.15)' }]}>
                <Text style={[styles.typePillText, { color: item.type === 'lost' ? Colors.danger : Colors.success }]}>
                  {item.type.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Recent Skills */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Skills Exchange</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/skills' as any)}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {recentSkills.length === 0 ? (
            <View style={[styles.emptyCard, { width: width - 32 }]}>
              <Ionicons name="flash-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyCardText}>No skills posted yet</Text>
            </View>
          ) : (
            recentSkills.map(skill => (
              <TouchableOpacity 
                key={skill.id} 
                onPress={() => router.push({ pathname: '/skill-details/[id]', params: { id: skill.id } } as any)}
              >
                <LinearGradient
                  colors={skill.type === 'offer' ? ['#1C1C3A', '#13131F'] : ['#1C1A10', '#13131F']}
                  style={styles.skillCard}
                >
                  <LinearGradient
                    colors={skill.type === 'offer' ? Gradients.skillOffer : Gradients.skillRequest}
                    style={styles.skillIcon}
                  >
                    <Ionicons name={skill.type === 'offer' ? 'bulb' : 'book'} size={18} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.skillTitle}>{skill.title}</Text>
                  <Text style={styles.skillCat}>{skill.category}</Text>
                  <View style={styles.skillTypePill}>
                    <Text style={styles.skillTypeText}>{skill.type === 'offer' ? 'Teaching' : 'Learning'}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  username: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  avatarSmall: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarSmallImage: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: Colors.border },
  avatarSmallText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  statsContainer: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 16, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  quickGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 16, 
    gap: 12, 
    justifyContent: 'center' 
  },
  quickCard: {
    width: (width - 44) / 2 - 12, 
    backgroundColor: Colors.bgCard,
    borderRadius: 18, 
    padding: 18, 
    borderWidth: 1, 
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: { 
    width: 52, 
    height: 52, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  quickLabel: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: Colors.textPrimary, 
    lineHeight: 20, 
    textAlign: 'center' 
  },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.bgCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  itemBadgeIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  itemMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  typePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  typePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  skillCard: {
    width: 160, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  skillIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  skillTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  skillCat: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  skillTypePill: { backgroundColor: 'rgba(124,111,255,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  skillTypeText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  emptyCard: {
    marginHorizontal: 16, backgroundColor: Colors.bgCard, borderRadius: 16,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  emptyCardText: { color: Colors.textMuted, fontSize: 14, marginTop: 8 },
});
