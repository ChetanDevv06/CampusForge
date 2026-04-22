import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Image, TextInput, Dimensions, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const StatusDot = ({ userId }: { userId: string }) => {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!userId) return;
    return onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) setOnline(!!snap.data().online);
    });
  }, [userId]);

  return (
    <View style={[styles.statusDot, { backgroundColor: online ? '#4ade80' : '#ef4444' }]} />
  );
};

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const uid = user?.uid;

  const getOtherUserId = (conv: any) => conv.participants.find((p: string) => p !== uid);
  const getOtherName = (conv: any) => conv.participantNames?.[getOtherUserId(conv)] || 'Campus Student';

  const filteredConversations = conversations.filter(conv => 
    getOtherName(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
    const unsub = onSnapshot(q, (snap) => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      convs.sort((a: any, b: any) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
      setConversations(convs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: any }) => {
    const otherUserId = getOtherUserId(item);
    const otherName = getOtherName(item);
    const unreadCount = item.unreadCount?.[uid!] || 0;
    const isMe = item.lastSenderId === uid;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.chatPill}
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id, name: otherName, otherUserId } } as any)}
      >
        <View style={styles.avatarWrapper}>
          {item.participantAvatars?.[otherUserId] ? (
            <Image source={{ uri: item.participantAvatars[otherUserId] }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={Gradients.primary} style={styles.avatar}>
              <Text style={styles.avatarText}>{otherName[0].toUpperCase()}</Text>
            </LinearGradient>
          )}
          <StatusDot userId={otherUserId} />
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatTop}>
            <Text style={styles.chatName} numberOfLines={1}>{otherName}</Text>
            <Text style={styles.chatTime}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.chatBottom}>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {isMe ? 'You: ' : ''}{item.lastMessage || 'Sent an attachment'}
            </Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadIndicator} />
            ) : isMe && (
              <Ionicons name="checkmark-done" size={16} color="rgba(255,255,255,0.2)" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with Back & Compose */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.topTitle}>Messages</Text>
        
        <TouchableOpacity 
          onPress={() => router.push('/search')}
          style={styles.headerBtn}
        >
          <Ionicons name="create-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>RECENT CHATS</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#7b61ff" /></View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5, flex: 1, textAlign: 'center' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface_container_highest,
    borderRadius: 30,
    height: 54,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '500' },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { ...Typography.label, color: '#a4a6ff', fontSize: 13, letterSpacing: 1.5, fontWeight: '800' },

  listContent: { paddingHorizontal: 20, paddingBottom: 60, gap: 12 },
  
  chatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface_container_high,
    padding: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...Typography.title, color: '#fff', fontSize: 20 },
  statusDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: Colors.surface_container_high,
  },

  chatInfo: { flex: 1, marginLeft: 16 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { ...Typography.body_medium, color: '#fff', fontSize: 17, fontWeight: '700' },
  chatTime: { ...Typography.caption, color: '#a4a6ff', fontSize: 12, fontWeight: '600' },
  chatBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatPreview: { ...Typography.body, color: 'rgba(255,255,255,0.5)', fontSize: 14, flex: 1, marginRight: 10 },
  unreadIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#a4a6ff' },
});
