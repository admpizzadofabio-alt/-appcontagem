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
  updates: {
    url: 'https://u.expo.dev/cd39d19e-0542-4f2b-bd1f-e5908571d51c',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a4731',
    },
    package: 'com.pizzadofabio.bebidas',
    runtimeVersion: { policy: 'appVersion' },
  },
  ios: {
    bundleIdentifier: 'com.pizzadofabio.bebidas',
    supportsTablet: false,
  },
  plugins: ['expo-asset', 'expo-secure-store', 'expo-local-authentication'],
  extra: {
    eas: {
      projectId: 'cd39d19e-0542-4f2b-bd1f-e5908571d51c',
    },
  },
}

export default config
