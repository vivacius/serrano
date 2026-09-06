import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { UserRole } from '../types/lote';

interface AuthState {
  user:    User | null;
  role:    UserRole;
  loading: boolean;
}

async function fetchRole(userId: string): Promise<UserRole> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', userId)
      .single();
    if (data?.rol) {
      return data.rol as UserRole;
    }
    return 'admin';
  } catch {
    return 'admin';
  }
}

export function normalizeUserIdentifier(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  const clean = trimmed.replace(/[^a-z0-9._-]/g, '');
  return `${clean || 'user'}@amaranta.local`;
}

export function formatUserDisplay(emailOrUsername?: string | null): string {
  if (!emailOrUsername) return 'Usuario';
  return emailOrUsername.replace('@amaranta.local', '');
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null, role: 'comisionista', loading: true,
  });

  const reloadProfile = useCallback(async (userObj?: User | null) => {
    const u = userObj || state.user;
    if (u) {
      const role = await fetchRole(u.id);
      setState(prev => ({ ...prev, user: u, role, loading: false }));
    }
  }, [state.user]);

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        setState({ user: session.user, role, loading: false });
      } else {
        setState({ user: null, role: 'comisionista', loading: false });
      }
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const role = await fetchRole(session.user.id);
          setState({ user: session.user, role, loading: false });
        } else {
          setState({ user: null, role: 'comisionista', loading: false });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = (usernameOrEmail: string, password: string) => {
    const email = normalizeUserIdentifier(usernameOrEmail);
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (usernameOrEmail: string, password: string, nombre?: string) => {
    const email = normalizeUserIdentifier(usernameOrEmail);
    const displayName = nombre || formatUserDisplay(usernameOrEmail);
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
          username: formatUserDisplay(usernameOrEmail),
        },
      },
    });
    return res;
  };

  const signOut = () => supabase.auth.signOut();

  return { ...state, signIn, signUp, signOut, reloadProfile };
}

