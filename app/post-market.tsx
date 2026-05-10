import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, ScrollView, StatusBar, Image, 
  KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../utils/storage';
import { moderateWithAI, moderateWithGemini } from '../utils/moderation';
import * as FileSystem from 'expo-file-system';
import ImageSourceModal from '../components/ImageSourceModal';
import FeedbackModal, { FeedbackType } from '../components/FeedbackModal';

const { width } = Dimensions.get('window');

export default function PostMarketScreen() {
  const { editId, initialCategory } = useLocalSearchParams<{ editId?: string, initialCategory?: string }>();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

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
      const fetchItem = async () => {
        setLoading(true);
        try {
          const docSnap = await getDoc(doc(db, 'marketplace', editId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.title);
            setPrice(data.price.toString());
            setCategory(data.category);
            setDescription(data.description || '');
            setImage(data.imageUrl);
          }
        } catch (e: any) {
          showFeedback('Error', 'Failed to retrieve details.');
        } finally {
          setLoading(false);
        }
      };
      fetchItem();
    }
  }, [editId]);

  useEffect(() => {
    if (profile?.collegeId) {
      getDoc(doc(db, 'colleges', profile.collegeId)).then(snap => {
        if (snap.exists()) setMemberCount(snap.data().memberCount || 0);
      });
    }
  }, [profile?.collegeId]);

  const pickImage = async (useCamera: boolean) => {
    setShowModal(false);
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showFeedback('Permission Denied', 'Camera access is required to take a photo of your item.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showFeedback('Permission Denied', 'Gallery access is required to pick a photo.');
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: Platform.OS === 'ios',
        aspect: [4, 3],
        quality: 0.9,
      };

      const result = useCamera 
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error: any) {
      showFeedback('Error', 'Something went wrong with the photo.');
    }
  };

  const handleList = async () => {
    if (!title || !price || !category) { 
      showFeedback('Wait', 'Please add a Title, Price, and Category.'); 
      return; 
    }
    setLoading(true);
    try {
      let imageUrl = image;
      if (image && !image.startsWith('http') && !image.startsWith('data:image')) {
        imageUrl = await uploadImage(image, `marketplace/${user?.uid}/${Date.now()}`);
      }

      const modTitle = await moderateWithAI(title);
      const modDesc = await moderateWithAI(description);

      // Super-Moderation with Gemini
      let geminiResult = { isFlagged: false, reason: 'Clean' };
      try {
        let base64 = '';
        if (image) {
          base64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
        }
        geminiResult = await moderateWithGemini(`${title} ${description}`, base64);
      } catch (err) {
        console.warn("Gemini skip:", err);
      }

      const finalIsFlagged = modTitle.isFlagged || modDesc.isFlagged || geminiResult.isFlagged;

      const payload = {
        title: modTitle.cleanText, 
        price: parseFloat(price), 
        category, 
        description: modDesc.cleanText,
        imageUrl,
        isFlagged: finalIsFlagged,
        aiModeration: geminiResult,
        updatedAt: serverTimestamp(),
      };

      if (editId) {
        await updateDoc(doc(db, 'marketplace', editId), payload);
        showFeedback('Item Refined', 'The marketplace listing has been successfully updated.', 'success');
        setTimeout(() => router.back(), 1500);
      } else {
        const docRef = await addDoc(collection(db, 'marketplace'), {
          ...payload,
          userId: user?.uid, userEmail: user?.email,
          userName: (profile as any)?.name || user?.displayName || 'Student',
          collegeId: profile?.collegeId,
          createdAt: serverTimestamp(),
          status: 'available',
        });

        if (finalIsFlagged) {
          // Consolidated report for Admin with link to post
          addDoc(collection(db, 'moderation_reports'), {
            type: 'Marketplace Listing',
            postCategory: category,
            postId: docRef.id,
            postCollection: 'marketplace',
            userId: user?.uid,
            userEmail: user?.email,
            userName: profile?.name || 'Student',
            userCollege: profile?.collegeShortName || 'Campus',
            timestamp: serverTimestamp(),
            hasMedia: !!imageUrl,
            aiReport: geminiResult,
            details: {
              title: { text: title, flagged: modTitle.isFlagged },
              description: { text: description, flagged: modDesc.isFlagged }
            },
            resolved: false
          }).catch(err => console.error('Failed to log consolidated report:', err));
        }
        showFeedback('Success!', 'Your item is now live!', 'success');
        setTimeout(() => router.replace({ pathname: '/market-details/[id]', params: { id: docRef.id } } as any), 1500);
      }
    } catch (e: any) { 
      showFeedback('Error', e.message); 
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
        </TouchableOpacity>
        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>{editId ? 'Edit Listing' : 'New Listing'}</Text>
          <Text style={styles.headerSub}>List your item for sale on campus</Text>
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
          <View style={styles.visualDraft}>
            <Text style={styles.sectionLabel}>Add Photo</Text>
            <TouchableOpacity 
              style={styles.imagePedestal} 
              onPress={() => setShowModal(true)}
              activeOpacity={0.9}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImg} />
              ) : (
                <View style={styles.pedestalEmpty}>
                  <LinearGradient colors={Gradients.primary} style={styles.pedestalIcon}>
                    <Ionicons name="camera" size={32} color={Colors.on_primary} />
                  </LinearGradient>
                  <Text style={styles.pedestalText}>Tap to add photo</Text>
                  <Text style={styles.pedestalSub}>Photos help your item sell faster</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formArea}>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Listing Title</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="bag-handle" size={20} color={Colors.primary} />
                <TextInput 
                  style={styles.input}
                  placeholder="e.g., Scientific Calculator"
                  placeholderTextColor={Colors.on_surface_variant}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
            </View>

            <View style={styles.sideBySide}>
              <View style={[styles.fieldBlock, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Price (₹)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="cash" size={20} color={Colors.secondary} />
                  <TextInput 
                    style={styles.input}
                    placeholder="450"
                    placeholderTextColor={Colors.on_surface_variant}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={[styles.fieldBlock, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="grid" size={20} color={Colors.tertiary} />
                  <TextInput 
                    style={styles.input}
                    placeholder="Electronics"
                    placeholderTextColor={Colors.on_surface_variant}
                    value={category}
                    onChangeText={setCategory}
                  />
                </View>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Item Details</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput 
                  style={styles.textArea}
                  placeholder="Describe the condition and reason for selling..."
                  placeholderTextColor={Colors.on_surface_variant}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          </View>

          {memberCount !== null && (
            <View style={styles.reachInsight}>
              <Ionicons name="people" size={20} color={Colors.secondary} />
              <Text style={styles.reachText}>
                Your listing will reach <Text style={styles.reachHighlight}>{memberCount}</Text> active students in {profile?.collegeShortName || 'your campus'}.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleList} 
            disabled={loading}
          >
            <LinearGradient 
              colors={Gradients.primary} 
              style={styles.submitGrad}
              start={{x:0, y:0}} end={{x:1, y:1}}
            >
              {loading ? <ActivityIndicator color={Colors.on_primary} /> : <Text style={styles.submitText}>{editId ? 'Save Changes' : 'Create Listing'}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <ImageSourceModal isVisible={showModal} onClose={() => setShowModal(false)} onSelect={pickImage} />
      <FeedbackModal isVisible={feedbackVisible} onClose={() => setFeedbackVisible(false)} title={feedbackConfig.title} message={feedbackConfig.message} type={feedbackConfig.type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.margin, paddingBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface_container_high, justifyContent: 'center', alignItems: 'center' },
  headerTitleArea: { flex: 1 },
  headerTitle: { ...Typography.display, color: Colors.on_background, fontSize: 24 },
  headerSub: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 2 },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingTop: Spacing.md, paddingBottom: 60 },
  visualDraft: { marginBottom: Spacing.xl },
  sectionLabel: { ...Typography.label, color: Colors.primary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1.5 },
  imagePedestal: { width: '100%', height: 200, borderRadius: Roundness.lg, backgroundColor: Colors.surface_container_low, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', ...Shadows.ambient },
  previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  pedestalEmpty: { alignItems: 'center' },
  pedestalIcon: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  pedestalText: { ...Typography.title, color: Colors.on_background, fontSize: 16 },
  pedestalSub: { ...Typography.caption, color: Colors.on_surface_variant, marginTop: 4 },
  formArea: { gap: Spacing.xl },
  fieldBlock: { gap: Spacing.sm },
  fieldLabel: { ...Typography.label, color: Colors.on_surface_variant, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface_container_low, borderRadius: Roundness.md, paddingHorizontal: Spacing.md, minHeight: 56, gap: Spacing.sm },
  input: { flex: 1, ...Typography.body_medium, color: Colors.on_background, fontSize: 16 },
  sideBySide: { flexDirection: 'row', gap: Spacing.md },
  textAreaContainer: { alignItems: 'flex-start', paddingVertical: Spacing.md },
  textArea: { flex: 1, ...Typography.body, color: Colors.on_background, fontSize: 15, minHeight: 120, textAlignVertical: 'top' },
  submitBtn: { height: 60, borderRadius: Roundness.full, overflow: 'hidden', marginTop: Spacing.xl, ...Shadows.ambient },
  submitGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitText: { ...Typography.title, color: Colors.on_primary, fontSize: 18 },
  reachInsight: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(107,82,255,0.08)', padding: 16, borderRadius: 20, marginTop: Spacing.xl, gap: 12, borderWidth: 1, borderColor: 'rgba(107,82,255,0.15)' },
  reachText: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 13, flex: 1 },
  reachHighlight: { color: Colors.secondary, fontWeight: '700' },
});
