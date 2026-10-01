import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { RootNavigator } from './navigation/RootNavigator';

WebBrowser.maybeCompleteAuthSession();

const Main: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </SafeAreaProvider>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Main />
      </AuthProvider>
    </ThemeProvider>
  );
}
