import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Dimensions, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../utils/storage';
import ImageSourceModal from '../components/ImageSourceModal';
import FeedbackModal, { FeedbackType } from '../components/FeedbackModal';

const { width } = Dimensions.get('window');

export default function EditProfileScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState(profile?.name || '');
  const [major, setMajor] = useState(profile?.major || 'Computer Science');
  const [gradYear, setGradYear] = useState(profile?.gradYear || '2025');
  const [bio, setBio] = useState(profile?.bio || '');
  const [instagram, setInstagram] = useState(profile?.socials?.instagram || '');
  const [linkedin, setLinkedin] = useState(profile?.socials?.linkedin || '');
  
  const [image, setImage] = useState<string | null>(profile?.avatarUrl || null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showGradModal, setShowGradModal] = useState(false);
  
  const gradYears = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{title: string, message: string, type: FeedbackType}>({
    title: '', message: '', type: 'info'
  });

  const showFeedback = (title: string, message: string, type: FeedbackType = 'error') => {
    setFeedbackConfig({ title, message, type });
    setFeedbackVisible(true);
  };

  const pickImage = async (useCamera: boolean) => {
    const { status } = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showFeedback('Access Denied', `Permissions required to update your profile image.`);
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

  const handleUpdate = async () => {
    if (!name) {
      showFeedback('Missing Info', 'Full Name is required.');
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      let avatarUrl = profile?.avatarUrl || null;
      
      if (image && !image.startsWith('http')) {
        avatarUrl = await uploadImage(image, `avatars/${user.uid}`);
      }

      await setDoc(doc(db, 'users', user.uid), {
        name,
        major,
        gradYear,
        bio,
        socials: {
            instagram,
            linkedin
        },
        avatarUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });

      showFeedback('Profile Saved', 'Your changes have been updated.', 'success');
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/profile');
        }
      }, 1500);
    } catch (error: any) {
      showFeedback('Update Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: '#15151A' }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top || 40, height: (insets.top || 40) + 60 }]}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }} 
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleUpdate} disabled={loading} style={styles.headerBtnRight}>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Section */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.9}>
                <View style={styles.avatarOutline}>
                    <View style={styles.avatarMain}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.avatarImg} />
                        ) : (
                            <View style={[styles.avatarImg, { backgroundColor: '#2A2A32', justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="person" size={50} color="#5A5A5E" />
                            </View>
                        )}
                        <View style={styles.avatarOverlay}>
                            <Text style={styles.avatarOverlayText}>Edit Profile</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
          </View>

          {/* Form Group 1 */}
          <View style={styles.formGroup}>
            <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputBox}>
                    <TextInput 
                        style={styles.input} 
                        value={name} 
                        onChangeText={setName}
                        placeholder="Elena Rodriguez"
                        placeholderTextColor="#5A5A5E"
                    />
                </View>
            </View>

            <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Major</Text>
                <View style={styles.selectBox}>
                    <TextInput 
                        style={styles.input} 
                        value={major} 
                        onChangeText={setMajor}
                    />
                    <Ionicons name="chevron-down" size={18} color="#5A5A5E" />
                </View>
            </View>

            <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Graduation Year</Text>
                <TouchableOpacity 
                    style={styles.selectBox} 
                    onPress={() => setShowGradModal(true)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.input, !gradYear && { color: '#5A5A5E' }]}>
                        {gradYear || 'Select Year'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
            </View>
          </View>

          {/* Bio Section */}
          <View style={styles.formGroup}>
            <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Bio</Text>
                <View style={[styles.inputBox, styles.bioBox]}>
                    <TextInput 
                        style={[styles.input, styles.bioInput]} 
                        value={bio} 
                        onChangeText={setBio}
                        multiline
                        placeholder="Tell others about yourself..."
                        placeholderTextColor="#5A5A5E"
                    />
                </View>
            </View>
          </View>

          {/* Campus Selection */}
          <View style={styles.formGroup}>
            <View style={styles.campusCard}>
                <View style={styles.campusHeader}>
                    <Ionicons name="location" size={18} color="#6B52FF" />
                    <Text style={styles.campusLabel}>Campus Selection</Text>
                </View>
                <TouchableOpacity style={styles.campusSelect}>
                    <Text style={styles.campusName} numberOfLines={1}>
                        {profile?.collegeName || 'Downtown Tech Hub (North Can'}
                    </Text>
                    <Ionicons name="swap-vertical" size={18} color="#5A5A5E" />
                </TouchableOpacity>
            </View>
          </View>

          {/* Social Links */}
          <View style={styles.socialLink}>
            <LinearGradient colors={['#F58529', '#DD2A7B', '#8134AF']} style={styles.socialIcon} start={{x:0, y:0}} end={{x:1, y:1}}>
                <Ionicons name="logo-instagram" size={20} color="#FFF" />
            </LinearGradient>
            <TextInput 
                style={styles.socialInput} 
                value={instagram} 
                onChangeText={setInstagram}
                placeholder="@instagram_handle"
                placeholderTextColor="#5A5A5E"
            />
          </View>

          <View style={styles.socialLink}>
            <View style={[styles.socialIcon, { backgroundColor: '#0077B5' }]}>
                <Ionicons name="logo-linkedin" size={20} color="#FFF" />
            </View>
            <TextInput 
                style={styles.socialInput} 
                value={linkedin} 
                onChangeText={setLinkedin}
                placeholder="LinkedIn Profile"
                placeholderTextColor="#5A5A5E"
            />
          </View>

          {/* Security */}
          <TouchableOpacity 
            style={styles.securityButton} 
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
             <View style={styles.securityIconBox}>
                <Ionicons name="lock-closed" size={18} color="#FF4B7D" />
             </View>
             <View style={styles.securityTextContent}>
                <Text style={styles.securityTitle}>Password & Security</Text>
                <Text style={styles.securitySub}>Update your login credentials</Text>
             </View>
             <Ionicons name="chevron-forward" size={18} color="#5A5A5E" />
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Graduation Year Modal */}
      <Modal
        visible={showGradModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGradModal(false)}
      >
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowGradModal(false)}
        >
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
            <View style={styles.gradModalContent}>
                <View style={styles.gradModalHeader}>
                    <Text style={styles.gradModalTitle}>Batch Year</Text>
                    <TouchableOpacity onPress={() => setShowGradModal(false)}>
                        <Ionicons name="close-circle" size={24} color="#5A5A5E" />
                    </TouchableOpacity>
                </View>
                <ScrollView bounces={false}>
                    {gradYears.map((year) => (
                        <TouchableOpacity 
                            key={year}
                            style={[
                                styles.gradOption,
                                gradYear === year && styles.gradOptionActive
                            ]}
                            onPress={() => {
                                setGradYear(year);
                                setShowGradModal(false);
                            }}
                        >
                            <Text style={[
                                styles.gradOptionText,
                                gradYear === year && styles.gradOptionTextActive
                            ]}>
                                Class of {year}
                            </Text>
                            {gradYear === year && (
                                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </TouchableOpacity>
      </Modal>

      <ImageSourceModal isVisible={showModal} onClose={() => setShowModal(false)} onSelect={pickImage} />
      <FeedbackModal isVisible={feedbackVisible} onClose={() => setFeedbackVisible(false)} title={feedbackConfig.title} message={feedbackConfig.message} type={feedbackConfig.type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20,
    backgroundColor: '#15151A',
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerBtnRight: { minWidth: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold' },
  saveBtnText: { color: '#6B52FF', fontSize: 16, fontWeight: '700' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },

  avatarContainer: { alignItems: 'center', marginVertical: 30 },
  avatarOutline: { 
    width: 140, height: 140, 
    borderRadius: 70, 
    backgroundColor: '#1E1E24', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 2
  },
  avatarMain: { width: '100%', height: '100%', borderRadius: 70, overflow: 'hidden', position: 'relative' },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarOverlay: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    height: 30, backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', alignItems: 'center' 
  },
  avatarOverlayText: { color: '#FFF', fontSize: 8, fontWeight: '600' },

  formGroup: { 
    backgroundColor: '#1C1C23', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  inputItem: { marginBottom: 20 },
  inputItemLast: { marginBottom: 0 },
  inputLabel: { color: '#8A8D93', fontSize: 13, fontWeight: '500', marginBottom: 12, marginLeft: 4 },
  inputBox: { 
    backgroundColor: '#0F0F12', 
    borderRadius: 16, 
    height: 56, 
    paddingHorizontal: 16, 
    justifyContent: 'center' 
  },
  selectBox: {
    backgroundColor: '#0F0F12', 
    borderRadius: 16, 
    height: 56, 
    paddingHorizontal: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  input: { color: '#FFF', fontSize: 15, fontFamily: 'Manrope_500Medium', flex: 1 },
  
  bioBox: { height: 120, paddingVertical: 16, alignItems: 'flex-start' },
  bioInput: { textAlignVertical: 'top' },

  campusCard: { gap: 12 },
  campusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  campusLabel: { color: '#8A8D93', fontSize: 14, fontWeight: '500' },
  campusSelect: {
    backgroundColor: '#0F0F12', 
    borderRadius: 16, 
    height: 56, 
    paddingHorizontal: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  campusName: { color: '#FFF', fontSize: 15, fontFamily: 'Manrope_500Medium', flex: 1 },

  socialLink: {
    backgroundColor: '#1C1C23',
    borderRadius: 20,
    height: 70,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  socialIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  socialInput: { color: '#FFF', fontSize: 15, fontFamily: 'Manrope_500Medium', flex: 1 },

  securityButton: {
    backgroundColor: '#1C1C23',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    marginTop: 10
  },
  securityIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(107, 82, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  securityTextContent: { flex: 1 },
  securityTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  securitySub: { color: '#8A8D93', fontSize: 12, marginTop: 2 },

  // Grad Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  gradModalContent: {
    width: '100%',
    maxHeight: 400,
    backgroundColor: '#111116',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  gradModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  gradModalTitle: {
    ...Typography.title,
    color: '#FFF',
    fontSize: 20
  },
  gradOption: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.02)'
  },
  gradOptionActive: {
    backgroundColor: 'rgba(107,82,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(107,82,255,0.2)',
  },
  gradOptionText: {
    ...Typography.body_medium,
    color: '#8A8D93',
    fontSize: 16
  },
  gradOptionTextActive: {
    color: '#FFF',
    fontFamily: 'PlusJakartaSans_700Bold'
  }
});
