'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AppearancePreference = 'warm' | 'contrast' | 'dark';

type DisplayPreferencesValue = {
  appearance: AppearancePreference;
  setAppearance: (value: AppearancePreference) => void;
};

const STORAGE_KEY = 'gospelpad-web-appearance';

const DisplayPreferencesContext = createContext<DisplayPreferencesValue | undefined>(undefined);

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearancePreference>('warm');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'warm' || stored === 'contrast' || stored === 'dark') {
      setAppearanceState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.style.colorScheme = appearance === 'dark' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, appearance);
    }
  }, [appearance]);

  const value = useMemo(
    () => ({
      appearance,
      setAppearance: (next: AppearancePreference) => setAppearanceState(next),
    }),
    [appearance]
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences() {
  const context = useContext(DisplayPreferencesContext);
  if (!context) {
    throw new Error('useDisplayPreferences must be used inside DisplayPreferencesProvider');
  }
  return context;
}
