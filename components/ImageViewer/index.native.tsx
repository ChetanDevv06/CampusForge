import React from 'react';
import ImageViewing from 'react-native-image-viewing';
import { View, StyleSheet } from 'react-native';

interface ImageViewerProps {
  images: { uri: string }[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
}

export default function ImageViewer({ images, imageIndex, visible, onRequestClose }: ImageViewerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <ImageViewing
        images={images}
        imageIndex={imageIndex}
        visible={visible}
        onRequestClose={onRequestClose}
        animationType="fade"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});