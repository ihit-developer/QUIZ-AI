import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, BrainCircuit, CirclePlus, Compass, LayoutDashboard, Settings2, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from './Navbar';

const appPaths = ['/dashboard', '/profile', '/create-quiz', '/edit-quiz', '/analytics', '/predictions', '/admin'];

const RailLink = ({ to, label, icon: Icon, active }) => (
  <Link to={to} className={`workspace-rail-link ${active ? 'is-active' : ''}`}>
    <Icon size={18} /><span>{label}</span>
  </Link>
);

export const MainLayout = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isWorkspace = Boolean(user) && appPaths.some((path) => location.pathname.startsWith(path));
  const isHost = user?.role === 'host' || user?.role === 'admin';

  if (isAuthPage) return <main className="auth-shell">{children}</main>;

  return (
    <div className={isWorkspace ? 'workspace-shell' : 'site-shell'}>
      {isWorkspace && (
        <aside className="workspace-rail">
          <Link to="/" className="workspace-brand" aria-label="Quizese home"><span className="workspace-brand-mark"><Sparkles size={18} /></span><span>quizese</span></Link>
          <p className="workspace-rail-label">Workspace</p>
          <nav className="workspace-rail-nav">
            <RailLink to="/dashboard" label="Overview" icon={LayoutDashboard} active={location.pathname === '/dashboard'} />
            {isHost ? <RailLink to="/create-quiz" label="Create quiz" icon={CirclePlus} active={location.pathname.startsWith('/create-quiz') || location.pathname.startsWith('/edit-quiz')} /> : <RailLink to="/join" label="Join a quiz" icon={Compass} active={location.pathname.startsWith('/join')} />}
            {isHost && <RailLink to="/analytics" label="Analytics" icon={BarChart3} active={location.pathname.startsWith('/analytics')} />}
            <RailLink to="/predictions" label="AI insights" icon={BrainCircuit} active={location.pathname.startsWith('/predictions')} />
            {user?.role === 'admin' && <RailLink to="/admin" label="Administration" icon={ShieldCheck} active={location.pathname.startsWith('/admin')} />}
          </nav>
          <div className="workspace-rail-bottom">
            <RailLink to="/profile" label="Profile & settings" icon={UserRound} active={location.pathname.startsWith('/profile')} />
            <span className="workspace-role"><Settings2 size={14} /> {user?.role}</span>
          </div>
        </aside>
      )}
      <div className="site-frame">
        <Navbar compact={isWorkspace} />
        <main className={isWorkspace ? 'workspace-main' : 'site-main'}>{children}</main>
        {!isWorkspace && <footer className="site-footer"><span>© {new Date().getFullYear()} Quizese</span><span>Thoughtful assessment, clearly delivered.</span></footer>}
      </div>
    </div>
  );
};
