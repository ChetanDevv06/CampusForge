import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, ScrollView, StatusBar, Image, 
  KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../utils/storage';
import ImageSourceModal from '../components/ImageSourceModal';
import FeedbackModal, { FeedbackType } from '../components/FeedbackModal';

const { width } = Dimensions.get('window');

export default function PostItemScreen() {
  const { editId, initialType } = useLocalSearchParams<{ editId?: string, initialType?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    if (initialType === 'found') setType('found');
    else if (initialType === 'lost') setType('lost');
  }, [initialType]);
  
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
          const docSnap = await getDoc(doc(db, 'lost_found', editId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.title);
            setDescription(data.description);
            setLocation(data.location);
            setType(data.type);
            setImage(data.imageUrl);
          }
        } catch (e: any) {
          showFeedback('Error', 'Failed to fetch item details.');
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
    // 1. Close Modal immediately to prevent UI collisions
    setShowModal(false);
    
    // 2. Longer delay to ensure the screen is clear for the picker
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (useCamera) {
          console.log('📸 [Item] Requesting Camera permissions...');
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showFeedback('Permission Required', 'CampusLoop needs camera access to capture visual proof of the item.');
          return;
        }
      } else {
          console.log('🖼️ [Item] Requesting Media Library permissions...');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showFeedback('Permission Required', 'CampusLoop needs gallery access to retrieve item imagery.');
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: Platform.OS === 'ios',
        aspect: [4, 3],
        quality: 0.7,
      };

      console.log(`🚀 [Item] Launching ${useCamera ? 'Camera' : 'Gallery'}...`);
      const result = useCamera 
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('❌ [Item] Capture error:', error);
      showFeedback('Capture Failed', `An error occurred: ${error.message || 'Unknown error'}`);
    }
  };

  const handlePost = async () => {
    if (!title || !description || !location) { 
      showFeedback('Missing Details', 'Provide a name, location, and description for the item.'); 
      return; 
    }
    setLoading(true);
    try {
      let imageUrl = image;
      if (image && !image.startsWith('http') && !image.startsWith('data:image')) {
        imageUrl = await uploadImage(image, 'lost_found');
      }

      if (editId) {
        await updateDoc(doc(db, 'lost_found', editId), {
          title, description, location, type,
          updatedAt: new Date().toISOString(),
          imageUrl,
        });
        showFeedback('Updated', 'Report successfully updated.', 'success');
        setTimeout(() => router.replace({ pathname: '/item-details/[id]', params: { id: editId } } as any), 1500);
      } else {
        const docRef = await addDoc(collection(db, 'lost_found'), {
          title, description, location, type,
          userId: user?.uid, userEmail: user?.email,
          userName: (profile as any)?.name || user?.email?.split('@')[0] || 'Campus Student',
          collegeId: profile?.collegeId,
          createdAt: new Date().toISOString(), imageUrl,
        });
        showFeedback('Posted', `Report listed as ${type}.`, 'success');
        setTimeout(() => router.replace({ pathname: '/item-details/[id]', params: { id: docRef.id } } as any), 1500);
      }
    } catch (e: any) { 
      showFeedback('Error', e.message); 
    } finally { setLoading(false); }
  };

  const renderInput = (label: string, icon: string, value: string, setValue: (v: string) => void, placeholder: string, multiline = false) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputWrapper, 
        isFocused === label && styles.inputFocused,
        multiline && styles.textAreaWrapper
      ]}>
        <Ionicons name={icon as any} size={20} color={isFocused === label ? Colors.primary : Colors.on_surface_variant} style={multiline ? { marginTop: 14 } : {}} />
        <TextInput 
          style={[styles.input, multiline && styles.textArea]} 
          placeholder={placeholder} 
          placeholderTextColor={Colors.on_surface_variant} 
          value={value} 
          onChangeText={setValue}
          onFocus={() => setIsFocused(label)}
          onBlur={() => setIsFocused(null)}
          multiline={multiline}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Report Item</Text>

          {/* Premium Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'lost' && styles.typeBtnActive]} 
              onPress={() => setType('lost')}
            >
              {type === 'lost' && <LinearGradient colors={[Colors.error, Colors.error_container]} style={styles.btnFill} />}
              <Text style={[styles.typeBtnText, type === 'lost' && styles.typeBtnTextActive]}>Lost</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'found' && styles.typeBtnActive]} 
              onPress={() => setType('found')}
            >
              {type === 'found' && <LinearGradient colors={[Colors.success, Colors.primary]} style={styles.btnFill} />}
              <Text style={[styles.typeBtnText, type === 'found' && styles.typeBtnTextActive]}>Found</Text>
            </TouchableOpacity>
          </View>

          {/* Image Upload Area */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Add Photo</Text>
            <TouchableOpacity 
              style={styles.imageZone} 
              onPress={() => setShowModal(true)}
            >
              {image ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: image }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setImage(null)}>
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imageEmpty}>
                  <View style={styles.cameraCircle}>
                    <Ionicons name="camera" size={32} color={Colors.primary} />
                  </View>
                  <Text style={styles.imageInstruction}>Snap a clear photo of the item</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {renderInput('Item Name', 'pricetag', title, setTitle, 'What was lost or found?')}
          {renderInput('Location', 'location', location, setLocation, 'Where did you see it?')}
          {renderInput('Details', 'document-text', description, setDescription, 'Any distinguishing features (scratches, stickers, etc)?', true)}

          {/* Social Reach Insight */}
          {memberCount !== null && (
            <View style={styles.reachInsight}>
              <Ionicons name="megaphone" size={20} color={Colors.secondary} />
              <Text style={styles.reachText}>
                Your report will alert <Text style={styles.reachHighlight}>{memberCount}</Text> active students in {profile?.collegeShortName || 'your campus'}.
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={handlePost} disabled={loading} style={styles.postBtnContainer}>
            <LinearGradient colors={Gradients.primary} style={styles.postBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              {loading ? <ActivityIndicator color={Colors.on_primary} /> : <Text style={styles.postBtnText}>{editId ? 'Save Changes' : 'Publish Report'}</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ImageSourceModal 
        isVisible={showModal} 
        onClose={() => setShowModal(false)}
        onSelect={pickImage}
      />

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
  scroll: { paddingHorizontal: Spacing.margin, paddingTop: 60, paddingBottom: 40 },
  title: { ...Typography.display, fontSize: 42, color: Colors.on_background, marginBottom: Spacing.xl },
  typeToggle: { flexDirection: 'row', backgroundColor: Colors.surface_container_low, borderRadius: Roundness.md, padding: 6, marginBottom: Spacing.xl },
  typeBtn: { flex: 1, height: 48, borderRadius: Roundness.md, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  btnFill: { ...StyleSheet.absoluteFillObject },
  typeBtnActive: { ...Shadows.ambient },
  typeBtnText: { ...Typography.label, color: Colors.on_surface_variant },
  typeBtnTextActive: { color: Colors.on_primary },
  imageZone: { width: '100%', height: 220, backgroundColor: Colors.surface_container_low, borderRadius: Roundness.lg, overflow: 'hidden' },
  imageEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  cameraCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surface_container_high, justifyContent: 'center', alignItems: 'center' },
  imageInstruction: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 13 },
  imagePreviewWrap: { flex: 1 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeBtn: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  fieldGroup: { marginBottom: Spacing.xl },
  label: { ...Typography.label, color: Colors.primary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface_container_low, borderRadius: Roundness.md, paddingHorizontal: Spacing.lg, height: 64, gap: Spacing.md },
  inputFocused: { borderWidth: 1.5, borderColor: `${Colors.primary}40` },
  input: { flex: 1, ...Typography.body_medium, color: Colors.on_background },
  textAreaWrapper: { height: 160, alignItems: 'flex-start' },
  textArea: { textAlignVertical: 'top', paddingTop: 18, height: '100%' },
  postBtnContainer: { marginTop: Spacing.xl, ...Shadows.ambient },
  postBtn: { height: 64, borderRadius: Roundness.full, justifyContent: 'center', alignItems: 'center' },
  postBtnText: { ...Typography.title, color: Colors.on_primary, fontSize: 18 },
  reachInsight: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(107,82,255,0.08)', padding: 16, borderRadius: 20, marginTop: Spacing.xl, gap: 12, borderWidth: 1, borderColor: 'rgba(107,82,255,0.15)' },
   reachText: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 13, flex: 1 },
  reachHighlight: { color: Colors.secondary, fontWeight: '700' },
});
