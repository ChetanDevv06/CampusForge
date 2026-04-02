import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';

export default function ProfileScreen() {
  const { profile, signOutUser, isLoading, user } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState({ posts: 0, skills: 0 });

  React.useEffect(() => {
    if (!user || user.uid === 'guest-user-123') return;
    
    // Fetch counts
    const fetchCounts = async () => {
      try {
        const [lostSnap, skillSnap] = await Promise.all([
          getDocs(query(collection(db, 'lost_found'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'skills'), where('userId', '==', user.uid))),
        ]);
        setCounts({ posts: lostSnap.size, skills: skillSnap.size });
      } catch (e) {}
    };
    fetchCounts();
  }, [user]);

  const handleSignOut = async () => {
    try { await signOutUser(); router.replace('/(auth)/login'); }
    catch { router.replace('/(auth)/login'); }
  };

  const menuItems = [
    ...(profile?.role === 'admin' ? [{ icon: 'shield-checkmark-outline', label: 'Platform Admin', route: '/admin' }] : []),
    { icon: 'person-outline', label: 'Edit Profile', route: '/edit-profile' },
    { icon: 'chatbubbles-outline', label: 'Messages', route: '/messages' },
    { icon: 'bookmark-outline', label: 'Saved Items', route: '/saved-items' },
    { icon: 'star-outline', label: 'My Reviews', route: '/my-reviews' },
    { icon: 'settings-outline', label: 'Settings', route: '/settings' },
  ];

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const initials = profile?.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase() || 'S';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#1C1C3A', Colors.bg]} style={styles.header}>
        <View style={styles.avatarWrapper}>
          <TouchableOpacity onPress={() => router.push('/edit-profile')}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <LinearGradient colors={Gradients.primary} style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
          <View style={styles.onlineDot} />
        </View>
        <Text style={styles.name}>{profile?.name || 'Campus Student'}</Text>
        <Text style={styles.college}>{profile?.college || 'University'}</Text>
        <Text style={styles.email}>{profile?.email || 'student@college.edu'}</Text>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { val: counts.posts.toString(), label: 'Posts' }, 
          { val: counts.skills.toString(), label: 'Skills' }, 
          { val: profile?.rating?.toFixed(1) || '5.0', label: 'Rating' }
        ].map((s, i) => (
          <View key={i} style={styles.statBox}>
            <Text style={styles.statVal}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Menu */}
      <View style={styles.section}>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={[styles.menuItem, i === menuItems.length - 1 && { borderBottomWidth: 0 }]} onPress={() => router.push(item.route as any)}>
            <View style={styles.menuIconBox}>
              <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 32, paddingHorizontal: 24 },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: Colors.border },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#FFF' },
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.bg },
  name: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  college: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  email: { fontSize: 13, color: Colors.textMuted },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: -16, marginBottom: 24,
    backgroundColor: Colors.bgCard, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, padding: 20,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  section: {
    marginHorizontal: 16, backgroundColor: Colors.bgCard,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.bgSurface, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.danger, gap: 8,
  },
  logoutText: { color: Colors.danger, fontSize: 16, fontWeight: '700' },
});
