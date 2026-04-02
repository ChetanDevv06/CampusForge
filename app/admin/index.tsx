import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Image, Alert, StatusBar } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Colors, Gradients } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import ModernAlert from '../../components/ModernAlert';

export default function AdminDashboard() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  // Security Check
  useEffect(() => {
    if (!profile || profile.role !== 'admin') {
      router.replace('/(tabs)');
    }
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userSnap, postSnap, marketSnap, skillSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'lost_found')),
        getDocs(collection(db, 'marketplace')),
        getDocs(collection(db, 'skills'))
      ]);

      setStats({
        users: userSnap.size,
        posts: postSnap.size + marketSnap.size + skillSnap.size,
        reports: 0 // Fetch from reports collection if implemented
      });

      // Combine for recent activity
      const all = [
        ...postSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'lost_found' })),
        ...marketSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'marketplace' })),
        ...skillSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'skills' }))
      ];
      
      all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentPosts(all.slice(0, 10));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPost) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, selectedPost.type, selectedPost.id));
      setShowDeleteAlert(false);
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to delete post.");
    } finally {
      setLoading(false);
    }
  };

  const renderStat = (label: string, value: number, icon: string, colors: [string, string]) => (
    <LinearGradient colors={colors} style={styles.statCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Ionicons name={icon as any} size={24} color="#FFF" />
      <View>
        <Text style={styles.statVal}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </LinearGradient>
  );

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postItem}>
      <View style={styles.postInfo}>
        <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.postMeta}>{item.userName} • {item.type.replace('_', ' ')}</Text>
      </View>
      <TouchableOpacity 
        style={styles.deleteCircle}
        onPress={() => {
          setSelectedPost(item);
          setShowDeleteAlert(true);
        }}
      >
        <Ionicons name="trash" size={18} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  if (loading && recentPosts.length === 0) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Admin</Text>
        <Text style={styles.headerSubtitle}>Monitor campus-wide activity</Text>
      </View>

      <View style={styles.statsGrid}>
        {renderStat("Users", stats.users, "people", ['#7C6FFF', '#5041FF'])}
        {renderStat("Posts", stats.posts, "grid", ['#FF8E53', '#FE6B8B'])}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={fetchData}>
            <Ionicons name="refresh" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        {recentPosts.length === 0 ? (
          <Text style={styles.emptyText}>No recent activity found.</Text>
        ) : (
          recentPosts.map((post) => (
            <React.Fragment key={post.id}>
              {renderPost({ item: post })}
            </React.Fragment>
          ))
        )}
      </View>

      <ModernAlert 
        visible={showDeleteAlert}
        title="Admin: Delete Post?"
        message="As an administrator, you are removing this content from the platform permanently."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteAlert(false)}
        isDestructive
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  scroll: { paddingBottom: 40 },
  header: { paddingHorizontal: 24, paddingTop: 60, marginBottom: 24 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 4 },
  statsGrid: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, marginBottom: 32 },
  statCard: { flex: 1, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  statVal: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  section: { marginHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  postItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard,
    padding: 16, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  postInfo: { flex: 1 },
  postTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  postMeta: { fontSize: 12, color: Colors.textMuted, textTransform: 'capitalize' },
  deleteCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,94,94,0.1)', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.textMuted, textAlign: 'center', marginTop: 20 },
});
