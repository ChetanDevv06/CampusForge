const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add react-native-image-viewing to transpileDependencies
config.resolver.transpileDependencies = [
  'react-native-image-viewing',
];

module.exports = config;