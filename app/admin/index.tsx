import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Image, Alert, StatusBar, Platform, Dimensions 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, getDoc, deleteDoc, doc, query, orderBy, limit, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import ModernAlert from '../../components/ModernAlert';
import { createCollege } from '../../utils/colleges';
import { moderateWithAI } from '../../utils/moderation';
import { deleteImageFromCloudinary } from '../../utils/storage';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
  const { profile, user, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    users: 0, posts: 0, reports: 0, flagged: 0, aiCatches: 0, marketVolume: 0,
    categories: { lost: 0, market: 0, skills: 0 }
  });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [collegeRequests, setCollegeRequests] = useState<any[]>([]);
  const [moderationReports, setModerationReports] = useState<any[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [reportMedia, setReportMedia] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'posts' | 'users' | 'colleges' | 'reports'>('analytics');

  const fetchReportMedia = async (col: string, id: string) => {
    setReportMedia(null);
    try {
      const snap = await getDoc(doc(db, col, id));
      if (snap.exists()) {
        setReportMedia(snap.data());
      }
    } catch (e) {
      console.error("Failed to fetch report media:", e);
    }
  };
  
  // Governance Security Check
  useEffect(() => {
    if (isLoading) return;
    const isAuthorized = profile?.role === 'admin';
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
      const aiCatches = reportsSnap.docs.filter(d => d.data().aiReport?.isFlagged).length;

      setStats({
        users: userSnap.size,
        posts: postSnap.size + marketSnap.size + skillSnap.size,
        reports: reportsSnap.size,
        flagged: flaggedPosts,
        aiCatches: aiCatches,
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
      // Clean up Cloudinary photos if delete tokens are present
      if (selectedPost?.cloudinaryDeleteTokens && selectedPost.cloudinaryDeleteTokens.length > 0) {
        try {
          await Promise.all(selectedPost.cloudinaryDeleteTokens.map((token: string) => deleteImageFromCloudinary(token)));
        } catch (err) {
          console.error("Cloudinary batch deletion failed in admin:", err);
        }
      } else if (selectedPost?.cloudinaryDeleteToken) {
        try {
          await deleteImageFromCloudinary(selectedPost.cloudinaryDeleteToken);
        } catch (err) {
          console.error("Cloudinary single deletion failed in admin:", err);
        }
      }

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

              // Query the original post to extract Cloudinary delete tokens
              try {
                const postSnap = await getDoc(doc(db, report.postCollection, report.postId));
                if (postSnap.exists()) {
                  const postData = postSnap.data();
                  if (postData?.cloudinaryDeleteTokens && postData.cloudinaryDeleteTokens.length > 0) {
                    await Promise.all(postData.cloudinaryDeleteTokens.map((token: string) => deleteImageFromCloudinary(token)));
                  } else if (postData?.cloudinaryDeleteToken) {
                    await deleteImageFromCloudinary(postData.cloudinaryDeleteToken);
                  }
                }
              } catch (cloudinaryErr) {
                console.error("Failed to clean up Cloudinary images during flagged post strike:", cloudinaryErr);
              }

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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Campus Requests</Text>
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>{collegeRequests.length} PENDING</Text>
              </View>
            </View>
            
            {collegeRequests.length === 0 ? (
              <BlurView intensity={10} tint="dark" style={styles.emptyStateCard}>
                <Ionicons name="school-outline" size={40} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>All campuses are currently synchronized. No new requests.</Text>
              </BlurView>
            ) : (
              collegeRequests.map((req) => (
                <BlurView key={req.id} intensity={20} tint="dark" style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestTitle}>{req.name}</Text>
                      <View style={styles.domainBadge}>
                        <Ionicons name="at-circle" size={14} color={Colors.primary} />
                        <Text style={styles.domainText}>{req.domain}</Text>
                      </View>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity 
                        style={[styles.actionIconBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]} 
                        onPress={() => handleApproveCollege(req)}
                      >
                        <Ionicons name="checkmark" size={20} color={Colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionIconBtn, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]} 
                        onPress={() => handleRejectCollege(req.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.requestFooter}>
                    <Text style={styles.requestMeta}>
                      <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.3)" /> {req.location || 'Unknown Location'}
                    </Text>
                    <Text style={styles.requestUser}>Requested by: {req.requestedByEmail?.split('@')[0] || 'Student'}</Text>
                  </View>
                </BlurView>
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

            <View style={styles.modStatsRow}>
              <View style={[styles.modStatCard, { borderColor: Colors.error + '40' }]}>
                <Text style={styles.modStatVal}>{(stats as any).reports || 0}</Text>
                <Text style={styles.modStatLabel}>Total Reports</Text>
              </View>
              <View style={[styles.modStatCard, { borderColor: Colors.primary + '40' }]}>
                <Text style={styles.modStatVal}>{(stats as any).aiCatches || 0}</Text>
                <Text style={styles.modStatLabel}>AI Catches</Text>
              </View>
              <View style={[styles.modStatCard, { borderColor: Colors.success + '40' }]}>
                <Text style={styles.modStatVal}>{(stats as any).flagged || 0}</Text>
                <Text style={styles.modStatLabel}>Manual Flags</Text>
              </View>
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
                      <TouchableOpacity 
                        onPress={() => {
                          const isExpanding = expandedReport !== report.id;
                          setExpandedReport(isExpanding ? report.id : null);
                          if (isExpanding && report.postId && report.postCollection) {
                            fetchReportMedia(report.postCollection, report.postId);
                          }
                        }} 
                        style={styles.refreshBtn}
                      >
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
                      
                      {reportMedia && (
                        <View style={styles.mediaPreviewScroll}>
                          <Text style={styles.detailHeading}>ATTACHED MEDIA</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 15 }}>
                            {reportMedia.imageUrl && (
                              <Image source={{ uri: reportMedia.imageUrl }} style={styles.reportImage} />
                            )}
                            {reportMedia.imageUrls?.map((url: string, idx: number) => (
                              <Image key={idx} source={{ uri: url }} style={styles.reportImage} />
                            ))}
                            {reportMedia.videoUrl && (
                              <View style={styles.videoPlaceholder}>
                                <Ionicons name="play-circle" size={32} color="#fff" />
                                <Text style={styles.videoLabel}>Video Artifact</Text>
                              </View>
                            )}
                            {(!reportMedia.imageUrl && !reportMedia.imageUrls && !reportMedia.videoUrl) && (
                              <Text style={styles.detailText}>No media attached to this post.</Text>
                            )}
                          </ScrollView>
                        </View>
                      )}

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

                          {report.aiReport && (
                            <View style={styles.aiInsightBox}>
                              <View style={styles.aiInsightHeader}>
                                <Ionicons name="sparkles" size={16} color={Colors.primary} />
                                <Text style={styles.aiInsightTitle}>Gemini AI Insight</Text>
                              </View>
                              <Text style={styles.aiInsightReason}>
                                {report.aiReport.isFlagged ? `🚨 Flagged: ${report.aiReport.reason}` : `✅ AI Verdict: Content appears safe.`}
                              </Text>
                              <View style={styles.confidenceBarArea}>
                                <View style={[styles.confidenceBar, { width: `${(report.aiReport.confidence || 0) * 100}%`, backgroundColor: report.aiReport.isFlagged ? Colors.error : Colors.primary }]} />
                              </View>
                            </View>
                          )}

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

  mediaPreviewScroll: { marginBottom: 15 },
  reportImage: { width: 120, height: 120, borderRadius: Roundness.md, backgroundColor: Colors.surface_container_highest },
  videoPlaceholder: { 
    width: 120, height: 120, borderRadius: Roundness.md, 
    backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' 
  },
  videoLabel: { ...Typography.caption, color: '#fff', fontSize: 8, marginTop: 4, fontWeight: 'bold' },

  aiInsightBox: { 
    backgroundColor: 'rgba(98, 0, 238, 0.05)', 
    padding: 12, 
    borderRadius: Roundness.md, 
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(98, 0, 238, 0.1)'
  },
  aiInsightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiInsightTitle: { ...Typography.caption, color: Colors.primary, marginLeft: 6, fontWeight: 'bold', fontSize: 10, letterSpacing: 0.5 },
  aiInsightReason: { ...Typography.body, fontSize: 12, color: Colors.on_surface, marginBottom: 8 },
  confidenceBarArea: { height: 3, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' },
  confidenceBar: { height: '100%', borderRadius: 2 },

  modStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modStatCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: Roundness.md, borderWidth: 1, alignItems: 'center' },
  modStatVal: { ...Typography.title, color: Colors.on_surface, marginBottom: 2 },
  modStatLabel: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 10 },

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

  // College Request Styles
  badgeCount: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  emptyStateCard: { padding: 40, alignItems: 'center', borderRadius: Roundness.xl, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  requestCard: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  requestInfo: { flex: 1, marginRight: 15 },
  requestTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  domainBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  domainText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  requestActions: { flexDirection: 'row', gap: 10 },
  actionIconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  requestFooter: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  requestUser: { color: 'rgba(255,255,255,0.2)', fontSize: 11, fontStyle: 'italic' },
});
