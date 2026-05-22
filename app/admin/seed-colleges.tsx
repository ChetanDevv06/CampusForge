import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { SEED_COLLEGES, createCollege, searchColleges } from '../../utils/colleges';
import { db } from '../../firebaseConfig';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SeedCollegesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleSeed = async () => {
    setLoading(true);
    setResult('Checking existing colleges...');
    try {
      const existing = await getDocs(collection(db, 'colleges'));
      if (!existing.empty) {
        setResult(`Found ${existing.size} existing colleges. Skipping seed to prevent duplicates.`);
        setLoading(false);
        return;
      }

      setResult('Seeding initial colleges...');
      const batch = writeBatch(db);
      SEED_COLLEGES.forEach(c => {
        const ref = doc(collection(db, 'colleges'));
        batch.set(ref, {
          ...c,
          memberCount: 0,
          verified: true,
          createdAt: new Date(),
        });
      });
      await batch.commit();
      
      setResult('Successfully seeded colleges!');
    } catch (e: any) {
      setResult('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backBtn} 
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/admin');
          }
        }}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.on_background} />
      </TouchableOpacity>
      
      <Text style={styles.title}>Seed Initial Colleges</Text>
      <Text style={styles.desc}>This will populate the database with the default set of verified colleges for testing.</Text>

      <TouchableOpacity style={styles.btn} onPress={handleSeed} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Seed Database</Text>}
      </TouchableOpacity>

      {result ? <Text style={styles.result}>{result}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 24 },
  title: { ...Typography.display, fontSize: 28, color: Colors.on_background, marginBottom: 12 },
  desc: { ...Typography.body, color: Colors.on_surface_variant, marginBottom: 32 },
  btn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  result: { marginTop: 24, color: Colors.success, fontSize: 16 },
});
