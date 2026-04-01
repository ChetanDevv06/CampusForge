import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Image, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useRouter, Stack } from 'expo-router';
import { Colors, Gradients } from '../constants/theme';
import { doc, getDoc } from 'firebase/firestore';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

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

  // Optimized Avatar Component
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
      <LinearGradient colors={Gradients.primary} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
      </LinearGradient>
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
      // Sort on client side to avoid manual index requirement
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
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getBadgeColors = (type: string): [string, string] => {
    switch (type) {
      case 'market': return ['#FF8E53', '#FE6B8B'];
      case 'skill': return ['#4facfe', '#00f2fe'];
      case 'lost': return ['#f093fb', '#f5576c'];
      case 'found': return ['#5eeff5', '#4568dc'];
      default: return [Gradients.primary[0], Gradients.primary[1]];
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const otherUserId = getOtherUserId(item);
    const otherName = getOtherName(item);
    const unread = item.unreadCount?.[uid!] > 0;
    const ref = item.itemMetadata;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.card, unread && styles.cardUnread]}
        onPress={() => {
          router.push({ 
            pathname: '/chat/[id]', 
            params: { 
              id: item.id, 
              name: otherName, 
              otherUserId,
              refType: ref?.type,
              refTitle: ref?.title,
              refImage: ref?.image,
              refId: item.itemId
            } 
          } as any);
        }}
      >
        <View style={styles.avatarContainer}>
          <UserAvatar 
            userId={otherUserId} 
            otherName={otherName} 
            cachedAvatar={item.participantAvatars?.[otherUserId]} 
          />
          {unread && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.info}>
          <View style={styles.infoTop}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </View>

          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {item.lastSenderId === uid ? 'You: ' : ''}{item.lastMessage || 'Sent a photo'}
          </Text>

          {ref && (
            <View style={styles.badgeRow}>
              <LinearGradient colors={getBadgeColors(ref.type)} style={styles.typeBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.typeBadgeText}>{ref.type?.toUpperCase()}</Text>
              </LinearGradient>
              <Text style={styles.refTitle} numberOfLines={1}>{ref.title}</Text>
            </View>
          )}
        </View>

        {unread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCountText}>{item.unreadCount[uid!]}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        {showSearch ? (
          <View style={styles.searchHeaderInner}>
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
              <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
            <TextInput 
              style={styles.headerSearchInput}
              placeholder="Search conversations..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {router.canGoBack() && (
                <TouchableOpacity style={styles.subBackBtn} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              )}
              <Text style={styles.headerTitle}>Messages</Text>
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={() => setShowSearch(true)}>
              <Ionicons name="search" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : filteredConversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="chatbubble-ellipses" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your inbox is empty</Text>
          <Text style={styles.emptySub}>When you message someone about a listing, it will appear here.</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)')}>
            <LinearGradient colors={Gradients.primary} style={styles.exploreGrad}>
              <Text style={styles.exploreText}>Start Exploring</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.bg,
  },
  searchHeaderInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgSurface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  headerSearchInput: { flex: 1, color: Colors.textPrimary, fontSize: 16 },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cardUnread: { backgroundColor: 'rgba(124,111,255,0.05)' },
  avatarContainer: { position: 'relative', marginRight: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  onlineDot: { 
    position: 'absolute', bottom: 2, right: 2, 
    width: 14, height: 14, borderRadius: 7, 
    backgroundColor: Colors.success, borderWidth: 3, borderColor: Colors.bg 
  },
  info: { flex: 1 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 17, fontWeight: '600', color: Colors.textSecondary },
  nameUnread: { color: Colors.textPrimary, fontWeight: '800' },
  time: { fontSize: 13, color: Colors.textMuted },
  timeUnread: { color: Colors.primary, fontWeight: '700' },
  preview: { fontSize: 14, color: Colors.textMuted, marginBottom: 8 },
  previewUnread: { color: Colors.textSecondary, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { 
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 
  },
  typeBadgeText: { fontSize: 9, fontWeight: '900', color: '#FFF' },
  refTitle: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  unreadBadge: { 
    width: 22, height: 22, borderRadius: 11, 
    backgroundColor: Colors.primary, justifyContent: 'center', 
    alignItems: 'center', marginLeft: 10 
  },
  unreadCountText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconContainer: { 
    width: 100, height: 100, borderRadius: 50, 
    backgroundColor: Colors.bgSurface, justifyContent: 'center', 
    alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: Colors.border
  },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  exploreBtn: { width: '100%', height: 56, borderRadius: 16, overflow: 'hidden' },
  exploreGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  exploreText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
