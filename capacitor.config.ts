import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wesdsystems.app',
  appName: 'Wesd Systems',
  webDir: 'dist',
  android: {
    backgroundColor: '#0A0A0F',
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0A0A0F',
      showSpinner: false,
    },
  },
};

export default config;
