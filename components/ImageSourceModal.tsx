import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable, Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface ImageSourceModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (useCamera: boolean) => void;
}

export default function ImageSourceModal({ isVisible, onClose, onSelect }: ImageSourceModalProps) {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container}>
          <View style={styles.sheet}>
            {/* Header / Drag Indicator */}
            <View style={styles.indicator} />
            
            <View style={styles.content}>
              <Text style={styles.title}>Upload Image</Text>
              <Text style={styles.subtitle}>Choose a source for your photo</Text>

              <View style={styles.options}>
                <TouchableOpacity 
                  style={styles.optionBtn} 
                  onPress={() => { onSelect(true); onClose(); }}
                >
                  <LinearGradient 
                    colors={Gradients.primary} 
                    style={styles.iconBox}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="camera" size={24} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.optionLabel}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionBtn} 
                  onPress={() => { onSelect(false); onClose(); }}
                >
                  <View style={[styles.iconBox, { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border }]}>
                    <Ionicons name="images" size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.optionLabel}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  indicator: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  options: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  optionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
