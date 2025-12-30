import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoading: false,
  isInitialized: false
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,

    setAuth(user: User, accessToken: string) {
      update(state => ({ ...state, user, accessToken, isLoading: false, isInitialized: true }));
      if (browser) {
        localStorage.setItem('accessToken', accessToken);
      }
    },

    clearAuth() {
      set({ user: null, accessToken: null, isLoading: false, isInitialized: true });
      if (browser) {
        localStorage.removeItem('accessToken');
      }
    },

    setLoading(loading: boolean) {
      update(state => ({ ...state, isLoading: loading }));
    },

    setInitialized() {
      update(state => ({ ...state, isInitialized: true }));
    },

    getAccessToken(): string | null {
      return get({ subscribe }).accessToken;
    },

    getStoredToken(): string | null {
      if (browser) {
        return localStorage.getItem('accessToken');
      }
      return null;
    }
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, $auth => !!$auth.user);
export const isAdmin = derived(auth, $auth => $auth.user?.role === 'admin');
export const currentUser = derived(auth, $auth => $auth.user);
