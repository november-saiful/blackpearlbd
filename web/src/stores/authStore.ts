import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { Profile } from '../types';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isAdmin: false,
  isLoading: true,

  setUser: (user) => set({ user }),
  
  setProfile: (profile) => set({ 
    profile, 
    isAdmin: profile?.role === 'admin' 
  }),
  
  setLoading: (loading) => set({ isLoading: loading }),

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAdmin: false });
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        set({ user: session.user });
        
        try {
          const { profile } = await api.getProfile();
          set({ profile, isAdmin: profile.role === 'admin' });
        } catch {
          // Profile fetch failed — session may have just been created
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  const store = useAuthStore.getState();
  
  if (event === 'SIGNED_IN' && session?.user) {
    store.setUser(session.user);
    store.initialize();
  } else if (event === 'SIGNED_OUT') {
    store.setUser(null);
    store.setProfile(null);
  }
});
