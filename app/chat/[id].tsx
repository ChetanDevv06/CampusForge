import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Gradients } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, name, otherUserId, refType, refTitle, refImage, refId } =
    useLocalSearchParams<{
      id: string
      name: string
      otherUserId: string
      refType?: string
      refTitle?: string
      refImage?: string
      refId?: string
    }>(); const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [convMetadata, setConvMetadata] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuMessage, setMenuMessage] = useState<any>(null);
  const flatRef = useRef<FlatList>(null);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'conversations', id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }, () => setLoading(false));

    // Fetch conversation metadata for header
    getDoc(doc(db, 'conversations', id)).then(docSnap => {
      if (docSnap.exists()) {
        setConvMetadata(docSnap.data());
      }
    });

    // Clear unread count for the current user
    if (uid) {
      updateDoc(doc(db, 'conversations', id), {
        [`unreadCount.${uid}`]: 0
      }).catch(e => console.error("Error clearing notifications:", e));
    }

    return unsub;
  }, [id, uid]);

  const sendMessage = async () => {
    if (!text.trim() || !uid || !id) return;
    const msgText = text.trim();
    const replyData = replyingTo ? { id: replyingTo.id, text: replyingTo.text, senderId: replyingTo.senderId } : null;

    setText('');
    setReplyingTo(null);

    await addDoc(collection(db, 'conversations', id, 'messages'), {
      text: msgText,
      senderId: uid,
      createdAt: serverTimestamp(),
      replyTo: replyData,
      reference: refType ? {
        type: refType,
        title: refTitle,
        image: refImage,
        itemId: refId
      } : null
    });

    // Update conversation metadata
    const recipientId = otherUserId;
    await updateDoc(doc(db, 'conversations', id), {
      lastMessage: msgText,
      lastMessageAt: serverTimestamp(),
      lastSenderId: uid,
      ...(recipientId && { [`unreadCount.${recipientId}`]: increment(1) })
    });
  };

  const deleteMessage = async (messageId: string) => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await setDoc(doc(db, 'conversations', id!, 'messages', messageId), {
              text: "This message was deleted",
              isDeleted: true,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        }
      ]
    );
  };

  const handleLongPress = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuMessage(item);
    setMenuVisible(true);
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setMenuVisible(false);
    // Optional: show a small toast
  };

  const renderActionMenu = () => {
    if (!menuMessage) return null;
    const isMe = menuMessage.senderId === uid;
    const isMsgDeleted = menuMessage.isDeleted;

    const actions = [
      { id: 'reply', icon: 'arrow-undo', label: 'Reply', color: Colors.textPrimary },
      { id: 'copy', icon: 'copy-outline', label: 'Copy Text', color: Colors.textPrimary },
    ];

    if (isMe && !isMsgDeleted) {
      actions.push({ id: 'delete', icon: 'trash-outline', label: 'Delete', color: '#FF5E5E' });
    }

    return (
      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
          )}

          <View style={styles.menuContent}>
            {/* The highlighted message (Visual cue) */}
            <View style={[styles.msgRow, isMe && styles.msgRowMe, { marginBottom: 20 }]}>
              <View style={[isMe ? styles.bubble : styles.bubbleOther, { opacity: 1, elevation: 10 }]}>
                <Text style={isMe ? styles.bubbleTextMe : styles.bubbleTextOther}>{menuMessage.text}</Text>
              </View>
            </View>

            {/* The Menu Card */}
            <View style={styles.menuCard}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.menuItem, index < actions.length - 1 && styles.menuItemBorder]}
                  onPress={() => {
                    if (action.id === 'reply') setReplyingTo(menuMessage);
                    if (action.id === 'copy') copyToClipboard(menuMessage.text);
                    if (action.id === 'delete') deleteMessage(menuMessage.id);
                    setMenuVisible(false);
                  }}
                >
                  <Ionicons name={action.icon as any} size={20} color={action.color} />
                  <Text style={[styles.menuItemText, { color: action.color }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    );
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === uid;
    const isDeleted = item.isDeleted;

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => handleLongPress(item)}
          style={[
            isMe ? styles.bubble : styles.bubbleOther,
            isDeleted && styles.bubbleDeleted
          ]}
        >
          {item.replyTo && (
            <View style={[styles.replyQuote, isMe ? styles.replyQuoteMe : styles.replyQuoteOther]}>
              <Text style={styles.replyQuoteSender} numberOfLines={1}>
                {item.replyTo.senderId === uid ? "You" : (name || "Partner")}
              </Text>
              <Text style={styles.replyQuoteText} numberOfLines={1}>{item.replyTo.text}</Text>
            </View>
          )}

          {item.reference && (
            <View style={{
              backgroundColor: '#00000020',
              padding: 8,
              borderRadius: 8,
              marginBottom: 6
            }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '700',
                opacity: 0.8
              }}>
                {item.reference.type?.toUpperCase()}
              </Text>

              <Text style={{
                fontSize: 13,
                fontWeight: '600'
              }}>
                {item.reference.title}
              </Text>
            </View>
          )}
          <Text style={[
            isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
            isDeleted && styles.deletedText
          ]}>
            {item.text}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      {/* Top Header Bar inside Screen */}
      <View style={styles.topBar}>
        <View style={styles.headerInfo}>
          {convMetadata?.participantAvatars?.[otherUserId!] ? (
            <Image source={{ uri: convMetadata.participantAvatars[otherUserId!] }} style={styles.headerAvatar} />
          ) : (
            <LinearGradient colors={Gradients.primary} style={styles.headerAvatarPlaceholder}>
              <Text style={styles.avatarInitial}>{(convMetadata?.participantNames?.[otherUserId!] || name || 'C').charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          )}
          <View style={styles.topBarContent}>
            <Text style={styles.activeLabel}>Chatting with</Text>
            <Text style={styles.chatName} numberOfLines={1}>
              {convMetadata?.participantNames?.[otherUserId!] || name || 'Campus User'}
            </Text>
          </View>
        </View>
        {otherUserId && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: otherUserId } } as any)}
          >
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.rateBtnText}>Rate</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Say hello to start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* Input Containers */}
      <View style={styles.inputContainer}>
        {renderActionMenu()}
        {replyingTo && (
          <View style={styles.replyPreview}>
            <View style={styles.replyPreviewInner}>
              <View style={styles.replyBar} />
              <View style={styles.replyContent}>
                <Text style={styles.replyTitle}>Replying to {replyingTo.senderId === uid ? 'yourself' : (name || 'Partner')}</Text>
                <Text style={styles.replySub} numberOfLines={1}>{replyingTo.text}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyClose}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity onPress={sendMessage} disabled={!text.trim()}>
            <LinearGradient
              colors={text.trim() ? Gradients.primary : [Colors.bgSurface, Colors.bgSurface]}
              style={styles.sendBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="send" size={18} color={text.trim() ? '#FFF' : Colors.textMuted} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      {Platform.OS === 'android' && <View style={{ height: insets.bottom > 0 ? insets.bottom : 10, backgroundColor: Colors.bgCard }} />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBarContent: { flex: 1 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  activeLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  chatName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rateBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 16, alignItems: 'flex-start' },
  msgRowMe: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%', borderRadius: 20, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.primary // Fallback if gradient wrap fails during refactor
  },
  bubbleOther: {
    maxWidth: '80%', borderRadius: 20, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  bubbleDeleted: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: Colors.border, borderStyle: 'dashed' },
  bubbleTextMe: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  bubbleTextOther: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22 },
  deletedText: { color: Colors.textMuted, fontStyle: 'italic', fontSize: 13 },
  replyQuote: {
    padding: 8, borderRadius: 8, marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.1)', borderLeftWidth: 3, borderLeftColor: '#FFF'
  },
  replyQuoteOther: { borderLeftColor: Colors.primary, backgroundColor: 'rgba(124,111,255,0.1)' },
  replyQuoteMe: { borderLeftColor: '#FFF', backgroundColor: 'rgba(255,255,255,0.2)' },
  replyQuoteSender: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  replyQuoteText: { fontSize: 13, color: Colors.textSecondary },
  msgTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4, marginLeft: 4 },
  msgTimeMe: { marginLeft: 0, marginRight: 4 },
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.textMuted, fontSize: 15, marginTop: 12, textAlign: 'center' },
  inputContainer: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bgCard },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.bgSurface, borderBottomWidth: 1, borderBottomColor: Colors.border
  },
  replyPreviewInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBar: { width: 3, height: '100%', backgroundColor: Colors.primary, borderRadius: 2, marginRight: 10 },
  replyContent: { flex: 1 },
  replyTitle: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  replySub: { fontSize: 13, color: Colors.textSecondary },
  replyClose: { padding: 4 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12,
  },
  input: {
    flex: 1, backgroundColor: Colors.bgSurface,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: Colors.textPrimary, fontSize: 15, maxHeight: 120,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  menuOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  menuContent: { width: '100%', alignItems: 'center' },
  menuCard: {
    width: 200,
    backgroundColor: 'rgba(30, 30, 45, 0.95)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuItemText: { fontSize: 16, fontWeight: '600' },
});
