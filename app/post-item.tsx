import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, StatusBar, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../utils/storage';
import ImageSourceModal from '../components/ImageSourceModal';
import FeedbackModal, { FeedbackType } from '../components/FeedbackModal';

export default function PostItemScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [image, setImage] = useState<string | null>(null);
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
  
  const { user } = useAuth();
  const router = useRouter();


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
      aspect: [4, 3],
      quality: 0.8,
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


  const handlePost = async () => {
    if (!title || !description || !location) { 
      showFeedback('Missing Info', 'Please provide a title, description, and location for the item.'); 
      return; 
    }
    setLoading(true);
    try {
      let imageUrl = null;
      if (image) {
        // Only process if the image URI is a local path (not a remote URL or Base64)
        if (!image.startsWith('http') && !image.startsWith('data:image')) {
          console.log("PostItem: Processing image...");
          imageUrl = await uploadImage(image, 'lost_found');
        } else {
          imageUrl = image; // Already a URL or Base64
        }
      }

      await addDoc(collection(db, 'lost_found'), {
        title, description, location, type,
        userId: user?.uid, userEmail: user?.email,
        createdAt: new Date().toISOString(), imageUrl,
      });
      showFeedback('Posted!', `Your item has been reported as ${type}.`, 'success');
      setTimeout(() => router.back(), 2000);
    } catch (e: any) { 
      showFeedback('Error', e.message); 
    }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>Report an Item</Text>

        {/* Type Toggle */}
        <View style={styles.typeRow}>
          {([
            { key: 'lost', label: 'I Lost Something', colors: Gradients.lostBadge },
            { key: 'found', label: 'I Found Something', colors: Gradients.foundBadge },
          ] as const).map(t => (
            <TouchableOpacity key={t.key} style={[styles.typeBtn, type === t.key && styles.typeBtnActive]} onPress={() => setType(t.key)}>
              {type === t.key
                ? <LinearGradient colors={t.colors} style={styles.typeBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.typeLabelActive}>{t.label}</Text>
                  </LinearGradient>
                : <Text style={styles.typeLabel}>{t.label}</Text>
              }
            </TouchableOpacity>
          ))}
        </View>

        {/* Image Picker */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Item Image</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={showImageSourceOptions}>
            {image ? (
              <Image source={{ uri: image }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.imagePlaceholderText}>Connect an image of the item</Text>
              </View>
            )}
          </TouchableOpacity>
          {image && (
            <TouchableOpacity style={styles.removeImage} onPress={() => setImage(null)}>
              <Text style={styles.removeImageText}>Remove Image</Text>
            </TouchableOpacity>
          )}
        </View>

        {[
          { icon: 'pricetag-outline', label: 'Item Name', value: title, set: setTitle, placeholder: 'e.g., Blue Water Bottle' },
          { icon: 'location-outline', label: 'Location', value: location, set: setLocation, placeholder: 'e.g., Library 2nd Floor' },
        ].map(f => (
          <View key={f.label} style={styles.fieldGroup}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name={f.icon as any} size={18} color={Colors.textSecondary} />
              <TextInput style={styles.input} placeholder={f.placeholder} placeholderTextColor={Colors.textMuted} value={f.value} onChangeText={f.set} />
            </View>
          </View>
        ))}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <TextInput
              style={styles.textArea} placeholder="Describe any distinguishing features..." placeholderTextColor={Colors.textMuted}
              value={description} onChangeText={setDescription} multiline numberOfLines={4}
            />
          </View>
        </View>

        <TouchableOpacity onPress={handlePost} disabled={loading}>
          <LinearGradient colors={Gradients.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Post Report</Text>}
          </LinearGradient>
        </TouchableOpacity>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 24 },
  typeRow: { gap: 10, marginBottom: 24 },
  typeBtn: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  typeBtnActive: { borderColor: 'transparent' },
  typeBtnInner: { paddingVertical: 14, alignItems: 'center' },
  typeLabel: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14, paddingVertical: 14, textAlign: 'center' },
  typeLabelActive: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  imagePicker: {
    width: '100%', height: 200, borderRadius: 14, borderStyle: 'dashed',
    borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.bgCard,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderText: { color: Colors.textMuted, marginTop: 8, fontSize: 14 },
  removeImage: { marginTop: 8, alignSelf: 'flex-end' },
  removeImageText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  fieldGroup: { marginBottom: 18 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 14, marginLeft: 10 },
  textAreaWrapper: { alignItems: 'flex-start', paddingVertical: 14 },
  textArea: { flex: 1, color: Colors.textPrimary, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
