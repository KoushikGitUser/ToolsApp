import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme } from './theme';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'appTheme';

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false); // Default to light mode

  useEffect(() => {
    // Load saved theme preference on app start
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'dark') {
        setIsDark(true);
      } else if (saved === 'light') {
        setIsDark(false);
      }
      // If no saved preference, keep default (light mode)
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
