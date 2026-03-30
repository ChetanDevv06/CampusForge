import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { db, auth } from '../../firebaseConfig';
import { Colors, Gradients } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { startChat } from '../../utils/chat';

export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'lost_found', id)).then(snap => {
      if (snap.exists()) {
        setItem({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this listing? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, 'lost_found', id!));
              router.back();
            } catch (e) {
              console.error(e);
              Alert.alert("Error", "Failed to delete the post. Please try again.");
              setLoading(false);
            }
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.error}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Item not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = uid === item.userId;
  const isLost = item.type === 'lost';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Header Image / Gradient */}
        <View style={styles.hero}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.heroImage} />
          ) : (
            <LinearGradient colors={isLost ? Gradients.lostBadge : Gradients.foundBadge} style={styles.heroGradient} />
          )}
          
          <TouchableOpacity style={styles.absBack} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={styles.backBlur}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </BlurView>
          </TouchableOpacity>

          <LinearGradient colors={['transparent', 'rgba(10,10,18,0.8)', Colors.bg]} style={styles.heroOverlay} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <LinearGradient 
              colors={isLost ? Gradients.lostBadge : Gradients.foundBadge} 
              style={styles.typeBadge} 
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
            </LinearGradient>
            <View style={[styles.statusBadge, { borderColor: item.status === 'resolved' ? Colors.success : Colors.primary }]}>
              <Text style={[styles.statusText, { color: item.status === 'resolved' ? Colors.success : Colors.primary }]}>
                {item.status === 'resolved' ? 'RESOLVED' : 'OPEN'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="location" size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.metaLabel}>Location</Text>
                <Text style={styles.metaValue}>{item.location}</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="calendar" size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.metaLabel}>Date Reported</Text>
                <Text style={styles.metaValue}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Posted By</Text>
          <View style={styles.authorCard}>
            <LinearGradient colors={Gradients.primary} style={styles.authorAvatar}>
              <Text style={styles.authorInitial}>{(item.userName || item.userEmail || 'S').charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{item.userName || item.userEmail?.split('@')[0] || 'Campus User'}</Text>
              <Text style={styles.authorRole}>Student • Verified</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Bar */}
      {isOwner ? (
        <View style={styles.actionBar}>
          <BlurView intensity={80} tint="dark" style={styles.actionBlur}>
            <TouchableOpacity 
              style={styles.mainAction}
              onPress={handleDelete}
            >
              <LinearGradient colors={['#FF5E5E', '#D13838']} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="trash-outline" size={20} color="#FFF" />
                <Text style={styles.actionText}>Delete My Post</Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      ) : (
        item.status !== 'resolved' && (
          <View style={styles.actionBar}>
            <BlurView intensity={80} tint="dark" style={styles.actionBlur}>
              <TouchableOpacity 
                style={styles.mainAction}
                onPress={() => startChat(item.userId, item.userName || item.userEmail?.split('@')[0] || 'Student', router)}
              >
                <LinearGradient colors={Gradients.primary} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
                  <Text style={styles.actionText}>Message Finder/Owner</Text>
                </LinearGradient>
              </TouchableOpacity>
            </BlurView>
          </View>
        )
      )}
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
  hero: { height: 350, position: 'relative' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradient: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
  absBack: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  backBlur: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  content: { paddingHorizontal: 20, marginTop: -40 },
  headerRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  typeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 24 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(124,111,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  metaLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },
  metaValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 24 },
  authorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgSurface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  authorInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  authorRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, paddingHorizontal: 20, justifyContent: 'center' },
  actionBlur: { borderRadius: 24, overflow: 'hidden' },
  mainAction: { height: 60, borderRadius: 24 },
  actionGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
