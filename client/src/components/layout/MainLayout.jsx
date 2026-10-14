import React from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sparkles, Shield, Heart } from 'lucide-react';

export const MainLayout = ({ children }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)' }}>
      <Navbar />

      <main
        style={{
          flex: 1,
          padding: isAuthPage ? 0 : '2.25rem 1.5rem',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {children}
      </main>

      {!isAuthPage && (
        <footer
          style={{
            borderTop: '1px solid var(--border)',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            backgroundColor: 'var(--surface)',
            boxShadow: '0 -4px 20px -2px rgba(159, 18, 57, 0.03)',
          }}
        >
          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 900, color: 'var(--text)', fontSize: '1.05rem' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--primary), var(--hero))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--on-primary)',
                }}
              >
                <Sparkles size={14} />
              </div>
              <span>Quiz<span style={{ color: 'var(--primary)' }}>ese</span></span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Assessment Platform</span>
            </div>
            <p style={{ maxWidth: '640px', fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
              Enterprise multiplayer examinations, real-time live rooms, and AI difficulty forecasting. Built with modern Emerald Green & Warm Cream SaaS aesthetics.
            </p>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              &copy; {new Date().getFullYear()} Quizese Inc. All rights reserved.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

