import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.newscraft.mobile',
  appName: 'Spot News 24x7',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '831106920430-h8h1nj7a5j2iirgki34ve8ariuj8uroi.apps.googleusercontent.com',
      androidClientId: '831106920430-hnth226r38sl53loflh2dfhh1156ld.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
  server: {
    androidScheme: 'https',
    hostname: 'news-frount.vercel.app',
    cleartext: true
  }
};

export default config;
