import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../components/Button';
import { ThemeProvider } from '../theme/ThemeContext';

describe('Button Component', () => {
  it('renders title correctly and handles press event', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <ThemeProvider>
        <Button title="Click Me" onPress={onPressMock} />
      </ThemeProvider>
    );

    const buttonText = getByText('Click Me');
    expect(buttonText).toBeTruthy();

    fireEvent.press(buttonText);
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });
});
