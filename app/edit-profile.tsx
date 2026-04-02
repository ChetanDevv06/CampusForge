import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../utils/storage';
import ImageSourceModal from '../components/ImageSourceModal';
import FeedbackModal, { FeedbackType } from '../components/FeedbackModal';

export default function EditProfileScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState(profile?.name || '');
  const [college, setCollege] = useState(profile?.college || '');
  const [image, setImage] = useState<string | null>(profile?.avatarUrl || null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
    if (profile) {
      setName(profile.name);
      setCollege(profile.college);
      setImage(profile.avatarUrl || null);
    }
  }, [profile]);

  const pickImage = async (useCamera: boolean) => {
    const { status } = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showFeedback('Permission Denied', `Sorry, we need ${useCamera ? 'camera' : 'gallery'} permissions to make this work!`);
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };

    const result = useCamera 
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const showImageSourceOptions = () => {
    setShowModal(true);
  };


  const handleUpdate = async () => {
    if (!name || !college) {
      showFeedback('Missing Info', 'Please enter your name and college to continue.');
      return;
    }

    if (!user) {
      showFeedback('Not Authenticated', 'You must be signed in to update your profile.');
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = profile?.avatarUrl || null;
      
      // Only process if the image URI is a local path (not a remote URL or Base64)
      if (image && !image.startsWith('http') && !image.startsWith('data:image')) {
        console.log("EditProfile: Attempting image processing...");
        avatarUrl = await uploadImage(image, `avatars/${user.uid}`);
      } else if (image === null) {
        avatarUrl = null;
      }

      console.log("EditProfile: Updating Firestore document...");
      await setDoc(doc(db, 'users', user.uid), {
        name,
        college,
        avatarUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      showFeedback('Success', 'Profile updated successfully!', 'success');
      // Delay navigation to let the success modal be seen
      setTimeout(() => router.back(), 2000);
    } catch (error: any) {
      console.error("EditProfile Update Error:", error);
      showFeedback('Update Failed', error.message || "An unexpected error occurred while saving your profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Avatar Selection */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={showImageSourceOptions}>
            {image ? (
              <Image source={{ uri: image }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={Gradients.primary} style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#FFF" />
              </LinearGradient>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change profile picture</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>College / University</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="school-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={college}
                onChangeText={setCollege}
                placeholder="Enter your college name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address (Read-only)</Text>
            <View style={[styles.inputWrapper, styles.disabledInput]}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={[styles.input, { color: Colors.textMuted }]}
                value={profile?.email}
                editable={false}
              />
            </View>
          </View>
        </View>

        {/* Update Button */}
        <TouchableOpacity 
          style={styles.updateBtn} 
          onPress={handleUpdate}
          disabled={loading}
        >
          <LinearGradient 
            colors={Gradients.primary} 
            style={styles.btnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                <Text style={styles.btnText}>Save Changes</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingBottom: 60 },
  avatarContainer: { alignItems: 'center', marginBottom: 32, marginTop: 10 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: Colors.border },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  editBadge: {
    position: 'absolute', bottom: 5, right: 5,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: Colors.bg,
  },
  avatarHint: { color: Colors.textSecondary, fontSize: 13, marginTop: 12, fontWeight: '500' },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  disabledInput: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'transparent' },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 14, marginLeft: 12 },
  updateBtn: { marginTop: 40, borderRadius: 16, overflow: 'hidden' },
  btnGradient: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    paddingVertical: 18, gap: 10 
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
