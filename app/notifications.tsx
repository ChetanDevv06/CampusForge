import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Typography, Spacing, Roundness } from '../constants/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      console.warn("Notification stream error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const handlePress = async (notif: any) => {
    if (notif.unread) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { unread: false });
      } catch (e) {
        console.warn("Failed to mark as read", e);
      }
    }
    
    // Logic for deep linking based on type
    if (notif.chatId) {
      router.push({ pathname: '/chat/[id]', params: { id: notif.chatId } } as any);
    } else if (notif.itemId) {
      router.push({ pathname: '/item-details/[id]', params: { id: notif.itemId } } as any);
    }
  };

  const formatAgo = (createdAt: any) => {
    if (!createdAt) return 'Now';
    const date = typeof createdAt.toMillis === 'function' ? createdAt.toMillis() : new Date(createdAt).getTime();
    const seconds = Math.floor((Date.now() - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
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
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
        ) : notifications.length > 0 ? (
          notifications.map((notif) => (
            <TouchableOpacity 
              key={notif.id} 
              style={[styles.notifCard, notif.unread && styles.notifUnread]}
              onPress={() => handlePress(notif)}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${notif.color || '#6B52FF'}15` }]}>
                <Ionicons name={(notif.icon || 'notifications') as any} size={20} color={notif.color || '#6B52FF'} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifTime}>{formatAgo(notif.createdAt)}</Text>
                </View>
                <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
              </View>
              {notif.unread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#333" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySub}>No new notifications for you right now.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15151A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#15151A',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...Typography.display, color: '#FFF', fontSize: 20 },
  scrollContent: { padding: 20, gap: 16 },
  notifCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1C1C23',
    borderRadius: 24,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  notifUnread: {
    borderColor: 'rgba(107, 82, 255, 0.2)',
    backgroundColor: '#1E1E28',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { ...Typography.title, color: '#FFF', fontSize: 16 },
  notifTime: { ...Typography.caption, color: '#666', fontSize: 11 },
  notifMessage: { ...Typography.body, color: '#888', fontSize: 13, lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B52FF',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTitle: { ...Typography.headline, color: '#FFF', marginTop: 20, fontSize: 20 },
  emptySub: { ...Typography.body, color: '#666', marginTop: 8, textAlign: 'center' },
});
