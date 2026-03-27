import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../../constants/theme';
import { startChat } from '../../utils/chat';

export default function MarketScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    const q = query(collection(db, 'marketplace'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'marketplace', id), {
        status: currentStatus === 'sold' ? 'available' : 'sold'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.status === 'sold' && styles.cardSold]}>
      <View style={styles.imageBox}>
        {item.imageUrl
          ? <Image source={{ uri: item.imageUrl }} style={[styles.image, item.status === 'sold' && { opacity: 0.5 }]} />
          : <LinearGradient colors={Gradients.card} style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
            </LinearGradient>
        }
        {item.status === 'sold' && (
          <View style={styles.soldBadge}>
            <Text style={styles.soldText}>SOLD</Text>
          </View>
        )}
        <LinearGradient colors={Gradients.primary} style={styles.priceBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={styles.priceText}>₹{item.price}</Text>
        </LinearGradient>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardCategory}>{item.category}</Text>
        
        {uid === item.userId ? (
          <TouchableOpacity 
            style={[styles.actionBtn, item.status === 'sold' && styles.actionBtnActive]}
            onPress={() => handleToggleStatus(item.id, item.status)}
          >
            <Ionicons name={item.status === 'sold' ? "refresh-outline" : "checkmark-circle-outline"} size={14} color={item.status === 'sold' ? Colors.textPrimary : Colors.success} />
            <Text style={[styles.actionText, item.status === 'sold' && { color: Colors.textPrimary }]}>
              {item.status === 'sold' ? 'Available' : 'Mark Sold'}
            </Text>
          </TouchableOpacity>
        ) : (
          uid !== item.userId && item.status !== 'sold' && (
            <TouchableOpacity 
              style={styles.msgBtn}
              onPress={() => startChat(item.userId, item.userEmail?.split('@')[0] || 'Seller', router)}
            >
              <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
              <Text style={styles.msgText}>Message Seller</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={['#1C1C3A', Colors.bg]} style={styles.hero}>
        <Text style={styles.heroTitle}>Student Market</Text>
        <Text style={styles.heroSub}>Buy and sell within your campus</Text>
      </LinearGradient>

      {loading
        ? <ActivityIndicator size="large" color={Colors.primary} style={{ flex: 1 }} />
        : <FlatList
            data={products}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="storefront-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No items listed yet</Text>
              </View>
            }
          />
      }

      <TouchableOpacity style={styles.fabWrapper} onPress={() => router.push('/post-market')}>
        <LinearGradient colors={Gradients.primary} style={styles.fab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
  list: { padding: 12, paddingBottom: 100 },
  row: { justifyContent: 'space-between' },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: 18, width: '48%',
    marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  cardSold: { opacity: 0.8, borderColor: Colors.success },
  imageBox: { position: 'relative' },
  image: { width: '100%', height: 130, resizeMode: 'cover' },
  imagePlaceholder: { width: '100%', height: 130, justifyContent: 'center', alignItems: 'center' },
  soldBadge: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
    zIndex: 1,
  },
  soldText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  priceBadge: {
    position: 'absolute', bottom: 8, right: 8,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, zIndex: 2,
  },
  priceText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  cardCategory: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgSurface, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border,
  },
  msgText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52,238,154,0.1)', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.success,
  },
  actionBtnActive: { backgroundColor: Colors.bgSurface, borderColor: Colors.border },
  actionText: { color: Colors.success, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: Colors.textMuted, fontSize: 16, marginTop: 12 },
  fabWrapper: { position: 'absolute', bottom: 24, right: 24 },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
});
