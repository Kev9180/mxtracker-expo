const fs = require('fs')
const path = require('path')

const defaultGoogleServicesFile = path.resolve(__dirname, 'google-services.json')
const googleServicesFileFromEnv = process.env.GOOGLE_SERVICES_JSON
const resolvedGoogleServicesFile = googleServicesFileFromEnv || (
  fs.existsSync(defaultGoogleServicesFile) ? defaultGoogleServicesFile : undefined
)

module.exports = {
  expo: {
    scheme: 'mxtracker',
    name: 'MXTracker',
    slug: 'mxtracker-expo',
    version: '1.0.4',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.kev9180.mxtracker-expo',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.kev9180.mxtracker',
      ...(resolvedGoogleServicesFile ? { googleServicesFile: resolvedGoogleServicesFile } : {}),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      name: 'MXTracker',
    },
    plugins: [
      'expo-router',
      'expo-font',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#e3001b',
          sounds: [],
        },
      ],
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: 'react-native',
          organization: 'kevin-johnston',
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: '91f9bfd6-1623-4764-92b5-0535787c1538',
      },
    },
  },
}