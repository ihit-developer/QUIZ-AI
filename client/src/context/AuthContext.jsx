import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('quizese_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const token = localStorage.getItem('quizese_token');
      if (token) {
        try {
          const res = await authService.getMe();
          if (res.success && res.data.user) {
            setUser(res.data.user);
            localStorage.setItem('quizese_user', JSON.stringify(res.data.user));
          }
        } catch {
          // Token might be expired, clear state
          setUser(null);
          localStorage.removeItem('quizese_user');
          localStorage.removeItem('quizese_token');
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await authService.login({ email, password });
      if (res.success) {
        const { user: loggedInUser, accessToken } = res.data;
        setUser(loggedInUser);
        localStorage.setItem('quizese_token', accessToken);
        localStorage.setItem('quizese_user', JSON.stringify(loggedInUser));
        toast.success(`Welcome back, ${loggedInUser.name}!`);
        return { success: true, user: loggedInUser };
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Check your credentials.';
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  const register = async (userData) => {
    try {
      const res = await authService.register(userData);
      if (res.success) {
        if (res.data?.requiresVerification) return { success: true, requiresVerification: true, email: res.data.email };
        const { user: newUser, accessToken } = res.data;
        setUser(newUser);
        localStorage.setItem('quizese_token', accessToken);
        localStorage.setItem('quizese_user', JSON.stringify(newUser));
        toast.success(`Account created! Welcome, ${newUser.name}.`);
        return { success: true, user: newUser };
      }
    } catch (err) {
      let msg = err.response?.data?.message || 'Registration failed.';
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        msg = err.response.data.errors.map(e => e.message).join('. ');
      }
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  const completeEmailVerification = async (email, code) => {
    try {
      const res = await authService.verifyEmail({ email, code });
      if (res.success) {
        setUser(res.data.user);
        localStorage.setItem('quizese_token', res.data.accessToken);
        localStorage.setItem('quizese_user', JSON.stringify(res.data.user));
        toast.success('Email verified. Welcome to Quizese!');
        return { success: true };
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Verification failed.';
      toast.error(message); return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      localStorage.removeItem('quizese_token');
      localStorage.removeItem('quizese_user');
      toast.success('Logged out successfully');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser, completeEmailVerification }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
