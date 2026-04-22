import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Video, ResizeMode } from 'expo-av';
import ImageViewing from 'react-native-image-viewing';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Dimensions
} from 'react-native';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';
import { startChat } from '../../utils/chat';
import ModernAlert from '../../components/ModernAlert';
import LocationPreview from '../../components/LocationPreview';

const { width } = Dimensions.get('window');

export default function SkillDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [skill, setSkill] = useState<any>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    const fetchSkill = async () => {
      try {
        const snap = await getDoc(doc(db, 'skills', id));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as any;
          setSkill(data);

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
    fetchSkill();
  }, [id]);

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'skills', skill.id));
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Forge Error", "Failed to relinquish this expertise listing.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!skill) {
    return (
      <View style={styles.error}>
        <Ionicons name="flash-off" size={64} color={Colors.surface_container_high} />
        <Text style={styles.errorText}>Expertise listing not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Return to Hub</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = uid === skill.userId;
  const isOffer = skill.type === 'offer';
  const accentColor = isOffer ? Colors.primary : Colors.tertiary;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* Expertise Pedestal */}
        <View style={styles.hero}>
          {skill.videoUrl ? (
            <Video
              source={{ uri: skill.videoUrl }}
              style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              isLooping
            />
          ) : (skill.imageUrls && skill.imageUrls.length > 0) ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFillObject}>
              {skill.imageUrls.map((url: string, idx: number) => (
                <TouchableOpacity 
                  key={idx} 
                  activeOpacity={0.9} 
                  onPress={() => { setViewerIndex(idx); setViewerVisible(true); }}
                >
                  <Image source={{ uri: url }} style={{ width, height: 400 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : skill.imageUrl ? (
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => { setViewerIndex(0); setViewerVisible(true); }}
              style={StyleSheet.absoluteFillObject}
            >
              <Image source={{ uri: skill.imageUrl }} style={StyleSheet.absoluteFillObject} />
            </TouchableOpacity>
          ) : (
            <LinearGradient 
              colors={isOffer ? Gradients.primary : [Colors.tertiary, Colors.tertiary_container]} 
              style={StyleSheet.absoluteFillObject}
              start={{x:0, y:0}} end={{x:1, y:1}}
            />
          )}
          <TouchableOpacity style={styles.absBack} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={styles.backBlur}>
              <Ionicons name="chevron-back" size={24} color={Colors.on_primary} />
            </BlurView>
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={isOffer ? 'bulb' : 'school'} size={40} color={Colors.on_primary} />
            </View>
            <Text style={styles.heroTitle}>{skill.title}</Text>
            <View style={styles.heroTags}>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>{skill.category}</Text>
              </View>
              <View style={[styles.heroTag, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                <Text style={styles.heroTagText}>{isOffer ? 'MENTOR' : 'LEARNER'}</Text>
              </View>
            </View>
          </View>
          
          <LinearGradient 
            colors={['transparent', 'rgba(10,10,18,0.7)', Colors.background]} 
            style={styles.heroOverlay} 
          />
        </View>

        <View style={styles.content}>
          <View style={styles.infoBlock}>
            <Text style={[styles.sectionHeading, { color: accentColor }]}>Expertise Overview</Text>
            <Text style={styles.description}>{skill.description}</Text>
          </View>

          {/* Mentor Presence */}
          <View style={styles.infoBlock}>
            <Text style={[styles.sectionHeading, { color: accentColor }]}>Identity Provider</Text>
            <TouchableOpacity 
              style={styles.identityToken}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: skill.userId } } as any)}
            >
              <View style={styles.avatarPill}>
                {authorProfile?.avatarUrl ? (
                  <Image source={{ uri: authorProfile.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <LinearGradient colors={Gradients.primary} style={styles.avatarImg}>
                    <Text style={styles.avatarChar}>{(authorProfile?.name || 'S')[0]}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.identityMeta}>
                <Text style={styles.identityName}>{authorProfile?.name || 'Campus Talent'}</Text>
                <Text style={styles.identitySub}>Verified Professional • {authorProfile?.college || 'Verified'}</Text>
              </View>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.on_surface_variant} />
            </TouchableOpacity>
          </View>

          {/* Collaborative Grid */}
          <View style={styles.collabRow}>
            <View style={styles.collabTile}>
              <Ionicons name="time" size={20} color={accentColor} />
              <Text style={styles.collabLabel}>Flexible Pace</Text>
            </View>
            <View style={styles.collabTile}>
              <Ionicons name="people" size={20} color={accentColor} />
              <Text style={styles.collabLabel}>Direct Bridge</Text>
            </View>
            <View style={styles.collabTile}>
              <Ionicons name="medal" size={20} color={accentColor} />
              <Text style={styles.collabLabel}>Peer Mastered</Text>
            </View>
          </View>

          {/* Premium Location Preview */}
          <LocationPreview 
            location={skill.location} 
            locationCoords={skill.locationCoords} 
            title="Meeting Spot" 
          />
        </View>
      </ScrollView>

      {/* Floating Dialogue Bar */}
      <View style={[styles.tacticalBar, { paddingBottom: Platform.OS === 'ios' ? 40 : 20 }]}>
        <BlurView intensity={30} tint="dark" style={styles.actionBarBlur}>
          {isOwner ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                onPress={() => router.push({ pathname: '/post-skill', params: { editId: skill.id } } as any)}
              >
                <Ionicons name="create" size={20} color={Colors.on_primary} />
                <Text style={styles.actionBtnText}>Update Forge</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: Colors.error, width: 56, flex: 0 }]}
                onPress={() => setShowDeleteAlert(true)}
              >
                <Ionicons name="trash" size={20} color={Colors.on_primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.primaryAction}
              onPress={() => 
                startChat(
                  skill.userId,
                  authorProfile?.name || skill.userName || 'Campus Student',
                  router,
                  {
                    type: "skill",
                    title: skill.title,
                    itemId: skill.id
                  }
                )
              }
            >
              <LinearGradient 
                colors={isOffer ? Gradients.primary : [Colors.tertiary, Colors.tertiary_container]} 
                style={styles.mainActionGrad}
                start={{x:0, y:0}} end={{x:1, y:1}}
              >
                <Ionicons name="sparkles" size={22} color={Colors.on_primary} />
                <Text style={styles.mainActionText}>{isOffer ? 'Request Learning' : 'Offer Mentorship'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </BlurView>
      </View>

      <ModernAlert 
        visible={showDeleteAlert}
        title="Strike Expertise?"
        message="This will remove your skill profile from the CampusForge archives permanently."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteAlert(false)}
        confirmText="Strike"
        isDestructive
      />

      <ImageViewing
        images={(skill.imageUrls || (skill.imageUrl ? [skill.imageUrl] : [])).map((url: string) => ({ uri: url }))}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        animationType="fade"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  errorText: { ...Typography.title, color: Colors.on_surface_variant, marginTop: 12 },
  backBtn: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, borderRadius: Roundness.md, backgroundColor: Colors.surface_container_high },
  backBtnText: { ...Typography.label, color: Colors.on_background },

  scrollContent: { paddingBottom: 140 },
  hero: { paddingTop: 80, paddingHorizontal: Spacing.margin, paddingBottom: 80, position: 'relative' },
  heroContent: { alignItems: 'center', marginTop: 20 },
  iconBox: { width: 88, height: 88, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  heroTitle: { ...Typography.display, color: Colors.on_primary, fontSize: 32, textAlign: 'center' },
  heroTags: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  heroTag: { backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Roundness.full },
  heroTagText: { ...Typography.label, color: Colors.on_primary, fontSize: 11, letterSpacing: 1 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },

  absBack: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  backBlur: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },

  content: { paddingHorizontal: Spacing.margin, marginTop: -20 },
  infoBlock: { marginTop: Spacing.xxl },
  sectionHeading: { ...Typography.label, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1.5 },
  description: { ...Typography.body, color: Colors.on_surface_variant, fontSize: 16, lineHeight: 28 },

  identityToken: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: Colors.surface_container_low, 
    padding: Spacing.md, 
    borderRadius: Roundness.lg,
    gap: Spacing.md,
  },
  avatarPill: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarChar: { ...Typography.title, color: Colors.on_primary },
  identityMeta: { flex: 1 },
  identityName: { ...Typography.body_medium, color: Colors.on_background, fontSize: 17 },
  identitySub: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 2 },

  collabRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xxl },
  collabTile: { 
    flex: 1, alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface_container_high,
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm,
    borderRadius: Roundness.md,
  },
  collabLabel: { ...Typography.caption, color: Colors.on_background, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  tacticalBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
  actionBarBlur: { borderRadius: Roundness.full, overflow: 'hidden', ...Shadows.ambient },
  ownerActions: { flexDirection: 'row', padding: 8, gap: 8 },
  actionBtn: { flex: 1, height: 56, borderRadius: 28, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionBtnText: { ...Typography.title, color: Colors.on_primary, fontSize: 16 },
  
  primaryAction: { height: 60 },
  mainActionGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  mainActionText: { ...Typography.title, color: Colors.on_primary, fontSize: 17 },
});
