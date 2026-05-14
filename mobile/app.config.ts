import type { ExpoConfig } from 'expo/config'

// Em produção (HTTPS), Android bloqueia cleartext automaticamente — defesa contra MITM.
// Em dev Expo Go aceita HTTP localhost sem config extra.
const config: ExpoConfig = {
  name: 'PF Bebidas',
  slug: 'appcontagem',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1a4731',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a4731',
    },
    package: 'com.pizzadofabio.bebidas',
  },
  ios: {
    bundleIdentifier: 'com.pizzadofabio.bebidas',
    supportsTablet: false,
  },
  plugins: ['expo-asset', 'expo-secure-store', 'expo-local-authentication'],
}

export default config
