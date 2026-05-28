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
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: 'https://u.expo.dev/9de6c342-2054-4372-bca6-ae4e117e62e8',
  },
  android: {
    icon: './assets/icon.png',
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
      projectId: '9de6c342-2054-4372-bca6-ae4e117e62e8',
    },
  },
}

export default config
