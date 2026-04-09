import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform, Dimensions
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { Colors, Typography, Spacing, Roundness } from '../../constants/theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { startChat } from '../../utils/chat';
import ModernAlert from '../../components/ModernAlert';

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
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'lost_found', id!));
      router.back();
    } catch (e) {
      console.error(e);
      setLoading(false);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#A0A0A5" />
          <Text style={styles.headerBackText}>Campus</Text>
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
             <Ionicons name="search" size={20} color="#6B52FF" />
          </TouchableOpacity>
          <View style={styles.miniAvatar}>
             <Ionicons name="person" size={12} color="#FFF" />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Main Image Block */}
        <View style={styles.heroWrap}>
          {item.imageUrl ? (
             <Image source={{ uri: item.imageUrl }} style={styles.heroImg} />
          ) : (
             <View style={[styles.heroImg, { backgroundColor: '#1E1E24', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={48} color="#1A1C23" />
             </View>
          )}

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{item.type.toUpperCase()}</Text>
          </View>
        </View>

        {/* Title Block */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
             <Text style={styles.titleText}>{item.title}</Text>
             {item.price && <Text style={styles.priceText}>${item.price}</Text>}
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
                 <Image source={{ uri: authorProfile.avatarUrl }} style={styles.profileAvatar} />
              ) : (
                 <View style={[styles.profileAvatar, { backgroundColor: '#6B52FF', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{color: '#FFF', fontSize: 24, fontWeight: 'bold'}}>{authorNameObj[0]?.toUpperCase()}</Text>
                 </View>
              )}
              {/* Fake trusted badge */}
              <View style={styles.profileBadgePink}>
                 <MaterialCommunityIcons name="star-circle" size={16} color="#FFF" />
              </View>
           </View>

           <Text style={styles.profileName}>{authorNameObj}</Text>
           <Text style={styles.profileDept}>{authorProfile?.department || 'STUDENT COMMONS'}</Text>
           <Text style={styles.profileRating}>★ 4.9 <Text style={{color: '#8A8D93'}}>(123 Reviews)</Text></Text>

           <TouchableOpacity style={styles.viewProfileBtn}>
              <Text style={styles.viewProfileText}>View Profile</Text>
           </TouchableOpacity>
        </View>

        {/* Optional Map Visual Container */}
        {item.location && (
          <View style={styles.mapCard}>
             <View style={styles.mapInner}>
                <Ionicons name="map-outline" size={80} color="rgba(255,255,255,0.02)" style={{position: 'absolute', opacity: 0.5}} />
                
                <View style={styles.mapMarkerPulse}>
                  <View style={styles.mapMarkerCore} />
                </View>

                <View style={styles.mapOverlayLabel}>
                   <Text style={styles.mapOverlayLabelText}>Found near {item.location}</Text>
                </View>
             </View>
          </View>
        )}

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
         <TouchableOpacity style={styles.footerIconBtn}>
            <Ionicons name="bookmark" size={20} color="#A0A0A5" />
         </TouchableOpacity>

         <TouchableOpacity 
            style={styles.footerPrimaryBtn}
            onPress={() => isOwner ? setShowDeleteAlert(true) : startChat(item.userId, authorNameObj, router, { type: item.type, title: item.title, image: item.imageUrl, itemId: item.id })}
         >
            <Ionicons name={isOwner ? "trash" : "chatbubble"} size={18} color="#FFF" />
            <Text style={styles.footerPrimaryText}>{isOwner ? 'Delete Post' : `Message ${firstName}`}</Text>
         </TouchableOpacity>

         <TouchableOpacity style={styles.footerIconBtn}>
            <Ionicons name="share-social" size={20} color="#A0A0A5" />
         </TouchableOpacity>
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
  heroImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroBadge: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: '#6B52FF', // Found violet matching image
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Roundness.full,
  },
  heroBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

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
    height: 160, borderRadius: 24, padding: 2, marginBottom: Spacing.lg,
    overflow: 'hidden'
  },
  mapInner: {
    flex: 1, backgroundColor: '#15151A', borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative'
  },
  mapMarkerPulse: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(140, 124, 255, 0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapMarkerCore: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#6B52FF' },
  mapOverlayLabel: {
    position: 'absolute', bottom: 16,
    backgroundColor: 'rgba(26, 28, 35, 0.8)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: Roundness.full
  },
  mapOverlayLabelText: { color: '#FFF', fontSize: 11 },

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
