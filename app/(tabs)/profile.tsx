import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';

export default function ProfileScreen() {
  const { signOutUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (snap.exists()) setProfile(snap.data());
        } catch (e) {}
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSignOut = async () => {
    try { await signOutUser(); router.replace('/(auth)/login'); }
    catch { router.replace('/(auth)/login'); }
  };

  const menuItems = [
    { icon: 'chatbubbles-outline', label: 'Messages' },
    { icon: 'bookmark-outline', label: 'Saved Items' },
    { icon: 'star-outline', label: 'My Reviews' },
    { icon: 'settings-outline', label: 'Settings' },
  ];

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const initials = profile?.name?.split(' ').map((w: string) => w[0]).join('').toUpperCase() || 'S';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#1C1C3A', Colors.bg]} style={styles.header}>
        <View style={styles.avatarWrapper}>
          <LinearGradient colors={Gradients.primary} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={styles.onlineDot} />
        </View>
        <Text style={styles.name}>{profile?.name || 'Campus Student'}</Text>
        <Text style={styles.college}>🎓 {profile?.college || 'University'}</Text>
        <Text style={styles.email}>{auth.currentUser?.email}</Text>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[{ val: '0', label: 'Posts' }, { val: '0', label: 'Skills' }, { val: '5.0', label: 'Rating' }].map((s, i) => (
          <View key={i} style={styles.statBox}>
            <Text style={styles.statVal}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Menu */}
      <View style={styles.section}>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={styles.menuItem}>
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
