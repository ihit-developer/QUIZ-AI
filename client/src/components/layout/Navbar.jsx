import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  Sparkles,
  LogOut,
  LayoutDashboard,
  PlusCircle,
  Menu,
  X,
  Shield,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'color-mix(in srgb, var(--surface) 90%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        padding: '0.85rem 1.5rem',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand Logo with 100% Red Identity */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontWeight: 900,
            fontSize: '1.45rem',
            letterSpacing: '-0.035em',
            color: 'var(--text)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary), var(--hero))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--on-primary)',
              boxShadow: 'var(--btn-shadow)',
              transition: 'transform 0.18s ease',
            }}
          >
            <Sparkles size={21} />
          </div>
          <span>
            Quiz<span style={{ color: 'var(--primary)' }}>ese</span>
          </span>
          <span
            className="badge badge-primary nav-brand-badge"
            style={{ fontSize: '0.65rem', padding: '0.18rem 0.55rem', marginLeft: '0.15rem' }}
          >
            AI Studio
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div
          style={{
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.92rem',
            fontWeight: 700,
          }}
          className="desktop-links"
        >
          {/* Hide Join Quiz for Hosts and Admins */}
          {(!user || (user.role !== 'host' && user.role !== 'admin')) && (
            <Link
              to="/join"
              style={{
                color: isActive('/join') ? 'var(--primary-text)' : 'var(--text-muted)',
                backgroundColor: isActive('/join') ? 'var(--primary-soft)' : 'transparent',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-btn)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.18s ease',
              }}
            >
              <Zap size={15} /> Join Quiz
            </Link>
          )}

          {user && (
            <Link
              to="/dashboard"
              style={{
                color: isActive('/dashboard') ? 'var(--primary-text)' : 'var(--text-muted)',
                backgroundColor: isActive('/dashboard') ? 'var(--primary-soft)' : 'transparent',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-btn)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.18s ease',
              }}
            >
              <LayoutDashboard size={15} /> Dashboard
            </Link>
          )}

          {user && (
            <Link
              to="/predictions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: isActive('/predictions') ? 'var(--primary-text)' : 'var(--text-muted)',
                backgroundColor: isActive('/predictions') ? 'var(--primary-soft)' : 'transparent',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-btn)',
                transition: 'all 0.18s ease',
              }}
            >
              <Sparkles size={15} /> AI Insights
            </Link>
          )}

          {user && user.role === 'admin' && (
            <Link
              to="/admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: isActive('/admin') ? 'var(--primary-text)' : 'var(--text-muted)',
                backgroundColor: isActive('/admin') ? 'var(--primary-soft)' : 'transparent',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-btn)',
                fontWeight: 700,
                transition: 'all 0.18s ease',
              }}
            >
              <Shield size={15} /> Admin
            </Link>
          )}

          {user && user.role === 'host' && (
            <Link
              to="/create-quiz"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                color: 'var(--on-primary)',
                background: 'linear-gradient(135deg, var(--primary), var(--hero))',
                padding: '0.5rem 1.05rem',
                borderRadius: 'var(--radius-btn)',
                fontWeight: 700,
                boxShadow: 'var(--btn-shadow)',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              }}
            >
              <PlusCircle size={16} /> Create Quiz
            </Link>
          )}
        </div>

        {/* Right Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Light / Dark / System Theme Toggle */}
          <ThemeToggle />

          {/* User Status / Login Buttons */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link
                to="/profile"
                className="nav-user-details"
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-btn)',
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                {user.avatar ? (
                    <img
                      key={user.avatar}
                      src={user.avatar}
                    alt={user.name}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1.5px solid var(--primary)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--on-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="nav-user-name" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                  {user.name}
                </span>
                <span className="badge badge-primary nav-user-role" style={{ textTransform: 'capitalize' }}>
                  {user.role}
                </span>
              </Link>
              <button
                type="button"
                onClick={logout}
                style={{
                  padding: '0.45rem',
                  borderRadius: 'var(--radius-btn)',
                  color: 'var(--text-muted)',
                }}
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Link to="/login" className="btn-secondary nav-auth-btn-text" style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', minHeight: '36px' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn-primary nav-auth-btn-text" style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', minHeight: '36px' }}>
                Register
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.45rem',
              borderRadius: 'var(--radius-btn)',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            className="mobile-menu-btn"
            aria-label="Toggle mobile navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              overflow: 'hidden',
              borderTop: '1px solid var(--border)',
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {(!user || (user.role !== 'host' && user.role !== 'admin')) && (
              <Link
                to="/join"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '0.6rem 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}
              >
                <Zap size={16} color="var(--primary)" /> Join Quiz
              </Link>
            )}
            {user && (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '0.6rem 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}
              >
                <LayoutDashboard size={16} /> Dashboard
              </Link>
            )}
            {user && (
              <Link
                to="/predictions"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '0.6rem 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}
              >
                <Sparkles size={16} color="var(--primary)" /> AI Insights
              </Link>
            )}
            {user && user.role === 'host' && (
              <Link
                to="/create-quiz"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: 'var(--primary-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <PlusCircle size={16} /> Create Quiz
              </Link>
            )}
            {user && user.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: 'var(--hero)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Shield size={16} /> Admin Panel
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
