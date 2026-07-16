import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <main>
      <header className="app-header">
        <div className="header-logo">
          <NavLink to="/feed" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <Logo size={24} />
            <span className="logo-text">FocusFlow</span>
          </NavLink>
        </div>

        <nav className="header-nav">
          {[
            { to: '/profile', label: 'Profile' },
            { to: '/interests', label: 'Interests' },
            { to: '/feed', label: 'Signals' },
            { to: '/history', label: 'History' },
            { to: '/liked', label: 'Liked' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive || (to === '/feed' && location.pathname === '/') ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="user-profile">
          <span className="username">{user ? `@${user.discordUsername}` : ''}</span>
          <button onClick={logout} className="btn btn-sm">Log Out</button>
        </div>
      </header>

      <Outlet />

      <footer className="global-footer authenticated-footer">
        <div className="footer-content">
          Copyright 2026, developed by <a href="https://github.com/adchad90" target="_blank" className="footer-link" rel="noreferrer">aditya chavan</a>, all rights reserved.
        </div>
      </footer>
    </main>
  );
}
