import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform, Dimensions
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { db, auth } from '../../firebaseConfig';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import ImageViewing from 'react-native-image-viewing';

import { startChat } from '../../utils/chat';
import ModernAlert from '../../components/ModernAlert';
import LocationPreview from '../../components/LocationPreview';

export default function MarketDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        const snap = await getDoc(doc(db, 'marketplace', id));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as any;
          setProduct(data);
          
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
    fetchProduct();
  }, [id]);

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'marketplace', product.id));
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Forge Error", "Failed to relinquish this listing.");
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

  if (!product) {
    return (
      <View style={styles.error}>
        <Ionicons name="alert-circle" size={64} color={Colors.surface_container_high} />
        <Text style={styles.errorText}>Listing not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Return to Market</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = uid === product.userId;
  const isSold = product.status === 'sold';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* Visual Showcase */}
        <View style={styles.hero}>
          {product.videoUrl ? (
            <Video
              source={{ uri: product.videoUrl }}
              style={[styles.heroImage, { backgroundColor: '#000' }]}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
          ) : (product.imageUrls && product.imageUrls.length > 0) ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.heroImage}>
              {product.imageUrls.map((url: string, idx: number) => (
                <TouchableOpacity 
                  key={idx} 
                  activeOpacity={0.9} 
                  onPress={() => { setViewerIndex(idx); setViewerVisible(true); }}
                >
                  <Image source={{ uri: url }} style={{ width, height: 400 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : product.imageUrl ? (
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => { setViewerIndex(0); setViewerVisible(true); }}
            >
              <Image source={{ uri: product.imageUrl }} style={styles.heroImage} />
            </TouchableOpacity>
          ) : (
            <LinearGradient colors={Gradients.primary} style={styles.heroPlaceholder}>
              <Ionicons name="cart" size={80} color={Colors.on_primary} />
            </LinearGradient>
          )}

          <TouchableOpacity style={styles.absBack} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={styles.backBlur}>
              <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
            </BlurView>
          </TouchableOpacity>

          <LinearGradient 
            colors={['transparent', 'rgba(10,10,18,0.4)', Colors.background]} 
            style={styles.heroOverlay} 
          />
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleArea}>
              <Text style={styles.marketTitle}>{product.title}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.catPill}>
                  <Text style={styles.catPillText}>{product.category}</Text>
                </View>
                {isSold && (
                  <View style={styles.soldPill}>
                    <Text style={styles.soldPillText}>SOLD</Text>
                  </View>
                )}
              </View>
            </View>
            <LinearGradient colors={Gradients.primary} style={styles.pricePillar}>
              <Text style={styles.priceVal}>₹{product.price}</Text>
            </LinearGradient>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.sectionHeading}>Product Details</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          {/* Seller Presence */}
          <View style={styles.infoBlock}>
            <Text style={styles.sectionHeading}>Seller presence</Text>
            <TouchableOpacity 
              style={styles.sellerToken}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: product.userId } } as any)}
            >
              <View style={styles.sellerAvatarBox}>
                {authorProfile?.avatarUrl ? (
                  <Image source={{ uri: authorProfile.avatarUrl }} style={styles.sellerAvatar} />
                ) : (
                  <LinearGradient colors={Gradients.primary} style={styles.sellerAvatar}>
                    <Text style={styles.avatarText}>{(authorProfile?.name || 'S')[0]}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{authorProfile?.name || 'Campus Student'}</Text>
                <Text style={styles.sellerStatus}>Verified Merchant • {authorProfile?.college || 'Verified'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.on_surface_variant} />
            </TouchableOpacity>
          </View>

          {/* Trust Matrix */}
          <View style={styles.trustMatrix}>
            <View style={styles.trustTile}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
              <Text style={styles.trustLabel}>Verified Listing</Text>
            </View>
            <View style={styles.trustTile}>
              <Ionicons name="flash" size={20} color={Colors.primary} />
              <Text style={styles.trustLabel}>Same-day Exchange</Text>
            </View>
          </View>

          {/* Premium Location Preview */}
          <LocationPreview 
            location={product.location} 
            locationCoords={product.locationCoords} 
            title="Meeting Spot" 
          />
        </View>
      </ScrollView>

      {/* Floating Tactical Bar */}
      {!isSold && (
        <View style={[styles.tacticalBar, { paddingBottom: Platform.OS === 'ios' ? 40 : 20 }]}>
          <BlurView intensity={30} tint="dark" style={styles.actionBarBlur}>
            {isOwner ? (
              <View style={styles.ownerActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => router.push({ pathname: '/post-market', params: { editId: product.id } } as any)}
                >
                  <Ionicons name="create" size={20} color={Colors.on_primary} />
                  <Text style={styles.actionBtnText}>Edit Forge</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.deleteBtn]}
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
                    product.userId,
                    authorProfile?.name || product.userName || 'Campus Seller',
                    router,
                    {
                      type: "market",
                      title: product.title,
                      image: product.imageUrl,
                      itemId: product.id
                    }
                  )
                }
              >
                <LinearGradient 
                  colors={Gradients.primary} 
                  style={styles.mainActionGrad}
                  start={{x:0, y:0}} end={{x:1, y:1}}
                >
                  <Ionicons name="chatbubbles" size={22} color={Colors.on_primary} />
                  <Text style={styles.mainActionText}>Contact Merchant</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      )}

      <ModernAlert 
        visible={showDeleteAlert}
        title="Relinquish Listing?"
        message="Destroying this listing is permanent. It will be struck from the CampusForge archives."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteAlert(false)}
        confirmText="Relinquish"
        isDestructive
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
  hero: { height: 420 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  
  absBack: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  backBlur: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },

  content: { paddingHorizontal: Spacing.margin, marginTop: -40 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  titleArea: { flex: 1 },
  marketTitle: { ...Typography.display, color: Colors.on_background, fontSize: 32 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  catPill: { backgroundColor: Colors.surface_container_high, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Roundness.full },
  catPillText: { ...Typography.label, color: Colors.on_surface_variant, fontSize: 11 },
  soldPill: { backgroundColor: Colors.error_container, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Roundness.full },
  soldPillText: { ...Typography.label, color: Colors.error, fontSize: 11 },
  
  pricePillar: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: Roundness.md, ...Shadows.ambient },
  priceVal: { ...Typography.headline, color: Colors.on_primary, fontSize: 22 },

  infoBlock: { marginTop: Spacing.xxl },
  sectionHeading: { ...Typography.label, color: Colors.primary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1.5 },
  description: { ...Typography.body, color: Colors.on_surface_variant, fontSize: 16, lineHeight: 26 },

  sellerToken: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: Colors.surface_container_low, 
    padding: Spacing.md, 
    borderRadius: Roundness.lg,
    gap: Spacing.md,
  },
  sellerAvatarBox: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sellerAvatar: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...Typography.title, color: Colors.on_primary },
  sellerInfo: { flex: 1 },
  sellerName: { ...Typography.body_medium, color: Colors.on_background, fontSize: 16 },
  sellerStatus: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 2 },

  trustMatrix: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xxl },
  trustTile: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface_container_high,
    padding: Spacing.md, borderRadius: Roundness.md,
  },
  trustLabel: { ...Typography.caption, color: Colors.on_background, fontSize: 11, fontWeight: '700' },

  tacticalBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
  actionBarBlur: { borderRadius: Roundness.full, overflow: 'hidden', ...Shadows.ambient },
  ownerActions: { flexDirection: 'row', padding: 8, gap: 8 },
  actionBtn: { height: 56, borderRadius: 28, flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 8 },
  editBtn: { flex: 1, backgroundColor: Colors.primary },
  deleteBtn: { width: 56, backgroundColor: Colors.error },
  actionBtnText: { ...Typography.title, color: Colors.on_primary, fontSize: 16 },
  
  primaryAction: { height: 60 },
  mainActionGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  mainActionText: { ...Typography.title, color: Colors.on_primary, fontSize: 17 },
});
