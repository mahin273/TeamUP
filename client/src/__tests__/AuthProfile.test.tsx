import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { ThemeProvider } from '../theme/ThemeContext';
import { AuthProvider } from '../context/AuthContext';

describe('Auth & Profile Screens', () => {
  const mockNavigation = { navigate: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('LoginScreen renders email/password inputs and handles validation error', () => {
    const { getByPlaceholderText, getByText } = render(
      <ThemeProvider>
        <AuthProvider>
          <LoginScreen navigation={mockNavigation} />
        </AuthProvider>
      </ThemeProvider>
    );

    const emailInput = getByPlaceholderText('student@university.edu');
    const passwordInput = getByPlaceholderText('••••••••');
    const signInButton = getByText('Sign In');

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();

    // Trigger validation error by clicking sign in with empty fields
    fireEvent.press(signInButton);
    expect(getByText(/Email address is required/i)).toBeTruthy();
  });

  it('RegisterScreen renders inputs and validates mismatched passwords', () => {
    const { getByPlaceholderText, getByText } = render(
      <ThemeProvider>
        <AuthProvider>
          <RegisterScreen navigation={mockNavigation} />
        </AuthProvider>
      </ThemeProvider>
    );

    const nameInput = getByPlaceholderText('Alex Morgan');
    const emailInput = getByPlaceholderText('student@university.edu');
    const passwordInput = getByPlaceholderText('At least 6 characters');
    const confirmInput = getByPlaceholderText('Repeat password');
    const registerButton = getByText('Register');

    fireEvent.changeText(nameInput, 'Alex Morgan');
    fireEvent.changeText(emailInput, 'alex@university.edu');
    fireEvent.changeText(passwordInput, '123456');
    fireEvent.changeText(confirmInput, '654321');

    fireEvent.press(registerButton);
    expect(getByText(/Passwords do not match/i)).toBeTruthy();
  });
});
