import fs from 'fs';
import path from 'path';

export default ({ config }) => {
  const G_SERVICES_BASE64 = process.env.G_SERVICES_BASE64;
  const filePath = path.join(__dirname, 'google-services.json');
  
  // Only attempt reconstruction if the secret is present (Cloud Build environment)
  // and the file doesn't already exist locally.
  if (G_SERVICES_BASE64 && !fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, Buffer.from(G_SERVICES_BASE64, 'base64'));
      console.log('✅ google-services.json reconstructed successfully via app.config.js');
    } catch (e) {
      console.error('❌ Failed to reconstruct google-services.json:', e);
    }
  }

  // Pre-calculate if we have the file
  const hasGoogleServices = fs.existsSync(filePath);

  return {
    ...config,
    android: {
      ...config.android,
      // Only include this key if the file is actually available
      ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {})
    }
  };
};
