import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface ImageViewerProps {
  images: Array<{ uri: string }>;
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
}

export default function ImageViewer({ images, imageIndex, visible, onRequestClose }: ImageViewerProps) {
  if (!visible || images.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(imageIndex);
  const [scale, setScale] = useState(new Animated.Value(1));
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    setCurrentIndex(imageIndex);
  }, [imageIndex]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (direction === 'right' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handlePanResponder = () => {
    // Swipe gestures handled by touchable opacity on web
  };

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onRequestClose}
        activeOpacity={1}
      />
      
      <View style={styles.viewerContainer}>
        <BlurView intensity={30} tint="dark" style={styles.blurBackground} />
        
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onRequestClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          {images.map((img, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.imageWrapper,
                {
                  transform: [
                    { translateX: (screenWidth * -currentIndex) + (screenWidth * idx) },
                    { scale },
                  ],
                },
              ]}
            >
              <Image source={{ uri: img.uri }} style={styles.image} resizeMode="contain" />
            </Animated.View>
          ))}
        </View>

        {images.length > 1 && (
          <>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => handleSwipe('right')}
              disabled={currentIndex === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={36} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navBtnRight}
              onPress={() => handleSwipe('left')}
              disabled={currentIndex === images.length - 1}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={36} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  viewerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 50,
    right: 20,
    zIndex: 10,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
      default: { elevation: 8 },
    }),
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 8,
  },
  navBtn: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
});