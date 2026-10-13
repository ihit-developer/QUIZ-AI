import React from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';

export const MainLayout = ({ children }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)' }}>
      <Navbar />

      <main
        style={{
          flex: 1,
          padding: isAuthPage ? 0 : '2rem 1.5rem',
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {children}
      </main>

      {!isAuthPage && <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text)' }}>
            <span style={{ color: 'var(--primary)' }}>Quizese</span> Assessment Platform
          </div>
          <p style={{ maxWidth: '600px', fontSize: '0.8rem', lineHeight: 1.5 }}>
            Enterprise multiplayer examinations, real-time live rooms, and AI difficulty forecasting. Built with 100% Red Brand Identity & Day/Night Visibility.
          </p>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            &copy; {new Date().getFullYear()} Quizese Inc. All rights reserved.
          </div>
        </div>
      </footer>}
    </div>
  );
};
