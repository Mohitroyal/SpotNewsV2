import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.newscraft.mobile',
  appName: 'Spot News 24x7',
  webDir: 'dist',
  android: {
    overrideUserAgent: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '831106920430-h8h1nj7a5j2iirgki34ve8ariuj8uroi.apps.googleusercontent.com',
      androidClientId: '831106920430-hnth226r38sl53loflh2dfhh1156ld.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
      iconColor: "#015BB3",
    },
  },
  server: {
    androidScheme: 'https',
    hostname: 'www.fouziyapublications.com',
    cleartext: true
  }
};

export default config;
