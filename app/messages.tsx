import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../constants/theme';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  const getOtherName = (conv: any) => {
    if (!uid) return 'Unknown';
    return conv.participantNames?.[conv.participants.find((p: string) => p !== uid)] || 'Campus Student';
  };

  const renderItem = ({ item }: { item: any }) => {
    const otherName = getOtherName(item);
    const initials = otherName.charAt(0).toUpperCase();
    const unread = item.unreadCount?.[uid!] > 0;

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id, name: otherName } } as any)}
      >
        <LinearGradient colors={Gradients.primary} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
        <View style={styles.info}>
          <View style={styles.infoTop}>
            <Text style={[styles.name, unread && styles.nameUnread]}>{otherName}</Text>
            <Text style={styles.time}>
              {item.lastMessageAt ? new Date(item.lastMessageAt.toDate?.() || item.lastMessageAt).toLocaleDateString() : ''}
            </Text>
          </View>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient colors={Gradients.primary} style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={40} color="#FFF" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>No Conversations Yet</Text>
          <Text style={styles.emptySub}>Connect with sellers, skill sharers or item finders to start chatting.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cardUnread: { backgroundColor: 'rgba(124,111,255,0.05)' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  info: { flex: 1 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  nameUnread: { color: Colors.textPrimary, fontWeight: '700' },
  time: { fontSize: 12, color: Colors.textMuted },
  preview: { fontSize: 13, color: Colors.textMuted },
  previewUnread: { color: Colors.textSecondary },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginLeft: 10 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
