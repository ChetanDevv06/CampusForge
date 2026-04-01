import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { db, auth } from '../../firebaseConfig';
import { Colors, Gradients } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { startChat } from '../../utils/chat';
import ModernAlert from '../../components/ModernAlert';

export default function MarketDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        const snap = await getDoc(doc(db, 'marketplace', id));
        if (snap.exists()) {
          const data = snap.id ? { id: snap.id, ...snap.data() } : snap.data();
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
      const productId = (product as any).id;
      await deleteDoc(doc(db, 'marketplace', productId));
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to delete the product. Please try again.");
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
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = uid === product.userId;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* Visual Header */}
        <View style={styles.hero}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.heroImage} />
          ) : (
            <LinearGradient colors={Gradients.primary} style={styles.heroGradient}>
              <Ionicons name="storefront-outline" size={64} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          )}

          <TouchableOpacity style={styles.absBack} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={styles.backBlur}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </BlurView>
          </TouchableOpacity>

          <LinearGradient colors={['transparent', 'rgba(10,10,18,0.5)', Colors.bg]} style={styles.heroOverlay} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.priceRow}>
            <Text style={styles.title}>{product.title}</Text>
            <LinearGradient colors={Gradients.primary} style={styles.priceTag} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.priceText}>₹{product.price}</Text>
            </LinearGradient>
          </View>

          <View style={styles.catPill}>
            <Ionicons name="pricetag-outline" size={12} color={Colors.primary} />
            <Text style={styles.catText}>{product.category}</Text>
            <View style={styles.dot} />
            <Text style={[styles.catText, { color: product.status === 'sold' ? Colors.danger : Colors.success }]}>
              {product.status?.toUpperCase() || 'AVAILABLE'}
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Product Details</Text>
          <Text style={styles.description}>{product.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Seller Information</Text>
          <View style={styles.sellerCard}>
            {authorProfile?.avatarUrl ? (
              <Image source={{ uri: authorProfile.avatarUrl }} style={styles.sellerAvatar} />
            ) : (
              <LinearGradient colors={Gradients.primary} style={styles.sellerAvatar}>
                <Text style={styles.sellerInitial}>{(authorProfile?.name || product.userName || 'S').charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{authorProfile?.name || product.userName || product.userEmail?.split('@')[0] || 'Campus Seller'}</Text>
              <Text style={styles.sellerRole}>Student • Verified</Text>
            </View>
            <TouchableOpacity  
              style={styles.reviewBtn}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: product.userId } } as any)}
            >
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.reviewBtnText}>Reviews</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.success} />
              <Text style={styles.trustText}>Verified Seller</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
              <Text style={styles.trustText}>Safe Payment</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Bar */}
      {isOwner ? (
        <View style={styles.actionBar}>
          <BlurView intensity={80} tint="dark" style={styles.actionBlur}>
            <View style={styles.dualActions}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() => router.push({ pathname: '/post-market', params: { editId: product.id } } as any)}
              >
                <Ionicons name="create-outline" size={20} color="#FFF" />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => setShowDeleteAlert(true)}
              >
                <Ionicons name="trash-outline" size={20} color="#FFF" />
                <Text style={styles.actionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      ) : (
        product.status !== 'sold' && (
          <View style={styles.actionBar}>
            <BlurView intensity={80} tint="dark" style={styles.actionBlur}>
              <TouchableOpacity 
                style={styles.mainAction}
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
                  style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
                  <Text style={styles.actionText}>Message Seller</Text>
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>
          </View>
        )
      )}

      <ModernAlert 
        visible={showDeleteAlert}
        title="Delete Listing?"
        message="This action cannot be undone. Your item will be removed from the marketplace permanently."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteAlert(false)}
        confirmText="Internal Delete"
        isDestructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  error: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { color: Colors.textMuted, fontSize: 16, marginTop: 12, marginBottom: 24 },
  backBtn: { backgroundColor: Colors.bgSurface, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { color: Colors.textPrimary, fontWeight: '700' },
  hero: { height: 400, position: 'relative' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  absBack: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  backBlur: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  content: { paddingHorizontal: 20, marginTop: -30 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  priceTag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 },
  priceText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.bgSurface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border },
  catText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 24 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgSurface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sellerInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  sellerRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  authorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgSurface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  authorInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  authorRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  reviewBtnText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  trustRow: { flexDirection: 'row', gap: 15, marginTop: 20 },
  trustItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(52,238,154,0.05)', borderRadius: 14 },
  trustText: { fontSize: 11, color: Colors.textPrimary, fontWeight: '700' },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, paddingHorizontal: 20, justifyContent: 'center' },
  actionBlur: { borderRadius: 24, overflow: 'hidden' },
  mainAction: { height: 60, borderRadius: 24 },
  actionGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dualActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  editBtn: {
    backgroundColor: Colors.primary,
  },
  deleteBtn: {
    backgroundColor: Colors.danger,
  },
});
