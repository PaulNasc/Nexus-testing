import React, { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '@/lib/api';
import { preloadAllKeys, clearApiKeysCache, migrateLegacyKeys } from '@/services/apiKeysService';

interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  user_metadata?: {
    full_name?: string;
  };
}

interface AuthSession {
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    apiClient.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Migrar chaves legadas do localStorage (idempotente) e pre-carregar em memoria
          try { await migrateLegacyKeys(); } catch { /* noop */ }
          try { await preloadAllKeys(); } catch { /* noop */ }
        }
      })
      .catch((error) => {
        console.warn('Falha ao obter sessão local inicial:', error);
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = apiClient.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session?.user) {
        try { await migrateLegacyKeys(); } catch { /* noop */ }
        try { await preloadAllKeys(); } catch { /* noop */ }
      } else if (event === 'SIGNED_OUT') {
        clearApiKeysCache();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const { data, error } = await apiClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name || '',
          },
        },
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error in signUp:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await apiClient.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    await apiClient.auth.signOut();
  };

  const resetPassword = async (_email: string) => {
    return {
      error: {
        message:
          'Recuperação de senha por e-mail não está disponível no modo local. Acesse /reset-password estando logado para alterar sua senha.',
      },
    };
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
