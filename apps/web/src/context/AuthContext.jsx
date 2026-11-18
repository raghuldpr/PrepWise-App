import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateUser: () => {},
});

const pickUser = (data) => ({
  id: data.id,
  name: data.name,
  email: data.email,
  role: data.role,
  onboardingCompleted: data.onboardingCompleted,
});

// Non-sensitive display info is cached so pages like AppLayout can read it synchronously.
const cacheUser = (u) => {
  try {
    localStorage.setItem('user', JSON.stringify(u));
  } catch {
    /* storage unavailable: fine */
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The httpOnly cookie is the source of truth: ask the server who we are.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/users/profile', { skipAuthRedirect: true })
      .then((res) => {
        if (cancelled) return;
        const u = pickUser(res.data);
        setUser(u);
        cacheUser(u);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        localStorage.removeItem('user');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = (data) => {
    const u = pickUser(data);
    setUser(u);
    cacheUser(u);
    return data;
  };

  const login = async (email, password) => startSession((await api.post('/auth/login', { email, password })).data);

  const register = async (name, email, password) =>
    startSession((await api.post('/auth/register', { name, email, password })).data);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* cookie may already be gone */
    }
    setUser(null);
    localStorage.removeItem('user');
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const next = { ...prev, ...updatedFields };
      cacheUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
