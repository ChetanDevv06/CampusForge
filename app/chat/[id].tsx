import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  doc, setDoc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';

export default function ChatScreen() {
  const { id, name, otherUserId } = useLocalSearchParams<{ id: string; name: string, otherUserId: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
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
    return unsub;
  }, [id]);

  const sendMessage = async () => {
    if (!text.trim() || !uid || !id) return;
    const msgText = text.trim();
    setText('');
    await addDoc(collection(db, 'conversations', id, 'messages'), {
      text: msgText,
      senderId: uid,
      createdAt: serverTimestamp(),
    });
    // Update conversation metadata
    await setDoc(doc(db, 'conversations', id), {
      lastMessage: msgText,
      lastMessageAt: serverTimestamp(),
    }, { merge: true });
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === uid;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {isMe ? (
          <LinearGradient colors={Gradients.primary} style={styles.bubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.bubbleTextMe}>{item.text}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.bubbleOther}>
            <Text style={styles.bubbleTextOther}>{item.text}</Text>
          </View>
        )}
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
      keyboardVerticalOffset={90}
    >
      {/* Top Header Bar inside Screen */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <Text style={styles.activeLabel}>Chatting with</Text>
          <Text style={styles.chatName}>{name}</Text>
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

      {/* Input Bar */}
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
  msgRow: { marginBottom: 12, alignItems: 'flex-start' },
  msgRowMe: { alignItems: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOther: {
    maxWidth: '75%', borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  bubbleTextMe: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  bubbleTextOther: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22 },
  msgTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4, marginLeft: 4 },
  msgTimeMe: { marginLeft: 0, marginRight: 4 },
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.textMuted, fontSize: 15, marginTop: 12, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  input: {
    flex: 1, backgroundColor: Colors.bgSurface,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: Colors.textPrimary, fontSize: 15, maxHeight: 120,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
});
