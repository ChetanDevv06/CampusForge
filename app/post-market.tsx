import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, StatusBar, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../utils/storage';

export default function PostMarketScreen() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleList = async () => {
    if (!title || !price || !category) { Alert.alert('Error', 'Please fill in all required fields.'); return; }
    setLoading(true);
    try {
      let imageUrl = null;
      if (image) {
        imageUrl = await uploadImage(image, 'marketplace');
      }

      await addDoc(collection(db, 'marketplace'), {
        title, price: parseFloat(price), category, description,
        userId: user?.uid, userEmail: user?.email,
        createdAt: new Date().toISOString(), imageUrl,
      });
      Alert.alert('Listed!', 'Your item is now for sale.');
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const fields = [
    { icon: 'bag-outline', label: 'Item Name *', value: title, set: setTitle, placeholder: 'e.g., Physics Textbook 9th Ed' },
    { icon: 'cash-outline', label: 'Price (₹) *', value: price, set: setPrice, placeholder: 'e.g., 450', keyboard: 'numeric' },
    { icon: 'grid-outline', label: 'Category *', value: category, set: setCategory, placeholder: 'e.g., Books, Electronics, Furniture' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroRow}>
        <LinearGradient colors={Gradients.primary} style={styles.heroIcon}>
          <Ionicons name="storefront" size={24} color="#FFF" />
        </LinearGradient>
        <View>
          <Text style={styles.title}>Sell an Item</Text>
          <Text style={styles.subtitle}>List it on the campus market</Text>
        </View>
      </View>

      {/* Image Picker */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Item Image</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
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

      {fields.map(f => (
        <View key={f.label} style={styles.fieldGroup}>
          <Text style={styles.label}>{f.label}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name={f.icon as any} size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.input} placeholder={f.placeholder} placeholderTextColor={Colors.textMuted}
              value={f.value} onChangeText={f.set} keyboardType={(f.keyboard as any) || 'default'}
            />
          </View>
        </View>
      ))}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Description</Text>
        <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
          <TextInput
            style={styles.textArea} placeholder="Condition, edition, accessories included..."
            placeholderTextColor={Colors.textMuted} value={description} onChangeText={setDescription}
            multiline numberOfLines={4}
          />
        </View>
      </View>

      <TouchableOpacity onPress={handleList} disabled={loading}>
        <LinearGradient colors={Gradients.primary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>List Item for Sale</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  heroIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
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
