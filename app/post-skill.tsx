import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, ScrollView, StatusBar, 
  KeyboardAvoidingView, Platform, Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import FeedbackModal, { FeedbackType } from '../components/FeedbackModal';

const { width } = Dimensions.get('window');

export default function PostSkillScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'offer' | 'request'>('offer');
  const [loading, setLoading] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  
  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{title: string, message: string, type: FeedbackType}>({
    title: '', message: '', type: 'info'
  });

  const showFeedback = (title: string, message: string, type: FeedbackType = 'error') => {
    setFeedbackConfig({ title, message, type });
    setFeedbackVisible(true);
  };
  
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (editId) {
      const fetchSkill = async () => {
        setLoading(true);
        try {
          const docSnap = await getDoc(doc(db, 'skills', editId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.title);
            setCategory(data.category);
            setDescription(data.description);
            setType(data.type);
          }
        } catch (e: any) {
          showFeedback('Forge Error', 'Failed to retrieve expertise details.');
        } finally {
          setLoading(false);
        }
      };
      fetchSkill();
    }
  }, [editId]);

  useEffect(() => {
    if (profile?.collegeId) {
      getDoc(doc(db, 'colleges', profile.collegeId)).then(snap => {
        if (snap.exists()) setMemberCount(snap.data().memberCount || 0);
      });
    }
  }, [profile?.collegeId]);

  const handlePost = async () => {
    if (!title || !category || !description) { 
      showFeedback('Draft Incomplete', 'Title, Syllabus, and Category are required for the forge.'); 
      return; 
    }
    setLoading(true);
    try {
      const payload = {
        title, category, description, type,
        updatedAt: serverTimestamp(),
      };

      if (editId) {
        await updateDoc(doc(db, 'skills', editId), payload);
        showFeedback('Mastery Updated', 'Your expertise profile has been successfully refined.', 'success');
        setTimeout(() => router.back(), 1500);
      } else {
        const docRef = await addDoc(collection(db, 'skills'), {
          ...payload,
          userId: user?.uid, userEmail: user?.email,
          userName: (profile as any)?.name || user?.displayName || 'Expert',
          collegeId: profile?.collegeId,
          createdAt: serverTimestamp(),
          status: 'open',
        });
        showFeedback('Mastery Sealed', 'Your expertise is now live in the talent hub.', 'success');
        setTimeout(() => router.replace({ pathname: '/skill-details/[id]', params: { id: docRef.id } } as any), 1500);
      }
    } catch (e: any) { 
      showFeedback('Forge Error', e.message); 
    } finally { setLoading(false); }
  };

  const accentColor = type === 'offer' ? Colors.primary : Colors.tertiary;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
        </TouchableOpacity>
        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>{editId ? 'Refine Mastery' : 'Draft Expertise'}</Text>
          <Text style={styles.headerSub}>Share knowledge across the campus forge</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tone Switch */}
          <View style={styles.toneSwitchArea}>
            <Text style={styles.sectionLabel}>Forge Protocol</Text>
            <View style={styles.tonePill}>
              <TouchableOpacity 
                style={[styles.toneOption, type === 'offer' && styles.toneOptionActive]} 
                onPress={() => setType('offer')}
              >
                {type === 'offer' && <LinearGradient colors={Gradients.primary} style={StyleSheet.absoluteFill} />}
                <Text style={[styles.toneText, type === 'offer' && styles.toneTextActive]}>Mentoring</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.toneOption, type === 'request' && styles.toneOptionActive]} 
                onPress={() => setType('request')}
              >
                {type === 'request' && <LinearGradient colors={[Colors.tertiary, Colors.tertiary_container]} style={StyleSheet.absoluteFill} />}
                <Text style={[styles.toneText, type === 'request' && styles.toneTextActive]}>Learning</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Area */}
          <View style={styles.formArea}>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Expertise Title</Text>
              <View style={styles.inputContainer}>
                <Ionicons name={type === 'offer' ? 'bulb' : 'search'} size={20} color={accentColor} />
                <TextInput 
                  style={styles.input}
                  placeholder={type === 'offer' ? "What will you teach?" : "What do you want to learn?"}
                  placeholderTextColor={Colors.on_surface_variant}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Field of Knowledge</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="layers" size={20} color={accentColor} />
                <TextInput 
                  style={styles.input}
                  placeholder="e.g., Computer Science, Linguistics"
                  placeholderTextColor={Colors.on_surface_variant}
                  value={category}
                  onChangeText={setCategory}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Mastery Syllabus</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput 
                  style={styles.textArea}
                  placeholder="Draft the details of your session, topics covered, and what users should expect..."
                  placeholderTextColor={Colors.on_surface_variant}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          </View>

          {/* Social Reach Insight */}
          {memberCount !== null && (
            <View style={styles.reachInsight}>
              <View style={styles.reachIconWrapper}>
                <Ionicons name="megaphone" size={22} color={Colors.on_primary} />
              </View>
              <View style={styles.reachContent}>
                <Text style={styles.reachTitle}>Community Reach</Text>
                <Text style={styles.reachText}>
                  Your {type === 'offer' ? 'expertise' : 'request'} will be visible to <Text style={styles.reachHighlight}>{memberCount}+ students</Text> in this zone.
                </Text>
              </View>
            </View>
          )}

          {/* Primary Action */}
          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handlePost} 
            disabled={loading}
          >
            <LinearGradient 
              colors={type === 'offer' ? Gradients.primary : [Colors.tertiary, Colors.tertiary_container]} 
              style={styles.submitGrad}
              start={{x:0, y:0}} end={{x:1, y:1}}
            >
              {loading ? <ActivityIndicator color={Colors.on_primary} /> : <Text style={styles.submitText}>{editId ? 'Forge Changes' : 'Seal Expertise'}</Text>}
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
  header: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface_container_high, justifyContent: 'center', alignItems: 'center' },
  headerTitleArea: { flex: 1 },
  headerTitle: { ...Typography.display, color: Colors.on_background, fontSize: 24 },
  headerSub: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 2 },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingTop: Spacing.md, paddingBottom: 60 },
  toneSwitchArea: { marginBottom: Spacing.xl },
  sectionLabel: { ...Typography.label, color: Colors.primary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1.5 },
  tonePill: {
    flexDirection: 'row',
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.full,
    padding: 6,
    overflow: 'hidden',
  },
  toneOption: {
    flex: 1, height: 44, borderRadius: Roundness.full,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  toneOptionActive: { ...Shadows.ambient },
  toneText: { ...Typography.label, color: Colors.on_surface_variant, fontSize: 13 },
  toneTextActive: { color: Colors.on_primary },
  formArea: { gap: Spacing.xl },
  fieldBlock: { gap: Spacing.sm },
  fieldLabel: { ...Typography.label, color: Colors.on_surface_variant, marginLeft: 4 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.md,
    paddingHorizontal: Spacing.md,
    minHeight: 56,
    gap: Spacing.sm,
  },
  input: { flex: 1, ...Typography.body_medium, color: Colors.on_background, fontSize: 16 },
  textAreaContainer: { alignItems: 'flex-start', paddingVertical: Spacing.md },
  textArea: { flex: 1, ...Typography.body, color: Colors.on_background, fontSize: 15, minHeight: 140, textAlignVertical: 'top' },
  submitBtn: { height: 60, borderRadius: Roundness.full, overflow: 'hidden', marginTop: Spacing.xl, ...Shadows.ambient },
  submitGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitText: { ...Typography.title, color: Colors.on_primary, fontSize: 18 },
  reachInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface_container_low,
    padding: 20,
    borderRadius: 24,
    marginTop: Spacing.xl,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reachIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(107,82,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reachContent: { flex: 1 },
  reachTitle: { ...Typography.title, color: Colors.on_background, fontSize: 18, marginBottom: 2 },
  reachText: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 14, lineHeight: 20 },
  reachHighlight: { color: Colors.on_background, fontWeight: '700' },
});
