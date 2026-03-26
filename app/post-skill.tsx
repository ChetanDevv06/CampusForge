import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '../constants/theme';

export default function PostSkillScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'offer' | 'request'>('offer');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handlePost = async () => {
    if (!title || !category || !description) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'skills'), {
        title, category, description, type,
        userId: user?.uid, userEmail: user?.email,
        userName: user?.email?.split('@')[0] || 'Student',
        createdAt: new Date().toISOString(),
      });
      Alert.alert('Posted!', `Skill ${type} published.`);
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>Post a Skill</Text>

      <View style={styles.typeRow}>
        {([
          { key: 'offer', label: '💡 I Can Teach', colors: Gradients.skillOffer },
          { key: 'request', label: '📚 I Want to Learn', colors: Gradients.skillRequest },
        ] as const).map(t => (
          <TouchableOpacity key={t.key} style={[styles.typeBtn, type === t.key && styles.typeBtnActive]} onPress={() => setType(t.key)}>
            {type === t.key
              ? <LinearGradient colors={t.colors} style={styles.typeBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.typeLabelActive}>{t.label}</Text>
                </LinearGradient>
              : <Text style={styles.typeLabel}>{t.label}</Text>
            }
          </TouchableOpacity>
        ))}
      </View>

      {[
        { icon: 'bulb-outline', label: 'Skill Title', value: title, set: setTitle, placeholder: 'e.g., Python Programming' },
        { icon: 'folder-outline', label: 'Category', value: category, set: setCategory, placeholder: 'e.g., Computer Science, Music' },
      ].map(f => (
        <View key={f.label} style={styles.fieldGroup}>
          <Text style={styles.label}>{f.label}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name={f.icon as any} size={18} color={Colors.textSecondary} />
            <TextInput style={styles.input} placeholder={f.placeholder} placeholderTextColor={Colors.textMuted} value={f.value} onChangeText={f.set} />
          </View>
        </View>
      ))}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Details & Expectations</Text>
        <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
          <TextInput
            style={styles.textArea} placeholder="What will you teach or what are you looking to learn?" placeholderTextColor={Colors.textMuted}
            value={description} onChangeText={setDescription} multiline numberOfLines={4}
          />
        </View>
      </View>

      <TouchableOpacity onPress={handlePost} disabled={loading}>
        <LinearGradient colors={type === 'offer' ? Gradients.skillOffer : Gradients.skillRequest} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Post {type === 'offer' ? 'Skill Offer' : 'Skill Request'}</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 24 },
  typeRow: { gap: 10, marginBottom: 24 },
  typeBtn: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  typeBtnActive: { borderColor: 'transparent' },
  typeBtnInner: { paddingVertical: 14, alignItems: 'center' },
  typeLabel: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14, paddingVertical: 14, textAlign: 'center' },
  typeLabelActive: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  fieldGroup: { marginBottom: 18 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingVertical: 14, marginLeft: 10 },
  textAreaWrapper: { alignItems: 'flex-start', paddingVertical: 14 },
  textArea: { flex: 1, color: Colors.textPrimary, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
