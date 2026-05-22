import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, StatusBar, KeyboardAvoidingView, Platform, 
  Image, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { uploadImage, uploadImageDetailed } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import ImageSourceModal from '../../components/ImageSourceModal';

export default function CreatePostScreen() {
  const router = useRouter();
  const [category, setCategory] = useState('Lost/Found');
  const [itemType, setItemType] = useState<'lost' | 'found'>('lost');

  // Urgency toggle
  const [urgencyOn, setUrgencyOn] = useState(true);

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>(['Electronics']);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');

  // Media
  const [image, setImage] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const pickImage = async (useCamera: boolean) => {
    // 1. Close Modal
    setShowModal(false);
    
    // 2. Buffer
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (useCamera) {
          console.log('📸 [Unified] Requesting Camera permissions...');
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Forge Denied', 'Camera access is required to capture live proof for your post.');
          return;
        }
      } else {
          console.log('🖼️ [Unified] Requesting Media Library permissions...');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Forge Denied', 'Gallery access is required to upload your post imagery.');
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: Platform.OS === 'ios',
        aspect: [4, 3],
        quality: 0.7,
      };

      console.log(`🚀 [Unified] Launching ${useCamera ? 'Camera' : 'Gallery'}...`);
      const result = useCamera 
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('❌ [Unified] Capture error:', error);
      Alert.alert('Forge Error', `Issue during capture: ${error.message || 'Unknown'}`);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setVideoUri(result.assets[0].uri);
  };

  const handleAddCustomTag = () => {
    const newTag = customTagInput.trim();
    if (newTag.length > 0 && !customTags.includes(newTag)) {
      setCustomTags(prev => [...prev, newTag]);
      setSelectedTags(prev => [...prev, newTag]);
    }
    setCustomTagInput('');
    setShowTagInput(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handlePost = async () => {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Please add a title.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing info', 'Please add a description.');
      return;
    }
    setLoading(true);
    try {
      let imageUrl: string | null = null;
      let deleteToken: string | null = null;
      if (image) {
        const uploadResult = await uploadImageDetailed(image, 'unified_posts');
        imageUrl = uploadResult.secure_url;
        deleteToken = uploadResult.delete_token || null;
      }

      const userId = auth.currentUser?.uid;
      const userName = auth.currentUser?.email?.split('@')[0] || 'Student';

      // Apply profanity moderation
      const { moderateWithAI } = require('../../utils/moderation');
      const modTitle = await moderateWithAI(title.trim());
      const modDesc = await moderateWithAI(description.trim());
      const modLoc = await moderateWithAI(location.trim());

      const isFlagged = modTitle.isFlagged || modDesc.isFlagged || modLoc.isFlagged;

      const payload: any = {
        title: modTitle.cleanText,
        description: modDesc.cleanText,
        location: modLoc.cleanText,
        visibility: 'Everyone in Campus',
        imageUrl,
        cloudinaryDeleteToken: deleteToken,
        cloudinaryDeleteTokens: deleteToken ? [deleteToken] : null,
        linkUrl: linkUrl.trim() || null,
        userId,
        userName,
        collegeId: profile?.collegeId || null,
        createdAt: new Date().toISOString(),
        isFlagged,
      };

      let colName = 'lost_found';
      if (category === 'Lost/Found') {
        payload.type = itemType;
        payload.urgency = urgencyOn ? 'High' : 'Normal';
        payload.tags = selectedTags;
      } else if (category === 'Sell') {
        colName = 'marketplace';
        payload.price = price ? parseFloat(price) : 0;
        payload.category = 'Other';
        payload.tags = selectedTags;
      } else if (category === 'Skill') {
        colName = 'skills';
        payload.type = 'offer';
        payload.status = 'open';
        payload.price = price ? parseFloat(price) : 0;
        payload.tags = selectedTags;
      }

      const docRef = await addDoc(collection(db, colName), payload);
      
      if (isFlagged) {
        // Consolidated report for Admin with link to post
        addDoc(collection(db, 'moderation_reports'), {
          type: 'Unified Post',
          postCategory: category,
          postId: docRef.id,
          postCollection: colName,
          userId,
          userEmail: auth.currentUser?.email,
          userName: profile?.name || 'Student',
          userCollege: profile?.collegeShortName || 'Campus',
          timestamp: serverTimestamp(),
          details: {
            title: { text: title, flagged: modTitle.isFlagged },
            description: { text: description, flagged: modDesc.isFlagged },
            location: { text: location, flagged: modLoc.isFlagged }
          },
          resolved: false
        }).catch(err => console.error('Failed to log consolidated report:', err));
      }
      
      // Reset form states for the next post
      setTitle('');
      setDescription('');
      setLocation('');
      setPrice('');
      setImage(null);
      setVideoUri(null);
      setLinkUrl('');
      setCustomTags([]);
      setSelectedTags(['Electronics']); // default tag
      setCategory('Lost/Found');
      setItemType('lost');

      router.push('/(tabs)');
    } catch (error) {
      console.error('Posting failed:', error);
      Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const allTags = ['Electronics', 'Personal Item', 'Pets', ...customTags];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#15151A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.push('/(tabs)')}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, (!title || loading) && { opacity: 0.5 }]}
          onPress={handlePost}
          disabled={loading || !title}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category Toggle */}
          <View style={styles.categoryContainer}>
            {['Lost/Found', 'Sell', 'Skill'].map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catBtn, category === cat && styles.catBtnActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sub-type Selector for Lost/Found */}
          {category === 'Lost/Found' && (
            <View style={styles.typeSelectorWrap}>
              <TouchableOpacity 
                style={styles.typeBtnContainer}
                onPress={() => setItemType('lost')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={itemType === 'lost' ? ['#FF647C', '#D04E64'] : ['#1E1E24', '#1E1E24']}
                  style={[styles.typeBtn, itemType === 'lost' && styles.typeBtnActiveShadow]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                >
                  <Ionicons 
                    name="search-outline" 
                    size={18} 
                    color={itemType === 'lost' ? '#FFF' : '#A0A0A5'} 
                  />
                  <Text style={[styles.typeBtnText, itemType === 'lost' && styles.typeBtnTextActive]}>LOST</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.typeBtnContainer}
                onPress={() => setItemType('found')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={itemType === 'found' ? ['#6B52FF', '#5038E0'] : ['#1E1E24', '#1E1E24']}
                  style={[styles.typeBtn, itemType === 'found' && styles.typeBtnActiveShadow]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                >
                  <Ionicons 
                    name="gift-outline" 
                    size={18} 
                    color={itemType === 'found' ? '#FFF' : '#A0A0A5'} 
                  />
                  <Text style={[styles.typeBtnText, itemType === 'found' && styles.typeBtnTextActive]}>FOUND</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Media Grid */}
          <View style={styles.mediaGrid}>
            <TouchableOpacity
              style={[styles.mediaBig, image ? { borderWidth: 0 } : {}]}
              onPress={() => setShowModal(true)}
              activeOpacity={0.8}
            >
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.mediaImage} />
                  <TouchableOpacity
                    style={styles.removeMedia}
                    onPress={() => setImage(null)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.mediaEmptyCenter}>
                  <Ionicons name="camera" size={32} color="#6B52FF" style={{ marginBottom: 10 }} />
                  <Text style={styles.mediaBigText}>Add photo</Text>
                  <Text style={styles.mediaHint}>MAX 10MB</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.mediaRightCol}>
              <TouchableOpacity
                style={[styles.mediaSmall, videoUri && styles.mediaSmallActive]}
                onPress={pickVideo}
                activeOpacity={0.8}
              >
                {videoUri ? (
                  <Ionicons name="checkmark-circle" size={26} color="#6B52FF" />
                ) : (
                  <Ionicons name="videocam" size={24} color="#A0A0A5" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mediaSmall, (showLinkInput || linkUrl) && styles.mediaSmallActive]}
                onPress={() => setShowLinkInput(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name="link" size={24} color={linkUrl ? '#6B52FF' : '#A0A0A5'} />
              </TouchableOpacity>
            </View>
          </View>

          {showLinkInput && (
            <View style={[styles.locationBox, { marginBottom: Spacing.xl }]}>
              <Ionicons name="link" size={20} color="#6B52FF" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder="Paste a URL..."
                placeholderTextColor="#5A5A5E"
                value={linkUrl}
                onChangeText={setLinkUrl}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={() => setShowLinkInput(false)}
              />
              {linkUrl.length > 0 && (
                <TouchableOpacity onPress={() => setLinkUrl('')}>
                  <Ionicons name="close-circle" size={20} color="#5A5A5E" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.sectionLabel}>
            {category === 'Sell' || category === 'Skill' ? 'TITLE' : 'WHAT HAPPENED?'}
          </Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder={
                category === 'Lost/Found'
                  ? 'e.g. Lost Silver iPhone at Library'
                  : category === 'Sell'
                  ? 'e.g. Selling Used iPad Pro'
                  : 'e.g. Offering Math Tutoring'
              }
              placeholderTextColor="#5A5A5E"
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>

          {(category === 'Sell' || category === 'Skill') && (
            <>
              <Text style={styles.sectionLabel}>PRICE / RATE</Text>
              <View style={styles.inputBox}>
                <Ionicons name="pricetag-outline" size={18} color="#6B52FF" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  placeholder={category === 'Sell' ? 'e.g. 250.00' : 'e.g. 15/hr'}
                  placeholderTextColor="#5A5A5E"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <View style={styles.textAreaBox}>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the item, surroundings, or any specific details..."
              placeholderTextColor="#5A5A5E"
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <Text style={styles.sectionLabel}>WHERE WAS IT?</Text>
          <View style={styles.locationBox}>
            <Ionicons name="location" size={20} color="#6B52FF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Tag a campus building or zone"
              placeholderTextColor="#5A5A5E"
              value={location}
              onChangeText={setLocation}
              returnKeyType="done"
            />
          </View>

          <Text style={styles.sectionLabel}>
            {category === 'Lost/Found' ? 'URGENCY & CATEGORY' : 'TAGS & CATEGORY'}
          </Text>
          <View style={styles.tagsCloud}>
            {category === 'Lost/Found' && (
              <View style={styles.urgencySection}>
                <View style={styles.urgencyTextWrap}>
                  <Text style={styles.urgencyTitle}>Mark as Urgent</Text>
                  <Text style={styles.urgencySub}>Sends a faster alert to students nearby</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setUrgencyOn(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.toggleTrack, urgencyOn && styles.toggleTrackActive]}>
                    <View style={[styles.toggleThumb, urgencyOn && styles.toggleThumbActive]} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {allTags.map((tag, idx) => (
              <TouchableOpacity
                key={`${tag}-${idx}`}
                style={[styles.tagPill, selectedTags.includes(tag) && styles.tagPillSelected]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}

            {showTagInput ? (
              <View style={[styles.tagPill, { backgroundColor: '#040405', paddingVertical: 6, paddingHorizontal: 14 }]}>
                <TextInput
                  autoFocus
                  style={{ color: '#FFF', fontSize: 13, minWidth: 80, fontFamily: 'Manrope_500Medium' }}
                  placeholder="New tag..."
                  placeholderTextColor="#5A5A5E"
                  value={customTagInput}
                  onChangeText={setCustomTagInput}
                  onSubmitEditing={handleAddCustomTag}
                  onBlur={handleAddCustomTag}
                  returnKeyType="done"
                />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.tagPill, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2A2A30' }]}
                onPress={() => setShowTagInput(true)}
              >
                <Text style={styles.tagText}>+ Add Tag</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.reachCard}>
            <View style={styles.reachOverlay}>
              <View style={styles.reachIconWrap}>
                <Ionicons name="megaphone" size={18} color="#A4A6FF" />
              </View>
              <View style={styles.reachTexts}>
                <Text style={styles.reachTitle}>Community Reach</Text>
                <Text style={styles.reachSub}>
                  Your post will be visible to 4,200+ students in this zone.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ImageSourceModal 
        isVisible={showModal} 
        onClose={() => setShowModal(false)} 
        onSelect={pickImage} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: Spacing.margin, paddingBottom: Spacing.md, backgroundColor: '#15151A' },
  closeBtn: { padding: Spacing.xs },
  headerTitle: { ...Typography.headline, color: '#FFF', fontSize: 18, letterSpacing: 0 },
  postBtn: { backgroundColor: '#6B52FF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: Roundness.full },
  postBtnText: { ...Typography.label, color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: 120, paddingTop: Spacing.md },
  categoryContainer: { flexDirection: 'row', backgroundColor: '#121216', borderRadius: Roundness.full, padding: 6, marginBottom: Spacing.xl },
  catBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: Roundness.full },
  catBtnActive: { backgroundColor: '#6B52FF' },
  catBtnText: { ...Typography.body_medium, color: '#8A8A8E', fontSize: 13, fontWeight: 'bold' },
  catBtnTextActive: { color: '#FFF' },
  mediaGrid: { flexDirection: 'row', gap: 16, marginBottom: Spacing.xl },
  mediaBig: { flex: 1, height: 220, borderRadius: 32, borderWidth: 1.5, borderColor: '#2A2A30', borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.01)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeMedia: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
  mediaEmptyCenter: { alignItems: 'center' },
  mediaBigText: { color: '#A0A0A5', fontSize: 13, marginBottom: 4 },
  mediaHint: { color: '#4A4A4E', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  mediaRightCol: { width: 90, gap: 16 },
  mediaSmall: { flex: 1, backgroundColor: '#1A1C23', borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  mediaSmallActive: { borderWidth: 2, borderColor: '#6B52FF' },
  sectionLabel: { ...Typography.label, color: '#8E8E93', fontSize: 11, letterSpacing: 1.5, marginBottom: Spacing.sm, textTransform: 'uppercase', marginLeft: 4 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#040405', borderRadius: Roundness.full, height: 60, paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  input: { flex: 1, ...Typography.body_medium, color: '#FFF', fontSize: 16 },
  textAreaBox: { backgroundColor: '#040405', borderRadius: 32, height: 140, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, marginBottom: Spacing.xl },
  textArea: { ...Typography.body_medium, color: '#FFF', fontSize: 16, flex: 1, textAlignVertical: 'top' },
  locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#040405', borderRadius: Roundness.full, height: 60, paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  tagsCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Spacing.xxl },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1E1E24', paddingHorizontal: 20, paddingVertical: 12, borderRadius: Roundness.full },
  tagPillHighUrgency: { backgroundColor: '#4F3A96', borderWidth: 1, borderColor: '#6B52FF' },
  tagPillSelected: { backgroundColor: '#6B52FF', borderWidth: 1, borderColor: '#8169FF' },
  tagText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  tagTextSelected: { color: '#FFF' },
  urgencyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E93' },
  reachCard: { height: 110, borderRadius: 32, backgroundColor: '#16161A', overflow: 'hidden', marginBottom: Spacing.xxl, borderWidth: 1, borderColor: '#2A2A30' },
  reachOverlay: { flex: 1, padding: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: 'rgba(255,255,255,0.02)' },
  reachIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(107, 82, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  reachTexts: { flex: 1 },
  reachTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  reachSub: { color: '#8E8E93', fontSize: 11, lineHeight: 16 },

  // Urgency Section
  urgencySection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  urgencyTextWrap: { flex: 1 },
  urgencyTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  urgencySub: { color: '#8E8E93', fontSize: 12 },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A30',
    padding: 4,
    justifyContent: 'center',
  },
  toggleTrackActive: { backgroundColor: '#6B52FF' },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },

  // Sub-type Selector
  typeSelectorWrap: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  typeBtnContainer: {
    flex: 1,
  },
  typeBtn: {
    height: 56,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeBtnActiveShadow: {
    borderWidth: 0,
    ...Shadows.ambient,
    shadowColor: '#6B52FF',
    shadowOpacity: 0.3,
  },
  typeBtnText: {
    color: '#A0A0A5',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  typeBtnTextActive: {
    color: '#FFF',
  },
});
