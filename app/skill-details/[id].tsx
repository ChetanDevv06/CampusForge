import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors, Gradients } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';
import { startChat } from '../../utils/chat';

export default function SkillDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [skill, setSkill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'skills', id)).then(snap => {
      if (snap.exists()) {
        setSkill({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    Alert.alert(
      "Delete Skill",
      "Are you sure you want to delete this skill listing? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, 'skills', id!));
              router.back();
            } catch (e) {
              console.error(e);
              Alert.alert("Error", "Failed to delete the skill. Please try again.");
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

  if (!skill) {
    return (
      <View style={styles.error}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Skill listing not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = uid === skill.userId;
  const isOffer = skill.type === 'offer';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header Hero */}
        <LinearGradient colors={isOffer ? Gradients.skillOffer : Gradients.skillRequest} style={styles.hero}>
          <TouchableOpacity style={styles.absBack} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={styles.backBlur}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </BlurView>
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <View style={styles.iconBox}>
              <Ionicons name={isOffer ? 'bulb' : 'book'} size={32} color="#FFF" />
            </View>
            <Text style={styles.heroTitle}>{skill.title}</Text>
            <View style={styles.heroPills}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{skill.category}</Text>
              </View>
              <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.heroPillText}>{isOffer ? 'Offering' : 'Requesting'}</Text>
              </View>
            </View>
          </View>

          <LinearGradient colors={['transparent', 'rgba(10,10,18,0.5)', Colors.bg]} style={styles.heroOverlay} />
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.description}>{skill.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Instructor / Learner</Text>
          <View style={styles.authorCard}>
            <LinearGradient colors={Gradients.primary} style={styles.authorAvatar}>
              <Text style={styles.authorInitial}>{(skill.userName || 'S').charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{skill.userName || 'Campus Student'}</Text>
              <Text style={styles.authorRole}>Skills Exchange Member</Text>
            </View>
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: skill.userId } } as any)}
            >
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.reviewBtnText}>Reviews</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Quick Info Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color={isOffer ? Colors.primary : Colors.warning} />
              <Text style={styles.infoValue}>Flexible Timing</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="people-outline" size={20} color={isOffer ? Colors.primary : Colors.warning} />
              <Text style={styles.infoValue}>1-on-1 Sessions</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="school-outline" size={20} color={isOffer ? Colors.primary : Colors.warning} />
              <Text style={styles.infoValue}>Peer Learning</Text>
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
                <Text style={styles.actionText}>Delete My Skill</Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      ) : (
        skill.status !== 'completed' && (
          <View style={styles.actionBar}>
            <BlurView intensity={80} tint="dark" style={styles.actionBlur}>
              <TouchableOpacity
                style={styles.mainAction}
                onPress={() =>
                  startChat(
                    skill.userId,
                    skill.userName || 'Campus Student',
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
                  colors={isOffer ? Gradients.skillOffer : Gradients.skillRequest}
                  style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="sparkles" size={20} color="#FFF" />
                  <Text style={styles.actionText}>{isOffer ? 'Request Learning Session' : 'Teach this Skill'}</Text>
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
  hero: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 60, position: 'relative' },
  heroContent: { alignItems: 'center', marginTop: 20 },
  iconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 12 },
  heroPills: { flexDirection: 'row', gap: 8 },
  heroPill: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  heroPillText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
  absBack: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  backBlur: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  content: { paddingHorizontal: 20, marginTop: -20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 26 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 32 },
  authorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgSurface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  authorInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  authorRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  reviewBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  infoItem: { flex: 1, alignItems: 'center', gap: 8, padding: 12, backgroundColor: Colors.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  infoValue: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700', textAlign: 'center' },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, paddingHorizontal: 20, justifyContent: 'center' },
  actionBlur: { borderRadius: 24, overflow: 'hidden' },
  mainAction: { height: 60, borderRadius: 24 },
  actionGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
