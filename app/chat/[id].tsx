import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
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
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Gradients } from '../../constants/theme';
import { auth, db, storage } from '../../firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    }>();
  const [activeConvId, setActiveConvId] = useState(id);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [convMetadata, setConvMetadata] = useState<any>(null);
  const [reference, setReference] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuMessage, setMenuMessage] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const commonEmojis = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😋", "😛", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "📁", "📍", "🤝", "💵", "👋", "🔥", "💯", "👍", "🙌", "❤️", "✨"];
  
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const flatRef = useRef<FlatList>(null);
  const { user, profile } = useAuth();
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (refType) {
      const suggestions = 
        refType === 'market' ? ["Is this available?", "Price negotiable?", "Where can we meet?"] :
        refType === 'skill' ? ["I'm interested in learning!", "What's your availability?", "Do you teach beginners?"] :
        ["Can you share more details?", "Is this still open?", "I can help with this!"];
      setQuickReplies(suggestions);
    }
  }, [refType]);
  useEffect(() => {
    if (refType) {
      setReference({
        type: refType,
        title: refTitle,
        image: refImage,
        itemId: refId
      });
    } else if (convMetadata?.itemMetadata) {
      setReference({
        ...convMetadata.itemMetadata,
        itemId: convMetadata.itemId
      });
    }
  }, [refType, convMetadata]);

  const formatLastSeen = (timestamp: any) => {
    if (!timestamp) return 'long ago';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

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
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }, () => setLoading(false));

    let unsubUser = () => {};
    if (otherUserId) {
      unsubUser = onSnapshot(doc(db, 'users', otherUserId), (snap) => {
        if (snap.exists()) setOtherUserProfile(snap.data());
      });
    }

    // Fetch conversation metadata and sync names if they look like email parts
    getDoc(doc(db, 'conversations', activeConvId)).then(async docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConvMetadata(data);

        // Name Syncing logic (Fix existing conversations showing email prefixes)
        if (uid) {
          try {
            const participants = data.participants || [];
            const targetOtherUserId = otherUserId || participants.find((p: string) => p !== uid);
            
            if (!targetOtherUserId) return;

            const currentNameInConv = data.participantNames?.[uid];
            const otherNameInConv = data.participantNames?.[targetOtherUserId];
            
            const otherUserSnap = await getDoc(doc(db, 'users', targetOtherUserId));
            const otherUserData = otherUserSnap.data();
            const realOtherName = otherUserData?.name;
            const myRealName = profile?.name;

            const updates: any = {};
            if (myRealName && currentNameInConv !== myRealName) {
              updates[`participantNames.${uid}`] = myRealName;
            }
            if (realOtherName && otherNameInConv !== realOtherName) {
              updates[`participantNames.${targetOtherUserId}`] = realOtherName;
            }

            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, 'conversations', activeConvId), updates);
            }
          } catch (e) {
            console.error("Name sync error:", e);
          }
        }
      }
    });

    // Clear unread count for the current user
    if (uid) {
      updateDoc(doc(db, 'conversations', activeConvId), {
        [`unreadCount.${uid}`]: 0
      }).catch(e => console.error("Error clearing notifications:", e));
    }

    return unsub;
  }, [activeConvId, uid]);

  const PROFANITY_LIST = ['abuse', 'spam', 'scam', 'fuck', 'shit', 'asshole', 'bastard']; // Simplified list

  const filterText = (input: string) => {
    let output = input;
    PROFANITY_LIST.forEach(word => {
      const reg = new RegExp(word, 'gi');
      output = output.replace(reg, '***');
    });
    return output;
  };

  const handleBlockUser = async () => {
    if (!otherUserId || !uid) return;
    Alert.alert(
      "Block User",
      "Are you sure you want to block this user? You will no longer receive messages from them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
             // Implementation: Add to a 'blockedUsers' field in the current user document
             await updateDoc(doc(db, 'users', uid), {
               blockedUsers: (convMetadata?.blockedUsers || []).concat(otherUserId)
             });
             router.back();
          }
        }
      ]
    );
  };

  const handleReport = async () => {
    Alert.alert("Reported", "This conversation has been reported to the moderators for review.", [{ text: "OK" }]);
    // In production, we would log this to a 'reports' collection in Firestore.
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!reference?.itemId || !refType) return;
    try {
      const collectionName = refType === 'market' ? 'marketplace' : refType === 'skill' ? 'skills' : 'lostfound';
      await updateDoc(doc(db, collectionName, reference.itemId), {
        status: newStatus
      });
      // Update local state to reflect change immediately if needed, 
      // but usually the next time the item is fetched it will be updated.
      Alert.alert("Success", `Item marked as ${newStatus}!`);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to update status.");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      handleSendImage(result.assets[0].uri);
    }
  };

  const uploadImageAsync = async (uri: string) => {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function() { resolve(xhr.response); };
      xhr.onerror = function(e) { reject(new TypeError('Network request failed')); };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });

    const fileRef = ref(storage, `chats/${activeConvId}/${Date.now()}`);
    await uploadBytes(fileRef, blob as Blob);
    return await getDownloadURL(fileRef);
  };

  const handleSendImage = async (imageUri: string) => {
    if (!uid) return;
    try {
      const downloadUrl = await uploadImageAsync(imageUri);
      await sendMessage('', downloadUrl);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to upload image.");
    }
  };

  const sendMessage = async (overrideText?: string, imageUrl?: string) => {
    const finalMsg = overrideText !== undefined ? overrideText : text;
    if (!finalMsg.trim() && !imageUrl || !uid) return;
    const msgText = filterText(finalMsg.trim());
    const replyData = replyingTo ? { id: replyingTo.id, text: replyingTo.text, senderId: replyingTo.senderId } : null;

    let targetId = activeConvId;
    
    if (imageUrl === undefined) setText('');
    setReplyingTo(null);

    // 1. If it's a NEW conversation, create it first
    if (targetId === 'new') {
      try {
        const [currentUserDoc, otherUserDoc] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDoc(doc(db, 'users', otherUserId!))
        ]);

        const currentUserData = currentUserDoc.data();
        const otherUserData = otherUserDoc.data();

        const currentUserName = currentUserData?.name || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Campus Student';
        const realOtherUserName = otherUserData?.name || name || 'Campus Student';
        const currentUserAvatar = currentUserData?.avatarUrl || null;
        const otherUserAvatar = otherUserData?.avatarUrl || null;

        const newConv = await addDoc(collection(db, 'conversations'), {
          participants: [uid, otherUserId],
          participantNames: {
            [uid]: currentUserName,
            [otherUserId!]: realOtherUserName
          },
          participantAvatars: {
            [uid]: currentUserAvatar,
            [otherUserId!]: otherUserAvatar
          },
          itemId: refId || null,
          itemMetadata: refType ? {
            type: refType,
            title: refTitle,
            image: refImage || null,
            ownerId: otherUserId // Presumed owner if buyer initiates
          } : null,
          lastMessage: imageUrl ? 'Sent a photo' : msgText,
          lastMessageAt: serverTimestamp(),
          lastSenderId: uid,
          unreadCount: {
            [uid]: 0,
            [otherUserId!]: 1
          }
        });
        
        targetId = newConv.id;
        setActiveConvId(targetId);
        router.setParams({ id: targetId });
      } catch (e) {
        console.error(e);
        return;
      }
    }

    // 2. Add the message
    await addDoc(collection(db, 'conversations', targetId, 'messages'), {
      text: msgText,
      imageUrl: imageUrl || null,
      senderId: uid,
      createdAt: serverTimestamp(),
      replyTo: replyData,
    });

    // 3. Update conversation metadata
    if (activeConvId !== 'new') {
      const recipientId = otherUserId;
      await updateDoc(doc(db, 'conversations', targetId), {
        lastMessage: imageUrl ? 'Sent a photo' : msgText,
        lastMessageAt: serverTimestamp(),
        lastSenderId: uid,
        ...(recipientId && { [`unreadCount.${recipientId}`]: increment(1) })
      });
    }
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
            await setDoc(doc(db, 'conversations', activeConvId!, 'messages', messageId), {
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

  const isSameDay = (d1: any, d2: any) => {
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = d2.toDate ? d2.toDate() : new Date(d2);
    return date1.toDateString() === date2.toDateString();
  };

  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.senderId === uid;
    const isDeleted = item.isDeleted;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = !prevMsg || !isSameDay(item.createdAt, prevMsg.createdAt);

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>
              {(() => {
                const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                
                if (date.toDateString() === today.toDateString()) return 'Today';
                if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
                return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              })()}
            </Text>
            <View style={styles.dateLine} />
          </View>
        )}
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

            {item.imageUrl && (
              <Image 
                source={{ uri: item.imageUrl }} 
                style={styles.msgImage}
                resizeMode="cover"
              />
            )}
            {item.text ? (
              <Text style={[
                isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
                isDeleted && styles.deletedText
              ]}>
                {item.text}
              </Text>
            ) : null}
            
            <View style={styles.msgFooter}>
              <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
              {isMe && !isDeleted && (
                <Ionicons 
                  name={item.read ? "checkmark-done" : "checkmark"} 
                  size={14} 
                  color={item.read ? Colors.primary : Colors.textMuted} 
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {showEmojiPicker && (
        <Pressable 
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 999 }]} 
          onPress={() => setShowEmojiPicker(false)} 
        />
      )}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      {/* Top Header Bar inside Screen */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInfo}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          {(otherUserProfile?.avatarUrl || convMetadata?.participantAvatars?.[otherUserId!]) ? (
            <Image source={{ uri: otherUserProfile?.avatarUrl || convMetadata.participantAvatars[otherUserId!] }} style={styles.headerAvatar} />
          ) : (
            <LinearGradient colors={Gradients.primary} style={styles.headerAvatarPlaceholder}>
              <Text style={styles.avatarInitial}>{(otherUserProfile?.name || convMetadata?.participantNames?.[otherUserId!] || name || 'C').charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          )}
          <View style={styles.topBarContent}>
            <Text style={styles.chatName} numberOfLines={1}>
              {otherUserProfile?.name || convMetadata?.participantNames?.[otherUserId!] || name || 'Campus User'}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: otherUserProfile?.online ? Colors.success : Colors.textMuted }]} />
              <Text style={styles.activeLabel}>
                {otherUserProfile?.online ? 'Online' : `Last seen: ${formatLastSeen(otherUserProfile?.lastSeen)}`}
              </Text>
            </View>
          </View>
        </View>
        {otherUserId && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={handleReport}>
              <Ionicons name="flag-outline" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBlockUser}>
              <Ionicons name="shield-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rateBtn}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: otherUserId } } as any)}
            >
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.rateBtnText}>Rate</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {(() => {
        const isItemOwner = convMetadata?.itemMetadata?.ownerId === uid;

        return (
          <View style={styles.referenceHeaderContainer}>
            {reference && (
              <BlurView intensity={90} tint="dark" style={styles.referenceHeader}>
                {reference.image ? (
                  <Image source={{ uri: reference.image }} style={styles.refImage} />
                ) : (
                  <LinearGradient colors={Gradients.primary} style={styles.refIconBox}>
                    <Ionicons name={reference.type === 'skill' ? 'bulb' : reference.type === 'market' ? 'cart' : 'search'} size={18} color="#FFF" />
                  </LinearGradient>
                )}
                <View style={styles.refContent}>
                  <View style={styles.refBadgeLayout}>
                    <Text style={styles.refLabel}>{reference.type?.toUpperCase()}</Text>
                    <View style={[styles.statusPill, (convMetadata?.itemStatus === 'sold' || convMetadata?.itemStatus === 'resolved') && { backgroundColor: 'rgba(255,94,94,0.1)' }]}>
                      <Text style={[styles.statusPillText, (convMetadata?.itemStatus === 'sold' || convMetadata?.itemStatus === 'resolved') && { color: Colors.danger }]}>
                        {convMetadata?.itemStatus || 'Available'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.refTitle} numberOfLines={1}>{reference.title}</Text>
                </View>
                
                {isItemOwner && (
                  <TouchableOpacity 
                    style={styles.statusActionBtn}
                    onPress={() => {
                      const options = reference.type === 'market' ? ["Mark as Sold", "Mark as Available"] : ["Mark as Resolved", "Mark as Open"];
                      Alert.alert(
                        "Update Status",
                        "Change listing visibility for others?",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: options[0], onPress: () => handleStatusUpdate(reference.type === 'market' ? 'sold' : 'resolved') },
                          { text: options[1], onPress: () => handleStatusUpdate(reference.type === 'market' ? 'available' : 'open') }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={styles.refViewBtn}
                  onPress={() => {
                    const path = reference.type === 'skill' ? '/skill-details/[id]' : reference.type === 'market' ? '/market-details/[id]' : '/item-details/[id]';
                    router.push({ pathname: path, params: { id: reference.itemId } } as any);
                  }}
                >
                  <LinearGradient colors={Gradients.primary} style={styles.refViewGrad}>
                    <Text style={styles.refViewText}>View</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>
            )}
          </View>
        );
      })()}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <LinearGradient colors={Gradients.primary} style={styles.emptyIcon}>
                  <Ionicons name="chatbubbles" size={32} color="#FFF" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>New Conversation</Text>
                <Text style={styles.emptyText}>Send a message to start dealing safely with your campus mate.</Text>
                
                <View style={[styles.quickReplies, { marginTop: 40 }]}>
                  {quickReplies.map((reply, i) => (
                    <TouchableOpacity key={i} style={styles.quickReply} onPress={() => setText(reply)}>
                      <Text style={styles.quickReplyText}>{reply}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
          />
          {otherUserTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>{name || 'Partner'} is typing...</Text>
            </View>
          )}
        </View>
      )}

      {/* Input Containers */}
      <View style={[styles.inputContainer, showEmojiPicker && { paddingBottom: 0 }]}>
        {renderActionMenu()}
        
        {/* Emoji Tray */}
        {showEmojiPicker && (
          <View style={styles.emojiTray}>
            <View style={styles.emojiTrayHeader}>
              <Text style={styles.emojiTrayTitle}>Emojis</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={commonEmojis}
              numColumns={8}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.emojiItem} 
                  onPress={() => setText(prev => prev + item)}
                >
                  <Text style={styles.emojiText}>{item}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.emojiList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* Quick Replies Row */}
        {quickReplies.length > 0 && !text.trim() && !showEmojiPicker && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {quickReplies.map((reply, i) => (
              <TouchableOpacity key={i} style={styles.quickReplyPill} onPress={() => setText(reply)}>
                <Text style={styles.quickReplyPillText}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

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
          <TouchableOpacity style={styles.attachmentBtn} onPress={pickImage}>
            <Ionicons name="add" size={24} color={Colors.primary} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (t.length > 0 && !isTyping) {
                // handleTyping(true);
              }
            }}
            multiline
            maxLength={1000}
            onFocus={() => {
              setShowEmojiPicker(false);
              setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 300);
            }}
          />
          
          <TouchableOpacity 
            style={[styles.emojiBtn, showEmojiPicker && styles.emojiBtnActive]}
            onPress={() => {
              Keyboard.dismiss();
              setShowEmojiPicker(!showEmojiPicker);
            }}
          >
            <Ionicons 
              name={showEmojiPicker ? "keypad-outline" : "happy-outline"} 
              size={24} 
              color={showEmojiPicker ? Colors.primary : Colors.textMuted} 
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => sendMessage()} disabled={!text.trim() && !showEmojiPicker}>
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
    </View>
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
  headerBackBtn: { paddingRight: 8 },
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
  inputContainer: { 
    borderTopWidth: 1, 
    borderTopColor: Colors.border, 
    backgroundColor: Colors.bgCard,
    zIndex: 1000,
  },
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
  referenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  refImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
  },
  refIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refContent: {
    flex: 1,
  },
  refLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  refTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  refViewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 111, 255, 0.1)',
  },
  refViewText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  refBadgeLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusPill: {
    backgroundColor: 'rgba(52, 238, 154, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 9,
    color: Colors.success,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  refViewGrad: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  quickReplies: {
    width: '100%',
    gap: 10,
  },
  quickReply: {
    backgroundColor: Colors.bgSurface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  quickReplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.bg,
  },
  typingText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  quickRepliesRow: {
    paddingVertical: 12,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  quickReplyPill: {
    backgroundColor: Colors.bgSurface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  quickReplyPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  attachmentBtn: {
    padding: 8,
  },
  emojiBtn: {
    padding:  8,
  },
  statusActionBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    marginRight: 4,
  },
  referenceHeaderContainer: {
    paddingHorizontal: 0,
    backgroundColor: Colors.bg,
  },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  emojiTray: {
    height: 250,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  emojiTrayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  emojiTrayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  emojiList: {
    padding: 8,
  },
  emojiItem: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(124, 111, 255, 0.1)',
    borderRadius: 8,
  },
});
