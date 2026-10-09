import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Image } from 'expo-image';
import ImageViewer from '../../components/ImageViewer';
import LocationPreview from '../../components/LocationPreview';
import ModernAlert from '../../components/ModernAlert';
import { Roundness, Shadows, Spacing, Typography } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';
import { startChat } from '../../utils/chat';
import { deleteImageFromCloudinary } from '../../utils/storage';

const { width } = Dimensions.get('window');

const formatTimeAgo = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const intervals: { [key: string]: number } = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 };
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval > 0) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  return 'Just now';
};

export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const saveScaleAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    const fetchItem = async () => {
      try {
        const snap = await getDoc(doc(db, 'lost_found', id));
        if (snap.exists()) {
          const data = snap.data();
          setItem({ id: snap.id, ...data });

          if (data.userId) {
            const authorSnap = await getDoc(doc(db, 'users', data.userId));
            if (authorSnap.exists()) {
              setAuthorProfile(authorSnap.data());
            }
          }

          // Check if this item is already saved by current user
          if (uid) {
            const savedSnap = await getDoc(doc(db, 'users', uid, 'savedItems', snap.id));
            setIsSaved(savedSnap.exists());
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id, uid]);

  const handleDelete = async () => {
    try {
      setLoading(true);

      // Clean up Cloudinary photos if delete tokens are present
      if (item?.cloudinaryDeleteTokens && item.cloudinaryDeleteTokens.length > 0) {
        try {
          await Promise.all(item.cloudinaryDeleteTokens.map((token: string) => deleteImageFromCloudinary(token)));
        } catch (err) {
          console.error("Cloudinary batch deletion failed:", err);
        }
      } else if (item?.cloudinaryDeleteToken) {
        try {
          await deleteImageFromCloudinary(item.cloudinaryDeleteToken);
        } catch (err) {
          console.error("Cloudinary single deletion failed:", err);
        }
      }

      await deleteDoc(doc(db, 'lost_found', id!));
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/lost-found');
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!uid || !item) return;
    // Animate the button
    Animated.sequence([
      Animated.timing(saveScaleAnim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(saveScaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    const savedRef = doc(db, 'users', uid, 'savedItems', item.id);
    try {
      if (isSaved) {
        await deleteDoc(savedRef);
        setIsSaved(false);
      } else {
        await setDoc(savedRef, {
          itemId: item.id,
          type: item.type,
          title: item.title,
          imageUrl: item.imageUrl || null,
          location: item.location || null,
          savedAt: new Date().toISOString(),
          collection: 'lost_found',
        });
        setIsSaved(true);
      }
    } catch (e) {
      console.error('Save error:', e);
    }
  };

  const handleShare = async () => {
    if (!item) return;
    try {
      await Share.share({
        title: item.title,
        message: `🔍 ${item.type === 'lost' ? 'Lost' : 'Found'}: ${item.title}\n📍 ${item.location || 'Campus'}\n\nPosted on CampusLoop — the campus exchange app.`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6B52FF" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.error}>
        <Ionicons name="alert-circle" size={64} color="#1A1C23" />
        <Text style={styles.errorText}>This listing has vanished.</Text>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/lost-found');
            }
          }} 
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Return Route</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = uid === item.userId;
  const isLost = item.type === 'lost';
  const authorNameObj = authorProfile?.name || item.userName || 'Student';
  const firstName = authorNameObj.split(' ')[0];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#15151A" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBackBtn} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/lost-found');
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Main Image or Compact Status Header */}
        {(item.imageUrl || (item.imageUrls && item.imageUrls.length > 0)) ? (
          <View style={styles.heroWrap}>
            {item.imageUrls && item.imageUrls.length > 0 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.heroImg}>
                {item.imageUrls.map((url: string, idx: number) => (
                  <TouchableOpacity 
                    key={idx} 
                    activeOpacity={0.9} 
                    onPress={() => { setViewerIndex(idx); setViewerVisible(true); }}
                  >
                    <Image source={{ uri: url }} style={{ width: width - (Spacing.margin * 2), height: 380, borderRadius: 24 }} contentFit="cover" transition={300} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => { setViewerIndex(0); setViewerVisible(true); }}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.heroImg} contentFit="cover" transition={300} />
              </TouchableOpacity>
            )}
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{item.type.toUpperCase()}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.compactHero}>
            <LinearGradient
              colors={isLost ? ['#2A1020', '#1A1020', '#15151A'] : ['#1A1535', '#17153A', '#15151A']}
              style={styles.compactHeroFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Ghost decorative icon in background */}
              <Ionicons
                name={isLost ? 'alert-circle' : 'checkmark-circle'}
                size={140}
                color={isLost ? 'rgba(255, 100, 124, 0.05)' : 'rgba(107, 82, 255, 0.05)'}
                style={styles.noImageGhostIcon}
              />

              <View style={styles.noImageContent}>
                {/* Icon circle */}
                <View style={[styles.noImageIconCircle, {
                  backgroundColor: isLost ? 'rgba(255, 100, 124, 0.15)' : 'rgba(107, 82, 255, 0.15)'
                }]}>
                  <Ionicons
                    name={isLost ? 'alert-circle' : 'checkmark-circle'}
                    size={30}
                    color={isLost ? '#FF647C' : '#6B52FF'}
                  />
                </View>

                <View>
                  <View style={[styles.typePill, {
                    backgroundColor: isLost ? 'rgba(255, 100, 124, 0.15)' : 'rgba(107, 82, 255, 0.15)'
                  }]}>
                    <Ionicons
                      name={isLost ? 'alert-circle' : 'checkmark-circle'}
                      size={13}
                      color={isLost ? '#FF647C' : '#6B52FF'}
                    />
                    <Text style={[styles.typePillText, { color: isLost ? '#FF647C' : '#6B52FF' }]}>
                      {item.type.toUpperCase()} REPORT
                    </Text>
                  </View>
                  <Text style={styles.noImageLabel}>No photo attached</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Title Block */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{item.title}</Text>
            {item.price && <Text style={styles.priceText}>₹{item.price}</Text>}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#A0A0A5" />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
            <Text style={styles.metaDot}>•</Text>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#A0A0A5" />
              <Text style={styles.metaText}>{formatTimeAgo(item.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardHeader}>Details</Text>
          <Text style={styles.descriptionText}>
            {item.description || "No specific details provided for this entry. Reach out for more information."}
          </Text>

          <View style={styles.tagsContainer}>
            <View style={styles.tagPill}><Text style={styles.tagText}>#{item.type === 'lost' ? 'LostItem' : 'FoundItem'}</Text></View>
            <View style={styles.tagPill}><Text style={styles.tagText}>#CampusAlert</Text></View>
            {item.category && <View style={styles.tagPill}><Text style={styles.tagText}>#{item.category}</Text></View>}
          </View>
        </View>

        {/* Centered Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatarWrap}>
            {authorProfile?.avatarUrl ? (
              <Image source={{ uri: authorProfile.avatarUrl }} style={styles.profileAvatar} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.profileAvatar, { backgroundColor: '#6B52FF', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>{authorNameObj[0]?.toUpperCase()}</Text>
              </View>
            )}
            {/* Fake trusted badge */}
            <View style={styles.profileBadgePink}>
              <MaterialCommunityIcons name="star-circle" size={16} color="#FFF" />
            </View>
          </View>

          <Text style={styles.profileName}>{authorNameObj}</Text>
          <Text style={styles.profileDept}>{authorProfile?.department || 'STUDENT COMMONS'}</Text>
          <Text style={styles.profileRating}>★ {authorProfile?.rating ? Number(authorProfile.rating).toFixed(1) : '5.0'} <Text style={{ color: '#8A8D93' }}>({authorProfile?.reviewCount || 0} Reviews)</Text></Text>

          <TouchableOpacity style={styles.viewProfileBtn}>
            <Text style={styles.viewProfileText}>View Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Premium Location Radar Card */}
        {/* Premium Location Preview */}
        <LocationPreview
          location={item.location}
          locationCoords={item.locationCoords}
          title="Last Seen In Area"
        />

        {/* Safety Tip */}
        <View style={styles.safetyCard}>
          <View style={styles.safetyHeader}>
            <MaterialCommunityIcons name="shield-alert" size={18} color="#FF647C" />
            <Text style={styles.safetyTitle}>Campus Safety Tip</Text>
          </View>
          <Text style={styles.safetyDesc}>
            Always meet in public campus areas and verify high-value items through campus security or serial numbers.
          </Text>
        </View>

      </ScrollView>

      {/* Floating Action Footer */}
      <View style={styles.footerWrap}>
        {isOwner ? (
          <>
            <TouchableOpacity
              style={styles.footerIconBtn}
              onPress={() => setShowDeleteAlert(true)}
            >
              <Ionicons name="trash-outline" size={20} color="#FF647C" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerPrimaryBtn}
              onPress={() => router.push(`/edit-item/${item.id}`)}
            >
              <Ionicons name="create" size={18} color="#FFF" />
              <Text style={styles.footerPrimaryText}>Edit Listing</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.footerIconBtn} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="#A0A0A5" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.footerIconBtn} onPress={handleSave}>
              <Animated.View style={{ transform: [{ scale: saveScaleAnim }] }}>
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isSaved ? '#6B52FF' : '#A0A0A5'}
                />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerPrimaryBtn}
              onPress={() => startChat(item.userId, authorNameObj, router, { type: item.type, title: item.title, image: item.imageUrl, itemId: item.id })}
            >
              <Ionicons name="chatbubble" size={18} color="#FFF" />
              <Text style={styles.footerPrimaryText}>Message {firstName}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.footerIconBtn} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="#A0A0A5" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ModernAlert
        visible={showDeleteAlert}
        title="Remove Post?"
        message="This will permanently delete your campus report."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteAlert(false)}
        confirmText="Remove"
        isDestructive
      />

      <ImageViewer
        images={(item.imageUrls || (item.imageUrl ? [item.imageUrl] : [])).map((url: string) => ({ uri: url }))}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  loading: { flex: 1, backgroundColor: '#15151A', justifyContent: 'center', alignItems: 'center' },
  error: { flex: 1, backgroundColor: '#15151A', justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  errorText: { ...Typography.title, color: '#A0A0A5', marginTop: Spacing.lg, marginBottom: Spacing.xl },
  backBtn: { backgroundColor: '#1A1C23', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Roundness.full },
  backBtnText: { ...Typography.label, color: '#6B52FF' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.md,
    backgroundColor: '#15151A',
    zIndex: 10,
  },
  headerBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBackText: { ...Typography.headline, fontSize: 16, color: '#FFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerIconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  miniAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1A1C23', justifyContent: 'center', alignItems: 'center' },

  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: 120, paddingTop: 10 },

  heroWrap: {
    width: '100%',
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.xl,
  },
  heroImg: { width: '100%', height: '100%' },
  heroBadge: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: '#6B52FF',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Roundness.full,
  },
  heroBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

  compactHero: {
    width: '100%',
    height: 160,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  compactHeroFill: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
  },
  noImageGhostIcon: {
    position: 'absolute',
    right: -30,
    bottom: -30,
  },
  noImageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  noImageIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginTop: 5,
    letterSpacing: 0.5,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  titleBlock: { marginBottom: Spacing.xl, paddingHorizontal: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  titleText: { ...Typography.headline, color: '#FFF', fontSize: 24, flex: 1, paddingRight: Spacing.lg },
  priceText: { ...Typography.headline, color: '#6B52FF', fontSize: 18, marginTop: 4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaDot: { color: '#8A8D93', marginHorizontal: 8, fontSize: 10 },
  metaText: { color: '#8A8D93', fontSize: 12 },

  detailsCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 24,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  cardHeader: { ...Typography.headline, fontSize: 16, color: '#FFF', marginBottom: Spacing.md },
  descriptionText: { color: '#A0A0A5', fontSize: 14, lineHeight: 22, marginBottom: Spacing.lg },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tagPill: { backgroundColor: '#1A1C23', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Roundness.full },
  tagText: { color: '#A0A0A5', fontSize: 11 },

  profileCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center', // Fix misalign: Centered perfectly
    marginBottom: Spacing.lg,
  },
  profileAvatarWrap: { position: 'relative', marginBottom: Spacing.md },
  profileAvatar: { width: 64, height: 64, borderRadius: 32 },
  profileBadgePink: {
    position: 'absolute', bottom: 0, right: -4,
    backgroundColor: '#D9214E', borderRadius: 10, width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#1E1E24'
  },
  profileName: { ...Typography.headline, fontSize: 16, color: '#FFF', marginBottom: 2 },
  profileDept: { color: '#A0A0A5', fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  profileRating: { color: '#6B52FF', fontSize: 12, fontWeight: 'bold', marginBottom: Spacing.lg },
  viewProfileBtn: {
    width: '100%', backgroundColor: '#1A1C23',
    paddingVertical: 14, borderRadius: Roundness.xl,
    alignItems: 'center',
  },
  viewProfileText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  mapCard: {
    backgroundColor: '#1E1E24',
    height: 180, borderRadius: 32, marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  mapInner: {
    flex: 1,
    position: 'relative',
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  mapGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  mapGridLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
    backgroundColor: '#FFF',
  },
  mapGridLineVertical: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
    backgroundColor: '#FFF',
  },
  radarContainer: {
    width: 80, height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  radarCore: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: '#6B52FF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.ambient,
  },
  radarAura: {
    position: 'absolute',
    width: '100%', height: '100%',
    borderRadius: 40,
    backgroundColor: 'rgba(107, 82, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(107, 82, 255, 0.3)',
  },
  radarAura2: {
    position: 'absolute',
    width: '70%', height: '70%',
    borderRadius: 30,
    backgroundColor: 'rgba(107, 82, 255, 0.2)',
  },
  mapInfo: {
    flex: 1,
  },
  mapInfoTitle: {
    color: '#A0A0A5',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mapInfoText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapInfoFloating: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 16,
  },

  safetyCard: {
    backgroundColor: '#261118',
    borderRadius: 24, padding: Spacing.xl,
    borderWidth: 1, borderColor: 'rgba(217, 33, 78, 0.1)'
  },
  safetyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  safetyTitle: { color: '#FF647C', fontSize: 14, fontWeight: 'bold' },
  safetyDesc: { color: '#A0A0A5', fontSize: 12, lineHeight: 18 },

  footerWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#15151A', paddingHorizontal: Spacing.margin,
    paddingTop: Spacing.md, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md,
    borderTopWidth: 1, borderTopColor: '#1A1C23'
  },
  footerIconBtn: {
    width: 52, height: 52, borderRadius: Roundness.xl,
    backgroundColor: '#1A1C23', justifyContent: 'center', alignItems: 'center'
  },
  footerPrimaryBtn: {
    flex: 1, height: 52, borderRadius: Roundness.xl,
    backgroundColor: '#6B52FF', flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 8
  },
  footerPrimaryText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});
