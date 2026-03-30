import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, addDoc, collection, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';
import FeedbackModal, { FeedbackType } from '../../components/FeedbackModal';

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

  React.useEffect(() => {
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
      showFeedback('Missing Feedback', 'Please share some details about your experience before submitting.');
      return;
    }

    setLoading(true);
    try {
      const reviewerId = auth.currentUser?.uid;
      const reviewerName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'A Student';

      // 1. Add to reviews collection
      await addDoc(collection(db, 'reviews'), {
        fromId: reviewerId,
        fromName: reviewerName,
        toId: id,
        rating,
        comment,
        createdAt: new Date().toISOString()
      });

      // 2. Update target user's aggregate rating
      const userRef = doc(db, 'users', id as string);
      const currentRating = targetUser.rating || 5;
      const currentCount = targetUser.reviewCount || 0;
      
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + rating) / newCount;

      await updateDoc(userRef, {
        rating: newRating,
        reviewCount: increment(1)
      });

      showFeedback('Thank You!', 'Your review has been submitted successfully.', 'success');
      setTimeout(() => router.back(), 2000);
    } catch (e: any) {
      showFeedback('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <Text style={styles.title}>Rate Experience</Text>
          <Text style={styles.subtitle}>How was your exchange with {targetUser?.name}?</Text>
        </View>

        {/* Star Rating */}
        <View style={styles.ratingBox}>
          {[1, 2, 3, 4, 5].map(star => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.star}>
              <Ionicons 
                name={star <= rating ? "star" : "star-outline"} 
                size={42} 
                color={star <= rating ? "#FFD700" : Colors.textMuted} 
              />
            </TouchableOpacity>
          ))}
          <Text style={styles.ratingText}>
            {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : 'Needs Work'}
          </Text>
        </View>

        {/* Feedback Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Detailed Feedback</Text>
          <TextInput
            style={styles.commentInput}
            multiline
            numberOfLines={4}
            placeholder="Share your thoughts on the transaction, response time, or item quality..."
            placeholderTextColor={Colors.textMuted}
            value={comment}
            onChangeText={setComment}
          />
        </View>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient 
            colors={Gradients.primary} 
            style={styles.btnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Submit Review</Text>}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      <FeedbackModal 
        isVisible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  ratingBox: { alignItems: 'center', marginBottom: 40 },
  star: { padding: 5 },
  ratingText: { marginTop: 16, fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  inputSection: { marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 12, marginLeft: 4 },
  commentInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    color: Colors.textPrimary,
    fontSize: 15,
    textAlignVertical: 'top',
    height: 120,
  },
  submitBtn: { borderRadius: 16, overflow: 'hidden' },
  btnGradient: { paddingVertical: 18, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
