export default {
  expo: {
    name: 'Where is My Time',
    slug: 'whereismytime-mobile',
    version: '1.0.0',
    scheme: 'whereismytime-mobile',
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        // Read more about this at docs/build-issues/expo-54-ios-include-of-non-modular-header-inside-framework-module/README.md
        'expo-build-properties',
        {
          ios: {
            forceStaticLinking: ['RNFBApp', 'RNFBAuth', 'RNFBCrashlytics'],
            useFrameworks: 'static',
          },
        },
      ],
      'expo-router',
      'expo-web-browser',
      'expo-font',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#FFFFFF',
          image: './assets/whereismytime-logo.jpg',
          dark: {
            image: './assets/splash.png',
            backgroundColor: '#000000',
          },
          imageWidth: 200,
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/crashlytics',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
          },
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: 'com.googleusercontent.apps.771523609080',
        },
      ],
      'expo-sqlite',
    ],
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
    },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.fahimalizain.whereismytime',
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.fahimalizain.whereismytime',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    extra: {
      router: {},
      eas: {
        projectId: 'cc13d83a-3f22-4419-bb3b-ecfdcb8585bd',
      },
    },
  },
};
