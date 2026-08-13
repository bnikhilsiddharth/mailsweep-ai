'use client';
import { useState, useEffect, useCallback } from 'react';
import { getMe, logout as logoutApi } from '../api';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  createdAt: string;
  preferences: {
    protectedCategories: string[];
    protectedSenders: string[];
    notificationFrequency: string;
    theme: string;
  };
  stats: {
    totalEmailsAnalyzed: number;
    totalStorageSaved: number;
    cleanupCount: number;
    inboxHealthScore: number;
  };
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = async () => {
    try {
      await logoutApi();
      setUser(null);
      router.push('/');
    } catch {}
  };

  return { user, loading, logout, refetch: fetchUser };
};
