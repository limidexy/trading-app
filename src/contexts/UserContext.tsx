import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface User {
  id: number;
  username: string;
}

interface UserProfile {
  username: string;
  avatar_url: string;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile;
  isLoading: boolean;
  setProfile: (profile: UserProfile) => void;
  refreshProfile: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const DEFAULT_PROFILE: UserProfile = {
  username: '交易员',
  avatar_url: '',
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const response = await apiFetch('/api/profile');
      const result = await response.json();
      if (result.success) {
        setProfile({
          username: result.profile?.username || DEFAULT_PROFILE.username,
          avatar_url: result.profile?.avatar_url || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await apiFetch('/api/me');
      const contentType = response.headers.get('content-type');

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`Auth check received non-JSON response (${response.status}):`, text.substring(0, 200));
        setUser(null);
        setProfile(DEFAULT_PROFILE);
        return false;
      }

      const result = await response.json();
      if (!response.ok || !result.success || !result.authenticated) {
        setUser(null);
        setProfile(DEFAULT_PROFILE);
        return false;
      }

      setUser(result.user);
      await refreshProfile();
      return true;
    } catch (error) {
      console.error('Failed to check auth:', error);
      setUser(null);
      setProfile(DEFAULT_PROFILE);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      setProfile(DEFAULT_PROFILE);
    }
  };

  useEffect(() => {
    void checkAuth();
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, isLoading, setProfile, refreshProfile, checkAuth, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
