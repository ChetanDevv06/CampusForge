import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList,
  TouchableOpacity, Image, StatusBar, SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { Colors, Gradients } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Find Lost Items',
    desc: 'Misplaced your keys or bottle? Report it instantly and let the campus help you find it.',
    icon: 'search',
    colors: Gradients.lostBadge,
  },
  {
    id: '2',
    title: 'Campus Market',
    desc: 'Buy and sell textbooks, electronics, and more directly within your student community.',
    icon: 'cart',
    colors: Gradients.primary,
  },
  {
    id: '3',
    title: 'Swap Skills',
    desc: 'Good at coding? Teach someone! Want to learn guitar? Find a tutor nearby.',
    icon: 'flash',
    colors: Gradients.skillOffer,
  },
  {
    id: '4',
    title: 'Safe & Verified',
    desc: 'All interactions are kept within your campus email domain for maximum security.',
    icon: 'shield-checkmark',
    colors: Gradients.foundBadge,
  },
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const handleFinish = async () => {
    try {
      if (user?.uid && user.uid !== 'guest-user-123') {
        await updateDoc(doc(db, 'users', user.uid), {
          hasSeenOnboarding: true
        });
      }
      router.replace('/(tabs)');
    } catch (e) {
      router.replace('/(tabs)');
    }
  };

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentSlide + 1 });
    } else {
      handleFinish();
    }
  };

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={styles.slide}>
      <LinearGradient colors={['rgba(28,28,58,0)', item.colors[0], 'rgba(10,10,18,0)']} style={styles.glow} />
      <View style={styles.iconContainer}>
        <LinearGradient colors={item.colors} style={styles.iconBox}>
          <Ionicons name={item.icon as any} size={64} color="#FFF" />
        </LinearGradient>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.desc}>{item.desc}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <TouchableOpacity style={styles.skip} onPress={handleFinish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          setCurrentSlide(Math.round(x / width));
        }}
        keyExtractor={item => item.id}
      />

      <View style={styles.footer}>
        {/* Pagination */}
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentSlide && styles.activeDot]} />
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity style={styles.btn} onPress={handleNext}>
          <LinearGradient colors={Gradients.primary} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.btnText}>
              {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  skip: { position: 'absolute', top: 60, right: 30, zIndex: 10 },
  skipText: { color: Colors.textMuted, fontSize: 16, fontWeight: '600' },
  slide: { width, height: height * 0.75, justifyContent: 'center', alignItems: 'center', padding: 40 },
  glow: { position: 'absolute', width: width * 1.5, height: width * 1.5, opacity: 0.15, borderRadius: width * 0.75 },
  iconContainer: { marginBottom: 60, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 15 },
  iconBox: { width: 160, height: 160, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, marginBottom: 20, textAlign: 'center' },
  desc: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26, paddingHorizontal: 10 },
  footer: { paddingHorizontal: 40, paddingBottom: 40 },
  pagination: { flexDirection: 'row', justifyContent: 'center', marginBottom: 40, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  activeDot: { width: 24, backgroundColor: Colors.primary },
  btn: { borderRadius: 16, overflow: 'hidden' },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
