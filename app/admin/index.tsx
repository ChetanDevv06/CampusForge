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
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import ModernAlert from '../../components/ModernAlert';
import { createCollege } from '../../utils/colleges';
import { moderateWithAI } from '../../utils/moderation';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
  const { profile, user, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    users: 0, posts: 0, reports: 0, flagged: 0, marketVolume: 0,
    categories: { lost: 0, market: 0, skills: 0 }
  });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [collegeRequests, setCollegeRequests] = useState<any[]>([]);
  const [moderationReports, setModerationReports] = useState<any[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'posts' | 'users' | 'colleges' | 'reports'>('analytics');
  
  // Governance Security Check
  useEffect(() => {
    if (isLoading) return;
    const isAuthorized = profile?.role === 'admin' || __DEV__;
    if (!user || !isAuthorized) {
      console.warn(`🔒 [Security] Protocol access denied for user: ${profile?.email || user?.email}`);
      router.replace('/(tabs)');
    }
  }, [profile, user, isLoading]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userSnap, postSnap, marketSnap, skillSnap, requestsSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'lost_found')),
        getDocs(collection(db, 'marketplace')),
        getDocs(collection(db, 'skills')),
        getDocs(query(collection(db, 'college_requests'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'moderation_reports'), orderBy('timestamp', 'desc')))
      ]);

      setCollegeRequests(requestsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((r: any) => r.status === 'pending'));
      setModerationReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      let volume = 0;
      marketSnap.docs.forEach(d => {
        const p = Number(d.data().price);
        if (!isNaN(p)) volume += p;
      });

      const flaggedPosts = [
        ...postSnap.docs.filter(d => d.data().isFlagged),
        ...marketSnap.docs.filter(d => d.data().isFlagged),
        ...skillSnap.docs.filter(d => d.data().isFlagged)
      ].length;

      setStats({
        users: userSnap.size,
        posts: postSnap.size + marketSnap.size + skillSnap.size,
        reports: reportsSnap.size + flaggedPosts,
        flagged: flaggedPosts,
        marketVolume: volume,
        categories: {
          lost: postSnap.size,
          market: marketSnap.size,
          skills: skillSnap.size
        }
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
      
      setRecentPosts(all.slice(0, 20));
      setAllUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      await createCollege({
        name: req.name,
        shortName: req.name.substring(0, 8).toUpperCase(),
        domain: req.domain,
        domains: [req.domain],
        location: req.location,
        verified: true,
      });
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

  const handleDeleteFlaggedPost = async (report: any) => {
    Alert.alert(
      "Confirm Deletion",
      "This will permanently strike the actual post from the campus records.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Strike Post", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, report.postCollection, report.postId));
              await deleteDoc(doc(db, 'moderation_reports', report.id));
              Alert.alert("Strike Complete", "The artifact has been purged from the feed.");
              fetchData();
            } catch (e) {
              Alert.alert("Error", "Failed to strike the post.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const StatTile = ({ label, value, icon, colors }: { label: string; value: any; icon: string; colors: [string, string] }) => (
    <LinearGradient colors={colors} style={styles.statTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.statIconBox}>
        <Ionicons name={icon as any} size={18} color="#fff" />
      </View>
      <View style={styles.statTextArea}>
        <Text style={styles.statVal}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
    </LinearGradient>
  );

  if (loading && recentPosts.length === 0) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      
      <BlurView intensity={30} tint="dark" style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
          </TouchableOpacity>
          <View style={styles.headerTitleArea}>
            <Text style={styles.headerTitle}>Admin Center</Text>
            <Text style={styles.headerSub}>Campus Management</Text>
          </View>
        </View>
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabsContainer}>
          {['analytics', 'posts', 'users', 'colleges', 'reports'].map((tab) => (
            <TouchableOpacity 
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} 
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsGrid}>
          <StatTile label="Total Posts" value={stats.posts} icon="layers" colors={['#6366F1', '#4F46E5']} />
          <StatTile label="Active Users" value={stats.users} icon="people" colors={['#EC4899', '#DB2777']} />
          <StatTile label="Market Vol" value={`₹${(stats.marketVolume / 1000).toFixed(1)}k`} icon="cash" colors={['#10B981', '#059669']} />
          <StatTile label="New Reports" value={stats.reports} icon="warning" colors={['#F59E0B', '#D97706']} />
        </View>

        {activeTab === 'posts' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Manage Posts</Text>
              <TouchableOpacity onPress={fetchData} style={styles.refreshBtn}>
                <Ionicons name="refresh" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            {recentPosts.map((post) => (
              <View key={post.id} style={styles.protocolItem}>
                <View style={styles.protocolInfo}>
                  <Text style={styles.protocolTitle} numberOfLines={1}>{post.title}</Text>
                  <Text style={styles.protocolMeta}>{post.userName || 'Anonymous'} • {post.type.replace('_', ' ')}</Text>
                </View>
                <TouchableOpacity onPress={() => { setSelectedPost(post); setShowDeleteAlert(true); }} style={styles.strikeBtn}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'users' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Directory</Text>
            {allUsers.map((u) => (
              <View key={u.id} style={styles.protocolItem}>
                <View style={styles.protocolInfo}>
                  <Text style={styles.protocolTitle}>{u.name || 'Anonymous'}</Text>
                  <Text style={styles.protocolMeta}>{u.email} • {u.college || 'No College'}</Text>
                </View>
                <View style={[styles.roleBadge, u.role === 'admin' && styles.roleAdmin]}>
                  <Text style={styles.roleText}>{u.role?.toUpperCase() || 'USER'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'analytics' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ecosystem Analytics</Text>
            
            <View style={styles.analyticsCard}>
              <Text style={styles.chartTitle}>Activity Distribution</Text>
              
              <View style={styles.chartRow}>
                <View style={styles.chartLabelArea}>
                  <Text style={styles.chartLabel}>Marketplace</Text>
                  <Text style={styles.chartValue}>{stats.categories.market}</Text>
                </View>
                <View style={styles.barContainer}>
                  <LinearGradient 
                    colors={['#10B981', '#059669']} 
                    start={{x:0, y:0}} end={{x:1, y:0}}
                    style={[styles.barFill, { width: `${(stats.categories.market / (stats.posts || 1)) * 100}%` }]} 
                  />
                </View>
              </View>

              <View style={styles.chartRow}>
                <View style={styles.chartLabelArea}>
                  <Text style={styles.chartLabel}>Lost & Found</Text>
                  <Text style={styles.chartValue}>{stats.categories.lost}</Text>
                </View>
                <View style={styles.barContainer}>
                  <LinearGradient 
                    colors={['#6366F1', '#4F46E5']} 
                    start={{x:0, y:0}} end={{x:1, y:0}}
                    style={[styles.barFill, { width: `${(stats.categories.lost / (stats.posts || 1)) * 100}%` }]} 
                  />
                </View>
              </View>

              <View style={styles.chartRow}>
                <View style={styles.chartLabelArea}>
                  <Text style={styles.chartLabel}>Skill Share</Text>
                  <Text style={styles.chartValue}>{stats.categories.skills}</Text>
                </View>
                <View style={styles.barContainer}>
                  <LinearGradient 
                    colors={['#EC4899', '#DB2777']} 
                    start={{x:0, y:0}} end={{x:1, y:0}}
                    style={[styles.barFill, { width: `${(stats.categories.skills / (stats.posts || 1)) * 100}%` }]} 
                  />
                </View>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricVal}>₹{(stats.marketVolume / (stats.categories.market || 1)).toFixed(0)}</Text>
                <Text style={styles.metricLabel}>Avg. Item Price</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricVal}>{(stats.posts / (stats.users || 1)).toFixed(1)}</Text>
                <Text style={styles.metricLabel}>Posts per User</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'colleges' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>College Requests</Text>
            {collegeRequests.length === 0 ? (
              <Text style={styles.emptyText}>No pending requests.</Text>
            ) : (
              collegeRequests.map((req) => (
                <View key={req.id} style={styles.protocolItem}>
                  <View style={styles.protocolInfo}>
                    <Text style={styles.protocolTitle}>{req.name}</Text>
                    <Text style={styles.protocolMeta}>{req.domain}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => handleApproveCollege(req)}><Ionicons name="checkmark-circle" size={24} color={Colors.success} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRejectCollege(req.id)}><Ionicons name="close-circle" size={24} color={Colors.error} /></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        {activeTab === 'reports' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Moderation Reports</Text>
              <Text style={styles.headerSub}>{moderationReports.length} Active Incidents</Text>
            </View>
            {moderationReports.length === 0 ? (
              <Text style={styles.emptyText}>No moderation reports found.</Text>
            ) : (
              moderationReports.map((report) => (
                <View key={report.id} style={[styles.protocolItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.protocolInfo}>
                      <Text style={styles.protocolTitle}>{report.userName || 'Student'} ({report.userCollege || 'Campus'})</Text>
                      <Text style={styles.protocolMeta}>{report.userEmail} • {report.postCategory || 'General'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => setExpandedReport(expandedReport === report.id ? null : report.id)} style={styles.refreshBtn}>
                        <Ionicons name={expandedReport === report.id ? "chevron-up" : "chevron-down"} size={18} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={async () => {
                          try {
                            setLoading(true);
                            await deleteDoc(doc(db, 'moderation_reports', report.id));
                            fetchData();
                          } catch (e) {
                            Alert.alert("Error", "Failed to clear report.");
                          } finally {
                            setLoading(false);
                          }
                        }} 
                        style={[styles.refreshBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}
                      >
                        <Ionicons name="checkmark-done" size={18} color={Colors.success} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {expandedReport === report.id && (
                    <View style={styles.reportDetailBox}>
                      <View style={styles.detailDivider} />
                      <Text style={styles.detailHeading}>INCIDENT BREAKDOWN</Text>
                      
                      {report.details ? (
                        <>
                          {Object.entries(report.details).map(([field, data]: [string, any]) => (
                            <View key={field} style={[styles.detailRow, data.flagged && styles.flaggedDetailRow]}>
                              <View style={styles.detailLabelArea}>
                                <Text style={styles.detailLabel}>{field.toUpperCase()}</Text>
                                {data.flagged && <Ionicons name="alert-circle" size={14} color={Colors.error} />}
                              </View>
                              <Text style={[styles.detailText, data.flagged && { color: Colors.error }]}>
                                {data.text || 'No content provided'}
                              </Text>
                            </View>
                          ))}

                          {report.postId && report.postCollection && (
                            <TouchableOpacity 
                              onPress={() => handleDeleteFlaggedPost(report)}
                              style={styles.deletePostBtn}
                            >
                              <Ionicons name="trash-outline" size={16} color={Colors.error} />
                              <Text style={styles.deletePostText}>Strike Original Post</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        <Text style={styles.detailText}>Legacy report structure - details unavailable.</Text>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <ModernAlert 
        visible={showDeleteAlert}
        title="Strike Artifact?"
        message="Permanently remove this content from the archives?"
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
  tabsContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    marginHorizontal: Spacing.margin, 
    borderRadius: Roundness.lg, 
    padding: 4, 
    marginBottom: Spacing.xl 
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Roundness.md },
  tabBtnActive: { backgroundColor: Colors.surface_container_highest },
  tabText: { ...Typography.caption, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    gap: Spacing.sm, 
    paddingHorizontal: Spacing.margin, 
    marginBottom: Spacing.xl 
  },
  statTile: { 
    width: (width - Spacing.margin * 2 - Spacing.sm) / 2,
    borderRadius: Roundness.lg, 
    padding: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    minHeight: 90,
    ...Shadows.ambient
  },
  statIconBox: { 
    width: 32, height: 32, borderRadius: 10, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6
  },
  statTextArea: { alignItems: 'center' },
  statVal: { ...Typography.title, color: '#fff', fontSize: 18, lineHeight: 22 },
  statLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },

  section: { paddingHorizontal: Spacing.margin },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.title, color: Colors.on_background, fontSize: 18 },
  
  protocolItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Colors.surface_container_low, 
    padding: 16, 
    borderRadius: Roundness.md, 
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  protocolInfo: { flex: 1 },
  protocolTitle: { ...Typography.body, color: Colors.on_surface, fontWeight: '600' },
  protocolMeta: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 2 },
  
  strikeBtn: { padding: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)' },
  roleAdmin: { backgroundColor: 'rgba(164, 166, 255, 0.1)' },
  roleText: { ...Typography.caption, fontSize: 10, fontWeight: 'bold', color: Colors.primary },
  
  chartPlaceholder: { 
    height: 180, 
    backgroundColor: Colors.surface_container_low, 
    borderRadius: Roundness.lg, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  analyticsCard: {
    backgroundColor: Colors.surface_container_low,
    padding: 20,
    borderRadius: Roundness.xl,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...Shadows.ambient
  },
  chartTitle: { ...Typography.label, color: Colors.on_surface_variant, marginBottom: 20, fontSize: 12, letterSpacing: 1 },
  chartRow: { marginBottom: 16 },
  chartLabelArea: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartLabel: { ...Typography.caption, color: Colors.on_surface_variant, fontWeight: '600' },
  chartValue: { ...Typography.caption, color: Colors.on_surface, fontWeight: '700' },
  barContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  
  metricsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  metricCard: { 
    flex: 1, 
    backgroundColor: Colors.surface_container_low, 
    padding: 16, 
    borderRadius: Roundness.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  metricVal: { ...Typography.title, color: Colors.on_background, fontSize: 20 },
  metricLabel: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 2 },

  emptyText: { ...Typography.body, color: Colors.on_surface_variant, marginTop: 12, textAlign: 'center', fontSize: 14, paddingHorizontal: 40 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface_container_low, justifyContent: 'center', alignItems: 'center' },

  reportDetailBox: { marginTop: 12, paddingBottom: 4 },
  detailDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 12 },
  detailHeading: { ...Typography.caption, color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  detailRow: { backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: Roundness.md, marginBottom: 8 },
  flaggedDetailRow: { backgroundColor: 'rgba(244, 67, 54, 0.05)', borderColor: 'rgba(244, 67, 54, 0.2)', borderWidth: 1 },
  detailLabelArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  detailLabel: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 9, fontWeight: 'bold' },
  detailText: { ...Typography.body, color: Colors.on_surface, fontSize: 13, lineHeight: 18 },

  deletePostBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.08)', 
    paddingVertical: 10,
    borderRadius: Roundness.md,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)'
  },
  deletePostText: { 
    color: Colors.error, 
    marginLeft: 8, 
    fontSize: 12, 
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
});
