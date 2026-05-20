import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleMode: () => void;
  customColors: Record<string, string>;
  updateCustomColors: (colors: Record<string, string>) => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // Inicializar o tema a partir do localStorage, se existir
  const getInitialMode = (): ThemeMode => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
      if (savedMode === 'dark' || savedMode === 'light') return savedMode;
    }
    // fallback para dark
    return 'dark';
  };

  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  // Atualizar o tema apenas se mudar
  useEffect(() => {
    if (document.documentElement.className !== mode) {
      document.documentElement.className = mode;
    }
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  useEffect(() => {
    const savedColors = localStorage.getItem('custom-colors');
    if (savedColors) {
      setCustomColors(JSON.parse(savedColors));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('custom-colors', JSON.stringify(customColors));
    Object.entries(customColors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--color-${key}`, value);
    });
  }, [customColors]);

  const toggleMode = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const updateCustomColors = (colors: Record<string, string>) => {
    setCustomColors(prev => ({ ...prev, ...colors }));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, customColors, updateCustomColors }}>
      {children}
    </ThemeContext.Provider>
  );
};
