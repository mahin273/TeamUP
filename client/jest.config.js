module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@material/material-color-utilities|lucide-react-native)',
  ],
  setupFilesAfterEnv: [
    '@testing-library/react-native/extend-expect',
    '<rootDir>/__tests__/setup.ts',
  ],
  testTimeout: 15000,
  testMatch: [
    '**/__tests__/**/*.(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
};

