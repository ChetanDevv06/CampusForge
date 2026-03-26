import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { signOutUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        try {
          const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        } catch (e) {
          console.log('Could not fetch profile (offline or Firestore not set up):', e);
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.replace('/(auth)/login');
    } catch (error) {
      console.log('Signout error:', error);
      router.replace('/(auth)/login');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.name?.charAt(0) || 'S'}</Text>
        </View>
        <Text style={styles.name}>{profile?.name || 'Student Name'}</Text>
        <Text style={styles.college}>🎓 {profile?.college || 'University'}</Text>
        <Text style={styles.email}>{auth.currentUser?.email}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>Connections</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>3</Text>
          <Text style={styles.statLabel}>Skills</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>5.0</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Account Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="chatbubbles-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Messages</Text>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="bookmark-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Saved Items</Text>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { 
    backgroundColor: '#007AFF', 
    paddingVertical: 40, 
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#007AFF' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  college: { fontSize: 16, color: '#EBF5FF', marginBottom: 2 },
  email: { fontSize: 14, color: '#BFDBFE' },
  statsContainer: {
    flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20,
    borderRadius: 16, padding: 16, marginTop: -40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  section: { backgroundColor: '#FFF', marginTop: 32, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF' },
  menuText: { flex: 1, fontSize: 16, marginLeft: 16, color: '#333' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 40, backgroundColor: '#FFF', padding: 16, marginHorizontal: 20,
    borderRadius: 12, borderWidth: 1, borderColor: '#FF3B30'
  },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: 'bold', marginLeft: 8 }
});
