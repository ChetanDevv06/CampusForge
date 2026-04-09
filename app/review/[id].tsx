import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, addDoc, collection, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function ReviewScreen() {
  const { id } = useLocalSearchParams(); // Target User ID
  const [targetUser, setTargetUser] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const router = useRouter();

  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{title: string, message: string, type: FeedbackType}>({
    title: '', message: '', type: 'info'
  });

  const showFeedback = (title: string, message: string, type: FeedbackType = 'error') => {
    setFeedbackConfig({ title, message, type });
    setFeedbackVisible(true);
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', id as string));
        if (snap.exists()) setTargetUser(snap.data());
      } catch (e) {
        console.error(e);
      } finally {
        setFetching(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      showFeedback('Evidence Required', 'Please share some details about your experience before authorizing this review.');
      return;
    }

    setLoading(true);
    try {
      const reviewerId = auth.currentUser?.uid;
      const reviewerName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Active Agent';

      await addDoc(collection(db, 'reviews'), {
        fromId: reviewerId,
        fromName: reviewerName,
        toId: id,
        rating,
        comment,
        createdAt: serverTimestamp()
      });

      const userRef = doc(db, 'users', id as string);
      const currentRating = targetUser.rating || 5;
      const currentCount = targetUser.reviewCount || 0;
      
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + rating) / newCount;

      await updateDoc(userRef, {
        rating: newRating,
        reviewCount: increment(1)
      });

      showFeedback('Protocol Struck', 'Your peer evaluation has been recorded in the platform archives.', 'success');
      setTimeout(() => router.back(), 1500);
    } catch (e: any) {
      showFeedback('Forge Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <BlurView intensity={30} tint="dark" style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reputation Protocol</Text>
        </View>
      </BlurView>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" 
        >
          <View style={styles.heroSection}>
            <Text style={styles.title}>Forge Integrity</Text>
            <Text style={styles.subtitle}>How was your exchange with {targetUser?.name || 'this agent'}?</Text>
          </View>

          {/* Monumental Rating */}
          <View style={styles.ratingPedestal}>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starBtn}>
                  <Ionicons 
                    name={star <= rating ? "star" : "star-outline"} 
                    size={48} 
                    color={star <= rating ? '#FFD700' : Colors.on_surface_variant} 
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.ratingBadge, { backgroundColor: rating === 5 ? 'rgba(52,238,154,0.1)' : Colors.surface_container_high }]}>
              <Text style={[styles.ratingLabel, rating === 5 && { color: Colors.success }]}>
                {rating === 5 ? 'Exceptional Agent' : rating === 4 ? 'Highly Reliable' : rating === 3 ? 'Professional' : 'Action Required'}
              </Text>
            </View>
          </View>

          {/* Feedback Capture */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionHeading}>Peer Evidence</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.commentInput}
                multiline
                placeholder="Detail your transaction, artifact quality, or communication flow..."
                placeholderTextColor={Colors.on_surface_variant}
                value={comment}
                onChangeText={setComment}
              />
            </View>
          </View>

          {/* Authorize Action */}
          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient 
              colors={Gradients.primary} 
              style={styles.submitGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.on_primary} />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={22} color={Colors.on_primary} />
                  <Text style={styles.submitText}>Strike Evaluation</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <FeedbackModal 
        isVisible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
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
  headerTitle: { ...Typography.title, color: Colors.on_background, fontSize: 20 },

  scrollContent: { paddingHorizontal: Spacing.margin, paddingTop: Spacing.xl, paddingBottom: 60 },
  
  heroSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.on_background, fontSize: 32, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.on_surface_variant, fontSize: 16, marginTop: 8, textAlign: 'center' },

  ratingPedestal: { alignItems: 'center', marginBottom: Spacing.xxl },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  starBtn: { padding: 4 },
  ratingBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Roundness.full },
  ratingLabel: { ...Typography.label, color: Colors.on_background, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },

  inputSection: { gap: Spacing.md },
  sectionHeading: { ...Typography.label, color: Colors.primary, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1.5 },
  inputContainer: { 
    backgroundColor: Colors.surface_container_low, 
    borderRadius: Roundness.lg,
    padding: Spacing.md,
    ...Shadows.ambient
  },
  commentInput: { 
    ...Typography.body, color: Colors.on_background, 
    fontSize: 16, lineHeight: 24, minHeight: 160, textAlignVertical: 'top' 
  },

  submitBtn: { height: 60, borderRadius: Roundness.full, overflow: 'hidden', marginTop: Spacing.xxl, ...Shadows.ambient },
  submitGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitText: { ...Typography.title, color: Colors.on_primary, fontSize: 17 },
});
