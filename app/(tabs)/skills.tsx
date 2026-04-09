import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, StatusBar, KeyboardAvoidingView, Platform, 
  Image, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Roundness } from '../../constants/theme';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { uploadImage } from '../../utils/storage';
import { useAuth } from '../../contexts/AuthContext';

export default function CreatePostScreen() {
  const router = useRouter();
  const [category, setCategory] = useState('Lost/Found');

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

  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
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
      if (image) imageUrl = await uploadImage(image, 'unified_posts');

      const userId = auth.currentUser?.uid;
      const userName = auth.currentUser?.email?.split('@')[0] || 'Student';

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        visibility: 'Everyone in Campus',
        imageUrl,
        linkUrl: linkUrl.trim() || null,
        userId,
        userName,
        collegeId: profile?.collegeId || null,
        createdAt: new Date().toISOString(),
      };

      let colName = 'lost_found';
      if (category === 'Lost/Found') {
        payload.type = 'lost';
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

      await addDoc(collection(db, colName), payload);
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

      {/* ── Header ── */}
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
          {/* ── Category Toggle ── */}
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

          {/* ── Media Grid ── */}
          <View style={styles.mediaGrid}>
            {/* Big photo panel */}
            <TouchableOpacity
              style={[styles.mediaBig, image ? { borderWidth: 0 } : {}]}
              onPress={pickImage}
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

            {/* Right mini panels */}
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

          {/* Link input (shown when toggled) */}
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

          {/* ── Title ── */}
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

          {/* ── Price (Sell / Skill) ── */}
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

          {/* ── Description ── */}
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

          {/* ── Location ── */}
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

          {/* ── Tags / Urgency ── */}
          <Text style={styles.sectionLabel}>
            {category === 'Lost/Found' ? 'URGENCY & CATEGORY' : 'TAGS & CATEGORY'}
          </Text>
          <View style={styles.tagsCloud}>
            {/* Urgency pill (Lost/Found only) */}
            {category === 'Lost/Found' && (
              <TouchableOpacity
                style={[styles.tagPill, urgencyOn && styles.tagPillHighUrgency]}
                onPress={() => setUrgencyOn(v => !v)}
              >
                <View style={[styles.urgencyDot, urgencyOn && { backgroundColor: '#FFA1B8' }]} />
                <Text style={[styles.tagText, urgencyOn && { color: '#FFF' }]}>
                  {urgencyOn ? 'High Urgency' : 'Normal Urgency'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Static + custom tags */}
            {allTags.map((tag, idx) => (
              <TouchableOpacity
                key={`${tag}-${idx}`}
                style={[styles.tagPill, selectedTags.includes(tag) && styles.tagPillSelected]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, selectedTags.includes(tag) && { color: '#FFF' }]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Add Tag */}
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

          {/* ── Community Reach Card ── */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.md,
    backgroundColor: '#15151A',
  },
  closeBtn: { padding: Spacing.xs },
  headerTitle: { ...Typography.headline, color: '#FFF', fontSize: 18, letterSpacing: 0 },
  postBtn: {
    backgroundColor: '#6B52FF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Roundness.full,
  },
  postBtnText: { ...Typography.label, color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.margin, paddingBottom: 120, paddingTop: Spacing.md },

  // Category
  categoryContainer: {
    flexDirection: 'row',
    backgroundColor: '#121216',
    borderRadius: Roundness.full,
    padding: 6,
    marginBottom: Spacing.xl,
  },
  catBtn: {
    flex: 1, height: 40,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: Roundness.full,
  },
  catBtnActive: { backgroundColor: '#6B52FF' },
  catBtnText: { ...Typography.body_medium, color: '#8A8A8E', fontSize: 13, fontWeight: 'bold' },
  catBtnTextActive: { color: '#FFF' },

  // Media
  mediaGrid: { flexDirection: 'row', gap: 16, marginBottom: Spacing.xl },
  mediaBig: {
    flex: 1, height: 220, borderRadius: 32,
    borderWidth: 1.5, borderColor: '#2A2A30', borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.01)',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  mediaImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeMedia: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12,
  },
  mediaEmptyCenter: { alignItems: 'center' },
  mediaBigText: { color: '#A0A0A5', fontSize: 13, marginBottom: 4 },
  mediaHint: { color: '#4A4A4E', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  mediaRightCol: { width: 90, gap: 16 },
  mediaSmall: {
    flex: 1, backgroundColor: '#1A1C23',
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
  },
  mediaSmallActive: { borderWidth: 2, borderColor: '#6B52FF' },

  // Labels
  sectionLabel: {
    ...Typography.label,
    color: '#8E8E93',
    fontSize: 11, letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    marginLeft: 4,
  },

  // Inputs
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#040405',
    borderRadius: Roundness.full,
    height: 60, paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  input: { flex: 1, ...Typography.body_medium, color: '#FFF', fontSize: 16 },

  textAreaBox: {
    backgroundColor: '#040405', borderRadius: 32,
    height: 140, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  textArea: { ...Typography.body_medium, color: '#FFF', fontSize: 16, flex: 1, textAlignVertical: 'top' },

  locationBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#040405', borderRadius: Roundness.full,
    height: 60, paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },

  // Tags
  tagsCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Spacing.xxl },
  tagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1E1E24',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: Roundness.full,
  },
  tagPillHighUrgency: { backgroundColor: '#4F3A96', borderWidth: 1, borderColor: '#6B52FF' },
  tagPillSelected: { backgroundColor: '#2C2C36' },
  tagText: { color: '#D1D1D6', fontSize: 14, fontWeight: '600' },
  urgencyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E93' },

  // Community Reach
  reachCard: {
    height: 110, borderRadius: 32, backgroundColor: '#16161A',
    overflow: 'hidden', marginBottom: Spacing.xxl,
    borderWidth: 1, borderColor: '#2A2A30',
  },
  reachOverlay: {
    flex: 1, padding: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  reachIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(107, 82, 255, 0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  reachTexts: { flex: 1 },
  reachTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  reachSub: { color: '#8E8E93', fontSize: 11, lineHeight: 16 },
});
