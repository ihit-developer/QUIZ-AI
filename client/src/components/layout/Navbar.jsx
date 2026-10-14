import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Navbar = ({ compact = false }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = (path) => location.pathname === path;
  return (
    <header className={`topbar ${compact ? 'topbar-compact' : ''}`}>
      <div className="topbar-inner">
        <Link to="/" className="topbar-brand"><span className="topbar-mark"><Sparkles size={17} /></span><span>quizese</span></Link>
        {!compact && <nav className="topbar-links"><Link className={isActive('/') ? 'active' : ''} to="/">Home</Link><Link className={isActive('/join') ? 'active' : ''} to="/join">Join quiz</Link>{user && <Link className={isActive('/dashboard') ? 'active' : ''} to="/dashboard">Workspace</Link>}</nav>}
        <div className="topbar-actions">
          <ThemeToggle />
          {user ? <><Link to="/profile" className="topbar-profile">{user.avatar ? <img src={user.avatar} alt="" /> : <span>{user.name?.slice(0, 1).toUpperCase()}</span>}<em>{user.name}</em></Link><button className="topbar-logout" onClick={logout} aria-label="Log out"><LogOut size={17} /></button></> : <><Link className="topbar-signin" to="/login">Sign in</Link><Link className="btn-primary topbar-register" to="/register">Create account</Link></>}
          <button className="topbar-menu" onClick={() => setOpen(!open)} aria-label="Open navigation">{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      {open && <nav className="topbar-mobile"><Link to="/" onClick={() => setOpen(false)}>Home</Link><Link to="/join" onClick={() => setOpen(false)}>Join quiz</Link>{user ? <><Link to="/dashboard" onClick={() => setOpen(false)}>Workspace</Link><Link to="/profile" onClick={() => setOpen(false)}>Profile</Link></> : <><Link to="/login" onClick={() => setOpen(false)}>Sign in</Link><Link to="/register" onClick={() => setOpen(false)}>Create account</Link></>}</nav>}
    </header>
  );
};
