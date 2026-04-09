import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Image, Alert, StatusBar, Platform, Dimensions 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, deleteDoc, doc, query, orderBy, limit, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import ModernAlert from '../../components/ModernAlert';
import { createCollege } from '../../utils/colleges';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [collegeRequests, setCollegeRequests] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'colleges'>('content');

  // Governance Security Check
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
      const [userSnap, postSnap, marketSnap, skillSnap, requestsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'lost_found')),
        getDocs(collection(db, 'marketplace')),
        getDocs(collection(db, 'skills')),
        getDocs(query(collection(db, 'college_requests'), orderBy('createdAt', 'desc')))
      ]);

      setCollegeRequests(requestsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((r: any) => r.status === 'pending'));

      setStats({
        users: userSnap.size,
        posts: postSnap.size + marketSnap.size + skillSnap.size,
        reports: 0 
      });

      const all = [
        ...postSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'lost_found' })),
        ...marketSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'marketplace' })),
        ...skillSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'skills' }))
      ];
      
      all.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
        const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      setRecentPosts(all.slice(0, 15));
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
      Alert.alert("Forge Error", "Failed to strike this content from the archives.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCollege = async (req: any) => {
    try {
      setLoading(true);
      // 1. Create the new college
      await createCollege({
        name: req.name,
        shortName: req.name.substring(0, 8).toUpperCase(),
        domain: req.domain,
        domains: [req.domain],
        location: req.location,
        verified: true,
      });
      // 2. Mark request as approved
      await updateDoc(doc(db, 'college_requests', req.id), { status: 'approved', updatedAt: serverTimestamp() });
      Alert.alert("College Approved", `${req.name} has been added to the platform.`);
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to approve college request.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectCollege = async (reqId: string) => {
    try {
      setLoading(true);
      await updateDoc(doc(db, 'college_requests', reqId), { status: 'rejected', updatedAt: serverTimestamp() });
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to reject college request.");
    } finally {
      setLoading(false);
    }
  };

  const StatTile = ({ label, value, icon, colors }: { label: string; value: number; icon: string; colors: [string, string] }) => (
    <LinearGradient colors={colors} style={styles.statTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.statIconBox}>
        <Ionicons name={icon as any} size={22} color={Colors.on_primary} />
      </View>
      <View>
        <Text style={styles.statVal}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </LinearGradient>
  );

  if (loading && recentPosts.length === 0) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <BlurView intensity={30} tint="dark" style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
          </TouchableOpacity>
          <View style={styles.headerTitleArea}>
            <Text style={styles.headerTitle}>Forge Governance</Text>
            <Text style={styles.headerSub}>Administer platform protocol</Text>
          </View>
        </View>
      </BlurView>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <StatTile label="Agents" value={stats.users} icon="people" colors={['#6366F1', '#4F46E5']} />
          <StatTile label="Artifacts" value={stats.posts} icon="layers" colors={['#EC4899', '#DB2777']} />
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'content' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('content')}
          >
            <Text style={[styles.tabText, activeTab === 'content' && styles.tabTextActive]}>Content</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'colleges' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('colleges')}
          >
            <Text style={[styles.tabText, activeTab === 'colleges' && styles.tabTextActive]}>Colleges ({collegeRequests.length})</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'content' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Protocols</Text>
              <TouchableOpacity onPress={fetchData} style={styles.refreshBtn}>
                <Ionicons name="refresh" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            
            {recentPosts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="documents-outline" size={48} color={Colors.surface_container_high} />
                <Text style={styles.emptyText}>No recent artifacts detected.</Text>
              </View>
            ) : (
              recentPosts.map((post) => (
                <View key={post.id} style={styles.protocolItem}>
                  <View style={styles.protocolInfo}>
                    <Text style={styles.protocolTitle} numberOfLines={1}>{post.title}</Text>
                    <View style={styles.protocolMeta}>
                      <Text style={styles.protocolUser}>{post.userName || 'Anonymous Agent'}</Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.protocolType}>{post.type.replace('_', ' ')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.strikeBtn}
                    onPress={() => {
                      setSelectedPost(post);
                      setShowDeleteAlert(true);
                    }}
                  >
                    <Ionicons name="trash" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              <TouchableOpacity onPress={() => router.push('/admin/seed-colleges')} style={styles.seedBtn}>
                 <Text style={styles.seedText}>Seed</Text>
              </TouchableOpacity>
            </View>

            {collegeRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="school-outline" size={48} color={Colors.surface_container_high} />
                <Text style={styles.emptyText}>No pending college requests.</Text>
              </View>
            ) : (
              collegeRequests.map((req) => (
                <View key={req.id} style={styles.requestItem}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.protocolTitle} numberOfLines={1}>{req.name}</Text>
                    <Text style={styles.protocolUser}>@{req.domain} • {req.location}</Text>
                    <Text style={styles.protocolType}>Requested by: {req.requestedByEmail}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity style={[styles.reqBtn, { backgroundColor: Colors.success }]} onPress={() => handleApproveCollege(req)}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.reqBtn, { backgroundColor: Colors.error }]} onPress={() => handleRejectCollege(req.id)}>
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <ModernAlert 
        visible={showDeleteAlert}
        title="Strike Artifact?"
        message="As an administrator, you are removing this content from the CampusForge archives permanently."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteAlert(false)}
        confirmText="Strike"
        isDestructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.margin, paddingBottom: Spacing.lg, zIndex: 100 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface_container_high, justifyContent: 'center', alignItems: 'center' },
  headerTitleArea: { flex: 1 },
  headerTitle: { ...Typography.display, color: Colors.on_background, fontSize: 24 },
  headerSub: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 2 },

  scrollContent: { paddingTop: Spacing.lg, paddingBottom: 60 },
  statsGrid: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.margin, marginBottom: Spacing.xxl },
  statTile: { 
    flex: 1, borderRadius: Roundness.lg, padding: Spacing.lg, 
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    ...Shadows.ambient
  },
  statIconBox: { 
    width: 44, height: 44, borderRadius: 14, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', alignItems: 'center' 
  },
  statVal: { ...Typography.title, color: Colors.on_primary, fontSize: 22 },
  statLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  section: { paddingHorizontal: Spacing.margin },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.label, color: Colors.primary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface_container_low, justifyContent: 'center', alignItems: 'center' },

  protocolItem: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: Colors.surface_container_low,
    padding: Spacing.md, borderRadius: Roundness.md, marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  protocolInfo: { flex: 1 },
  protocolTitle: { ...Typography.body_medium, color: Colors.on_background, fontSize: 16 },
  protocolMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  protocolUser: { ...Typography.caption, color: Colors.on_surface_variant },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.on_surface_variant, opacity: 0.5 },
  protocolType: { ...Typography.caption, color: Colors.primary, textTransform: 'capitalize' },
  strikeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,107,107,0.1)', justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', marginTop: 60, gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.on_surface_variant, fontSize: 14 },

  tabsContainer: {
    flexDirection: 'row', paddingHorizontal: Spacing.margin,
    marginBottom: Spacing.xl, gap: Spacing.md
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Roundness.full,
    backgroundColor: Colors.surface_container_low,
    justifyContent: 'center', alignItems: 'center'
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { ...Typography.label, color: Colors.on_surface_variant },
  tabTextActive: { color: Colors.on_primary },

  requestItem: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: Colors.surface_container_low,
    padding: Spacing.md, borderRadius: Roundness.md, marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  requestInfo: { flex: 1, gap: 2 },
  requestActions: { flexDirection: 'row', gap: Spacing.sm },
  reqBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  seedBtn: { backgroundColor: Colors.surface_container_high, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  seedText: { ...Typography.label, color: Colors.on_surface_variant },
});
