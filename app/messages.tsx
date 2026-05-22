import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Image, TextInput, Dimensions, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows, Fonts } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const uid = user?.uid;

  const getOtherUserId = (conv: any) => conv.participants.find((p: string) => p !== uid);

  const getOtherName = (conv: any) => {
    if (!uid) return 'Unknown';
    const otherId = conv.participants.find((p: string) => p !== uid);
    const name = conv.participantNames?.[otherId];
    if (!name || name === 'Me') return 'Campus Student';
    return name;
  };

  const filteredConversations = conversations.filter(conv => {
    const otherName = getOtherName(conv).toLowerCase();
    return otherName.includes(searchQuery.toLowerCase());
  });

  const UserAvatar = ({ userId, otherName, cachedAvatar, size = 64, isOnline = false }: { userId: string, otherName: string, cachedAvatar?: string, size?: number, isOnline?: boolean }) => {
    const [localAvatar, setLocalAvatar] = useState<string | null>(cachedAvatar || avatarCache[userId] || null);

    useEffect(() => {
      if (!userId || localAvatar) return;
      const fetchAvatar = async () => {
        try {
          const snap = await getDoc(doc(db, 'users', userId));
          if (snap.exists()) {
            const url = snap.data().avatarUrl || null;
            setLocalAvatar(url);
            setAvatarCache(prev => ({ ...prev, [userId]: url }));
          }
        } catch (e) {}
      };
      fetchAvatar();
    }, [userId]);

    return (
      <View style={{ width: size, height: size, position: 'relative' }}>
        {localAvatar ? (
          <Image source={{ uri: localAvatar }} style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <LinearGradient 
            colors={Gradients.primary} 
            style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }}
          >
            <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{otherName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        )}
        {isOnline && <View style={[styles.onlineIndicator, { right: size * 0.05, bottom: size * 0.05 }]} />}
      </View>
    );
  };

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      convs.sort((a: any, b: any) => {
        const tA = a.lastMessageAt?.toMillis?.() || a.lastMessageAt || 0;
        const tB = b.lastMessageAt?.toMillis?.() || b.lastMessageAt || 0;
        return tB - tA;
      });
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
    const diffMins = Math.floor(diff / (1000 * 60));
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[date.getDay()];
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: any }) => {
    const otherUserId = getOtherUserId(item);
    const otherName = getOtherName(item);
    const unread = item.unreadCount?.[uid!] > 0;
    const isMe = item.lastSenderId === uid;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => {
          router.push({ 
            pathname: '/chat/[id]', 
            params: { id: item.id, name: otherName, otherUserId } 
          } as any);
        }}
      >
        <UserAvatar 
          userId={otherUserId} 
          otherName={otherName} 
          cachedAvatar={item.participantAvatars?.[otherUserId]} 
          isOnline={item.onlineStatus?.[otherUserId]}
        />

        <View style={styles.info}>
          <View style={styles.infoTop}>
            <Text style={styles.name} numberOfLines={1}>{otherName}</Text>
            <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.infoBottom}>
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
              {item.lastMessage || 'Sent a photo'}
            </Text>
            {isMe ? (
              <Ionicons name="checkmark-done" size={16} color={Colors.on_surface_variant} style={styles.statusIcon} />
            ) : unread ? (
              <View style={styles.unreadDot} />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.on_background} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 44 }} /> 
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.on_surface_variant} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={Colors.on_surface_variant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>RECENT CHATS</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="chatbubbles" size={48} color={Colors.primary_dim} />
          </View>
          <Text style={styles.emptyTitle}>Silent Commons</Text>
          <Text style={styles.emptySub}>No active conversations found.</Text>
        </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  backBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    color: Colors.primary,
    fontSize: 26,
    fontFamily: Fonts.bold,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface_container_low,
    borderRadius: 25,
    paddingHorizontal: 18,
    height: 54,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFF',
    fontSize: 16,
    fontFamily: Fonts.medium,
  },

  sectionTitle: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    marginHorizontal: 25,
    marginBottom: 20,
    opacity: 0.9,
  },

  listContent: { 
    paddingHorizontal: 15, 
    paddingBottom: 120, 
    gap: 12 
  },
  
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  avatarImg: { backgroundColor: '#1E1E22' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: Fonts.bold, color: '#FFF' },
  onlineIndicator: {
    position: 'absolute',
    width: 14, height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.background,
  },

  info: { flex: 1, marginLeft: 16 },
  infoTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 6 
  },
  name: { 
    color: '#FFF', 
    fontSize: 18, 
    fontFamily: Fonts.bold 
  },
  time: { 
    color: Colors.primary, 
    fontSize: 12, 
    fontFamily: Fonts.medium,
    opacity: 0.8
  },
  infoBottom: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  preview: { 
    flex: 1,
    color: '#8E8E93', 
    fontSize: 14, 
    fontFamily: Fonts.medium 
  },
  previewUnread: { 
    color: '#FFF',
  },
  statusIcon: { marginLeft: 8, opacity: 0.6 },
  unreadDot: {
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },

  empty: { flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyIconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: '#FFF', fontSize: 20, fontFamily: Fonts.bold, marginBottom: 8 },
  emptySub: { color: '#8E8E93', fontSize: 14, textAlign: 'center' },

});
