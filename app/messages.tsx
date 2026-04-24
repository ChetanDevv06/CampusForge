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
import { Colors, Typography, Spacing, Roundness, Gradients, Shadows } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const router = useRouter();
  const uid = user?.uid;

  const getOtherUserId = (conv: any) => conv.participants.find((p: string) => p !== uid);

  const getOtherName = (conv: any) => {
    if (!uid) return 'Unknown';
    const otherId = conv.participants.find((p: string) => p !== uid);
    return conv.participantNames?.[otherId] || 'Campus Student';
  };

  const filteredConversations = conversations.filter(conv => {
    const otherName = getOtherName(conv).toLowerCase();
    return otherName.includes(searchQuery.toLowerCase());
  });

  const UserAvatar = ({ userId, otherName, cachedAvatar }: { userId: string, otherName: string, cachedAvatar?: string }) => {
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

    if (localAvatar) {
      return <Image source={{ uri: localAvatar }} style={styles.avatarImg} />;
    }

    return (
      <LinearGradient colors={Gradients.primary} style={styles.avatarPlaceholder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
      </LinearGradient>
    );
  };

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      where('collegeId', '==', profile?.collegeId || '')
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
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const otherUserId = getOtherUserId(item);
    const otherName = getOtherName(item);
    const unread = item.unreadCount?.[uid!] > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.card, 
          { backgroundColor: unread ? Colors.surface_container_high : Colors.surface_container_low }
        ]}
        onPress={() => {
          router.push({ 
            pathname: '/chat/[id]', 
            params: { id: item.id, name: otherName, otherUserId } 
          } as any);
        }}
      >
        <View style={styles.avatarContainer}>
          <UserAvatar userId={otherUserId} otherName={otherName} cachedAvatar={item.participantAvatars?.[otherUserId]} />
          {unread && <View style={styles.unreadPulse} />}
        </View>

        <View style={styles.info}>
          <View style={styles.infoTop}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>{otherName}</Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {item.lastSenderId === uid ? 'You: ' : ''}{item.lastMessage || 'Sent a photo'}
          </Text>
        </View>

        {unread && (
          <View style={styles.unreadCount}>
            <Text style={styles.unreadCountText}>{item.unreadCount[uid!]}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Editorial Header */}
      <View style={styles.header}>
        <View style={[styles.headerTop, { position: 'relative', justifyContent: 'center', minHeight: 48 }]}>
          {/* Back Button (Left) */}
          <View style={{ position: 'absolute', left: 0, zIndex: 10 }}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={{
                width: 44, height: 44, borderRadius: 22, 
                backgroundColor: Colors.surface_container_low,
                justifyContent: 'center', alignItems: 'center'
              }}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.on_background} />
            </TouchableOpacity>
          </View>

          {/* Centered Title */}
          <Text style={[styles.headerTitle, { textAlign: 'center', fontSize: 24, letterSpacing: 1 }]}>
            MESSAGES
          </Text>

          {/* Search Button (Right) */}
          <View style={{ position: 'absolute', right: 0, zIndex: 10 }}>
            <TouchableOpacity style={styles.searchIconBtn} onPress={() => setShowSearch(!showSearch)}>
              <Ionicons name={showSearch ? "close" : "search"} size={22} color={Colors.on_background} />
            </TouchableOpacity>
          </View>
        </View>
        
        {showSearch && (
          <View style={styles.searchBar}>
            <TextInput 
              style={styles.searchInput}
              placeholder="Filter conversations..."
              placeholderTextColor={Colors.on_surface_variant}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}
      </View>

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
          <Text style={styles.emptySub}>No active conversations found. Start a thread by browsing listings.</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)')}>
            <LinearGradient colors={Gradients.primary} style={styles.btnGrad}>
              <Text style={styles.btnText}>Explore Campus</Text>
            </LinearGradient>
          </TouchableOpacity>
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
    paddingHorizontal: Spacing.margin,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.display,
    fontSize: 42,
    color: Colors.on_background,
  },
  searchIconBtn: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface_container_high,
    justifyContent: 'center', alignItems: 'center',
  },
  searchBar: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface_container_low,
    borderRadius: Roundness.md,
    paddingHorizontal: Spacing.lg,
    height: 56,
    justifyContent: 'center',
  },
  searchInput: {
    ...Typography.body_medium,
    color: Colors.on_background,
  },

  listContent: { paddingHorizontal: Spacing.margin, paddingBottom: 120, gap: Spacing.sm },
  
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Roundness.lg,
  },
  avatarContainer: { position: 'relative', marginRight: Spacing.md },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...Typography.title, color: Colors.on_primary, fontSize: 24 },
  unreadPulse: {
    position: 'absolute', bottom: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.tertiary,
    borderWidth: 3, borderColor: Colors.background,
  },

  info: { flex: 1 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  name: { ...Typography.body_medium, color: Colors.on_surface_variant, fontSize: 16 },
  nameUnread: { color: Colors.on_background, ...Typography.title, fontSize: 17 },
  time: { ...Typography.caption, color: Colors.on_surface_variant },
  timeUnread: { color: Colors.primary, fontWeight: '700' },
  preview: { ...Typography.body, color: Colors.on_surface_variant, fontSize: 14 },
  previewUnread: { color: Colors.on_background, ...Typography.body_medium },

  unreadCount: {
    backgroundColor: Colors.tertiary,
    paddingHorizontal: 8, height: 22, minWidth: 22,
    borderRadius: 11, justifyContent: 'center', alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  unreadCountText: { color: Colors.on_tertiary, ...Typography.label, fontSize: 11 },

  empty: { flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.surface_container_high,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: { ...Typography.headline, color: Colors.on_background, marginBottom: Spacing.md },
  emptySub: { ...Typography.body, color: Colors.on_surface_variant, textAlign: 'center', marginBottom: Spacing.xxl },
  exploreBtn: { width: '100%', height: 60, borderRadius: Roundness.full, overflow: 'hidden' },
  btnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnText: { ...Typography.title, color: Colors.on_primary },
});
