import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../src/screens/Auth/LoginScreen';
import * as api from '../src/api/auth';

jest.mock('../src/api/auth');

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('FE-02 shows an error on wrong credentials', async () => {
    (api.login as jest.Mock).mockRejectedValue({ response: { status: 401 } });
    const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText(/email|student@/i), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText(/password|••••/i), 'wrongpass');
    fireEvent.press(getByText('Sign In'));
    expect(await findByText(/invalid|incorrect|wrong/i)).toBeTruthy();
  });

  it('FE-02 double tap sends only one request', async () => {
    (api.login as jest.Mock).mockImplementation(
      () => new Promise((r) => setTimeout(() => r({}), 200)),
    );
    const { getByPlaceholderText, getByLabelText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText(/email|student@/i), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText(/password|••••/i), 'Str0ng!Pass123');
    const button = getByLabelText('Sign In');
    fireEvent.press(button);
    fireEvent.press(button);
    await waitFor(() => expect(api.login).toHaveBeenCalledTimes(1));
  });

  it('FE-01 does not submit with empty fields', () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Sign In'));
    expect(api.login).not.toHaveBeenCalled();
  });
});
