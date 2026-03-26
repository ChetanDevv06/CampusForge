import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function PostSkillScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('offer'); // 'offer' or 'request'
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();

  const handlePost = async () => {
    if (!title || !category || !description) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'skills'), {
        title,
        category,
        description,
        type,
        userId: user?.uid,
        userEmail: user?.email,
        userName: user?.email?.split('@')[0] || 'Student', // Temporary username
        createdAt: new Date().toISOString(),
      });
      
      Alert.alert('Success', `Skill ${type} posted!`);
      router.back();
    } catch (error: any) {
      Alert.alert('Error posting skill', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.segmentedControl}>
        <TouchableOpacity 
          style={[styles.segmentButton, type === 'offer' && styles.segmentActiveOffer]}
          onPress={() => setType('offer')}
        >
          <Text style={[styles.segmentText, type === 'offer' && styles.segmentTextActive]}>I Can Teach</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.segmentButton, type === 'request' && styles.segmentActiveRequest]}
          onPress={() => setType('request')}
        >
          <Text style={[styles.segmentText, type === 'request' && styles.segmentTextActive]}>I Want to Learn</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Skill Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Python Programming"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Category</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Computer Science, Music, Languages"
          value={category}
          onChangeText={setCategory}
        />

        <Text style={styles.label}>Details & Expectations</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe what you'll teach, or what you're looking for..."
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity style={styles.submitButton} onPress={handlePost} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post Skill {type === 'offer' ? 'Offer' : 'Request'}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 24 },
  segmentButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  segmentActiveOffer: { backgroundColor: '#34C759' },
  segmentActiveRequest: { backgroundColor: '#FF9500' },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#666' },
  segmentTextActive: { color: '#fff' },
  form: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20 },
  textArea: { height: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
