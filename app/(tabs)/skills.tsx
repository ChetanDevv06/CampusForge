import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';
import { startChat } from '../../utils/chat';

export default function SkillsScreen() {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('offer');
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    const q = query(collection(db, 'skills'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSkills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'skills', id), {
        status: currentStatus === 'completed' ? 'open' : 'completed'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = skills.filter(s => s.type === filter);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/skill-details/[id]', params: { id: item.id } } as any)}
      style={[styles.card, item.status === 'completed' && styles.cardCompleted]}
    >
      <View style={styles.cardTop}>
        <LinearGradient
          colors={filter === 'offer' ? Gradients.skillOffer : Gradients.skillRequest}
          style={styles.catIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Ionicons name={filter === 'offer' ? 'bulb' : 'book'} size={18} color="#FFF" />
        </LinearGradient>
        <View style={styles.cardTopText}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardCategory}>{item.category}</Text>
        </View>
        
        {uid === item.userId ? (
          <TouchableOpacity 
            style={[styles.actionBtn, item.status === 'completed' && styles.actionBtnActive]}
            onPress={() => handleToggleStatus(item.id, item.status)}
          >
            <Ionicons name={item.status === 'completed' ? "refresh-outline" : "checkmark-circle-outline"} size={14} color={item.status === 'completed' ? Colors.textPrimary : Colors.success} />
            <Text style={[styles.actionText, item.status === 'completed' && { color: Colors.textPrimary }]}>
              {item.status === 'completed' ? 'Reopen' : 'Complete'}
            </Text>
          </TouchableOpacity>
        ) : (
          uid !== item.userId && item.status !== 'completed' && (
            <TouchableOpacity 
              style={styles.connectBtn}
              onPress={() => startChat(item.userId, item.userName || 'Student', router, {
                type: 'skill',
                title: item.title,
                itemId: item.id
              })}
            >
              <Text style={styles.connectText}>Connect</Text>
            </TouchableOpacity>
          )
        )}
      </View>
      <Text style={styles.cardDesc}>{item.description}</Text>
      <View style={styles.cardMeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="person-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.metaText}>
            {(() => {
              const rawName = item.authorName || item.userName || 'Student';
              // If it looks like a roll number (e.g., starts with numbers or has many numbers)
              return /^\d/.test(rawName) || (rawName.match(/\d/g)?.length || 0) > 4 ? 'Student' : rawName;
            })()}
          </Text>
        </View>
        {item.status === 'completed' && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-done" size={14} color={Colors.success} />
            <Text style={styles.completedBadgeText}>COMPLETED</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hero */}
      <LinearGradient colors={['#1C1C3A', Colors.bg]} style={styles.hero}>
        <Text style={styles.heroTitle}>Skill Exchange</Text>
        <Text style={styles.heroSub}>Teach what you know, learn what you don't</Text>
      </LinearGradient>

      {/* Toggle */}
      <View style={styles.toggle}>
        {[{ key: 'offer', label: 'Offering', grad: Gradients.skillOffer },
          { key: 'request', label: 'Requesting', grad: Gradients.skillRequest }].map(t => (
          <TouchableOpacity key={t.key} style={[styles.toggleBtn, filter === t.key && styles.toggleActive]} onPress={() => setFilter(t.key)}>
            {filter === t.key
              ? <LinearGradient colors={t.grad} style={styles.toggleGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.toggleTextActive}>{t.label}</Text>
                </LinearGradient>
              : <Text style={styles.toggleText}>{t.label}</Text>
            }
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
        : <FlatList
            data={filtered}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="flash-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No skills posted yet</Text>
              </View>
            }
          />
      }

      <TouchableOpacity style={styles.fabWrapper} onPress={() => router.push('/post-skill')}>
        <LinearGradient colors={Gradients.skillOffer} style={styles.fab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={28} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  heroSub: { fontSize: 14, color: Colors.textSecondary },
  toggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 10 },
  toggleBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  toggleActive: { borderColor: 'transparent' },
  toggleGrad: { paddingVertical: 12, alignItems: 'center' },
  toggleText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', paddingVertical: 12, textAlign: 'center' },
  toggleTextActive: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: 18, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  cardCompleted: { opacity: 0.7, borderColor: Colors.success },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgSurface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sellerInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  sellerRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  authorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgSurface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  authorInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  authorRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTopText: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardCategory: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  connectBtn: {
    backgroundColor: Colors.bgSurface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderActive,
  },
  connectText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52,238,154,0.1)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.success,
  },
  actionBtnActive: { backgroundColor: Colors.bgSurface, borderColor: Colors.border },
  actionText: { color: Colors.success, fontSize: 12, fontWeight: '700' },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { color: Colors.textMuted, fontSize: 13, marginLeft: 6 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(52,238,154,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  completedBadgeText: { color: Colors.success, fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: Colors.textMuted, fontSize: 16, marginTop: 12 },
  fabWrapper: { position: 'absolute', bottom: 24, right: 24 },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
});
