import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Image, TextInput, Dimensions, 
  Platform, KeyboardAvoidingView, ScrollView, Modal, Pressable
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, query, where, onSnapshot, orderBy, 
  doc, getDoc, addDoc, updateDoc, serverTimestamp, increment 
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../../constants/theme';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../utils/storage';

const { width } = Dimensions.get('window');

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { id, name, otherUserId, refType, refTitle, refImage, refId } = useLocalSearchParams<any>();
  const [activeConvId, setActiveConvId] = useState(id);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [reference, setReference] = useState<any>(null);
  const flatRef = useRef<FlatList>(null);
  const router = useRouter();
  const uid = user?.uid;

  useEffect(() => {
    if (refType) {
      setReference({ type: refType, title: refTitle, image: refImage, itemId: refId });
    }
  }, [refType]);

  useEffect(() => {
    if (!activeConvId || activeConvId === 'new') {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'conversations', activeConvId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 200);
    }, () => setLoading(false));

    // Clear unread
    if (uid) {
      updateDoc(doc(db, 'conversations', activeConvId), { [`unreadCount.${uid}`]: 0 });
    }

    if (otherUserId) {
      getDoc(doc(db, 'users', otherUserId)).then(s => s.exists() && setOtherUserProfile(s.data()));
    }

    return unsub;
  }, [activeConvId, uid]);

  const handleSend = async (imageUri?: string) => {
    if (!text.trim() && !imageUri) return;
    const msgText = text.trim();
    setText('');
    
    let targetId = activeConvId;
    
    if (targetId === 'new') {
      const newConv = await addDoc(collection(db, 'conversations'), {
        participants: [uid, otherUserId],
        participantNames: { [uid!]: 'Me', [otherUserId]: name || 'Campus Mate' },
        lastMessage: imageUri ? 'Sent a photo' : msgText,
        lastMessageAt: serverTimestamp(),
        lastSenderId: uid,
        collegeId: profile?.collegeId || '',
        itemMetadata: reference || null,
        unreadCount: { [otherUserId]: 1 }
      });
      targetId = newConv.id;
      setActiveConvId(targetId);
    }

    await addDoc(collection(db, 'conversations', targetId, 'messages'), {
      text: msgText,
      senderId: uid,
      imageUrl: imageUri || null,
      createdAt: serverTimestamp(),
    });

    if (activeConvId !== 'new') {
      updateDoc(doc(db, 'conversations', targetId), {
        lastMessage: imageUri ? 'Sent a photo' : msgText,
        lastMessageAt: serverTimestamp(),
        lastSenderId: uid,
        [`unreadCount.${otherUserId}`]: increment(1)
      });
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) {
      const url = await uploadImage(result.assets[0].uri, 'chats');
      handleSend(url);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === uid;
    
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={styles.bubbleAvatarWrap}>
            {otherUserProfile?.avatarUrl ? (
              <Image source={{ uri: otherUserProfile.avatarUrl }} style={styles.bubbleAvatar} />
            ) : (
              <View style={[styles.bubbleAvatar, { backgroundColor: Colors.surface_container_high }]} />
            )}
          </View>
        )}
        <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            {isMe && <LinearGradient colors={Gradients.primary} style={StyleSheet.absoluteFill} start={{x:0, y:0}} end={{x:1, y:1}} />}
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.msgImage} />}
            {item.text ? <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>{item.text}</Text> : null}
          </View>
          <Text style={styles.msgTime}>
            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Glass Header */}
      <BlurView intensity={30} tint="dark" style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUserProfile?.name || name || 'Campus Student'}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: otherUserProfile?.online ? Colors.success : Colors.tertiary }]} />
              <Text style={styles.statusText}>{otherUserProfile?.online ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>
      </BlurView>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Floating Reference Card */}
        {reference && (
          <View style={styles.refContainer}>
            <BlurView intensity={20} tint="dark" style={styles.refCard}>
              <View style={styles.refBadge}>
                <Ionicons name={reference.type === 'lost' ? 'search' : 'gift'} size={14} color={Colors.on_primary} />
              </View>
              <View style={styles.refInfo}>
                <Text style={styles.refTitle} numberOfLines={1}>{reference.title}</Text>
                <Text style={styles.refTag}>{reference.type.toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.viewBtn} onPress={() => router.push({ pathname: '/item-details/[id]', params: { id: reference.itemId } } as any)}>
                <Text style={styles.viewBtnText}>View</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        )}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputArea, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.inputPill}>
            <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </TouchableOpacity>
            <TextInput 
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={Colors.on_surface_variant}
              value={text}
              onChangeText={setText}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]} 
              onPress={() => handleSend()}
              disabled={!text.trim()}
            >
              <LinearGradient colors={Gradients.primary} style={styles.sendGrad}>
                <Ionicons name="arrow-up" size={24} color={Colors.on_primary} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.md,
    zIndex: 100,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface_container_high, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  headerName: { ...Typography.title, color: Colors.on_background, fontSize: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 11 },

  refContainer: { paddingHorizontal: Spacing.margin, marginTop: Spacing.md },
  refCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderRadius: Roundness.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  refBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  refInfo: { flex: 1 },
  refTitle: { ...Typography.body_medium, color: Colors.on_background, fontSize: 14 },
  refTag: { ...Typography.caption, color: Colors.primary, fontSize: 10, textTransform: 'uppercase' },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Roundness.full, backgroundColor: Colors.surface_container_high },
  viewBtnText: { ...Typography.label, color: Colors.on_background, fontSize: 11 },

  listContent: { paddingHorizontal: Spacing.margin, paddingTop: 20, paddingBottom: 100, gap: Spacing.lg },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubbleAvatarWrap: { marginBottom: 18 },
  bubbleAvatar: { width: 32, height: 32, borderRadius: 16 },
  bubbleWrap: { maxWidth: '75%', gap: 4 },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubble: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.surface_container_low, borderBottomLeftRadius: 4 },
  bubbleText: { ...Typography.body, fontSize: 15 },
  bubbleTextMe: { color: Colors.on_primary },
  bubbleTextOther: { color: Colors.on_background },
  msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
  msgTime: { ...Typography.caption, color: Colors.on_surface_variant, fontSize: 10 },

  inputArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
  },
  inputPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.full,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    ...Shadows.ambient,
  },
  attachBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.on_background,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  sendGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
