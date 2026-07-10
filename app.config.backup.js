import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from "buffer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default ({ config }) => {
  const G_SERVICES_BASE64 = process.env.G_SERVICES_BASE64;
  const filePath = path.join(__dirname, 'google-services.json');

  if (G_SERVICES_BASE64 && !fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, Buffer.from(G_SERVICES_BASE64, 'base64'));
      console.log('✅ google-services.json reconstructed successfully');
    } catch (e) {
      console.error('❌ Failed to reconstruct google-services.json:', e);
    }
  }

  const hasGoogleServices = fs.existsSync(filePath);

  return {
    ...config,
    plugins: Array.from(
      new Set([
        ...(config.plugins || []),
        'expo-font',
      ])
    ),
    android: {
      ...config.android,
      ...(hasGoogleServices
        ? { googleServicesFile: './google-services.json' }
        : {}),
    },
  };
};