import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Image, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { Colors, Typography, Spacing, Roundness } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import ImageSourceModal from '../../components/ImageSourceModal';
import { uploadImageDetailed, deleteImageFromCloudinary } from '../../utils/storage';

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [image, setImage] = useState<string | null>(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [canInteract, setCanInteract] = useState(false);
  const [oldDeleteToken, setOldDeleteToken] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    // Prevent ghost taps during navigation transition
    const timer = setTimeout(() => setCanInteract(true), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchItem = async () => {
      try {
        const snap = await getDoc(doc(db, 'lost_found', id));
        if (snap.exists()) {
          const data = snap.data();
          setItemName(data.title || '');
          setDescription(data.description || '');
          setLocation(data.location || '');
          setType(data.type || 'lost');
          setImage(data.imageUrl || null);
          setOldDeleteToken(data.cloudinaryDeleteToken || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  const handleImageSelect = async (useCamera: boolean) => {
    setIsImageModalVisible(false);
    
    // Add a small delay to ensure the modal is closed before launching picker (Android crash prevention)
    setTimeout(async () => {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    }, 500);
  };

  const handleUpdate = async () => {
    if (!itemName || !description || !location) {
      Alert.alert('Incomplete', 'Please fill in all the details.');
      return;
    }

    try {
      setSaving(true);
      
      let imageUrl = image;
      let newDeleteToken: string | null = null;
      
      if (image && !image.startsWith('http') && !image.startsWith('data:image')) {
        const uploadResult = await uploadImageDetailed(image, 'unified_posts');
        imageUrl = uploadResult.secure_url;
        newDeleteToken = uploadResult.delete_token || null;
        
        // Delete old image from Cloudinary to keep it clean!
        if (oldDeleteToken) {
          try {
            await deleteImageFromCloudinary(oldDeleteToken);
          } catch (e) {
            console.error("Failed to delete old image:", e);
          }
        }
      }

      const updateData: any = {
        title: itemName,
        description,
        location,
        type,
        imageUrl,
        updatedAt: new Date().toISOString(),
      };

      if (newDeleteToken) {
        updateData.cloudinaryDeleteToken = newDeleteToken;
      } else if (image === null && oldDeleteToken) {
        updateData.cloudinaryDeleteToken = null;
      }

      await updateDoc(doc(db, 'lost_found', id!), updateData);
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update the listing.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Stack.Screen options={{ 
          headerTitle: 'Edit Listing',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#15151A' },
          headerTintColor: '#FFF',
          headerTitleStyle: { ...Typography.title, fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
          ),
        }} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Media Section */}
          <TouchableOpacity 
            style={styles.imagePicker} 
            onPress={() => canInteract && setIsImageModalVisible(true)}
          >
            {image ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: image }} style={styles.previewImage} />
                <View style={styles.editImageBadge}>
                  <Ionicons name="camera" size={16} color="#FFF" />
                  <Text style={styles.editImageText}>CHANGE</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderWrap}>
                <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.1)" />
                <Text style={styles.placeholderText}>Add a Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Type Selector */}
          <View style={styles.typeSelector}>
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'lost' && styles.typeBtnActiveLost]}
              onPress={() => setType('lost')}
            >
              <Text style={[styles.typeBtnText, type === 'lost' && styles.typeBtnTextActive]}>LOST</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'found' && styles.typeBtnActiveFound]}
              onPress={() => setType('found')}
            >
              <Text style={[styles.typeBtnText, type === 'found' && styles.typeBtnTextActive]}>FOUND</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Item Name</Text>
              <TextInput 
                style={styles.input}
                placeholder="What did you lose/find?"
                placeholderTextColor="#555"
                value={itemName}
                onChangeText={setItemName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <TextInput 
                style={styles.input}
                placeholder="Where was it seen?"
                placeholderTextColor="#555"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput 
                style={[styles.input, styles.textArea]}
                placeholder="Provide specific details (color, brand, unique marks)..."
                placeholderTextColor="#555"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.submitBtn}
            onPress={handleUpdate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <LinearGradient 
                colors={['#6B52FF', '#4a339d']}
                style={styles.submitGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                <Text style={styles.submitBtnText}>SAVE CHANGES</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        <ImageSourceModal 
          isVisible={isImageModalVisible}
          onClose={() => setIsImageModalVisible(false)}
          onSelect={handleImageSelect}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  center: { flex: 1, backgroundColor: '#15151A', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Spacing.margin, paddingBottom: 40 },
  
  imagePicker: {
    width: '100%',
    height: 200,
    backgroundColor: '#1E1E24',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  placeholderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  placeholderText: { color: '#A0A0A5', fontSize: 14, fontWeight: 'bold' },
  imagePreviewWrap: { flex: 1, position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  editImageBadge: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6
  },
  editImageText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E1E24',
    padding: 6,
    borderRadius: 16,
    marginBottom: Spacing.xl,
  },
  typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  typeBtnActiveLost: { backgroundColor: '#FF647C' },
  typeBtnActiveFound: { backgroundColor: '#6B52FF' },
  typeBtnText: { color: '#A0A0A5', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  typeBtnTextActive: { color: '#FFF' },

  form: { gap: Spacing.lg },
  inputGroup: { gap: 8 },
  label: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginLeft: 4 },
  input: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  textArea: { height: 120, textAlignVertical: 'top' },

  footer: { 
    padding: Spacing.margin, 
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: '#15151A',
    borderTopWidth: 1,
    borderTopColor: '#1A1C23',
  },
  submitBtn: { width: '100%', height: 56, borderRadius: 18, overflow: 'hidden' },
  submitGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
});
