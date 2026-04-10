import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

// ── Clean SVG Icon Components ────────────────────────────────
const IconHome = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconBattery = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="10" x="2" y="7" rx="2" ry="2" />
    <line x1="22" x2="22" y1="11" y2="13" />
    <line x1="6" x2="6" y1="11" y2="13" />
    <line x1="10" x2="10" y1="11" y2="13" />
    <line x1="14" x2="14" y1="11" y2="13" />
  </svg>
);

const IconMap = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconStation = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
    <path d="M11 11h2" />
    <path d="M12 7v4" />
    <path d="M22 22v-4a2 2 0 0 0-2-2h-3" />
    <path d="M5 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v10" />
    <path d="M5 11H3" />
    <path d="M19 13V9a2 2 0 0 1 2-2h1" />
    <path d="m11 5 2 2" />
    <path d="m13 5-2 2" />
  </svg>
);

const IconOwner = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v2H17V8c0-.7.2-1.3.6-1.9L22 2" />
  </svg>
);

const IconAdmin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconLogout = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3H6a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h4M16 17l5-5-5-5M21 12H10" />
  </svg>
);

const IconLogin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 5 12 10 7" />
    <line x1="15" y1="12" x2="5" y2="12" />
  </svg>
);

const IconRegister = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const IconLightning = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const IconCar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

const IconEVUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);

const IconPlug = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7" />
    <path d="M9 3v4" />
    <path d="M15 3v4" />
    <line x1="8" y1="3" x2="16" y2="3" />
  </svg>
);

const IconDashboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="15" rx="1" />
  </svg>
);

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);


const Navbar = () => {
  const { isAuthenticated, user, logout, isOwner, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsRouteDropdownOpen(false);
  };

  // ── Admin or Owner: Left Sidebar ─────────────────────────────────────────────
  if (isAuthenticated && (isAdmin || isOwner)) {
    return (
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-logo">
            <div className="brand-icon">
              <span className="lightning"><IconLightning /></span>
            </div>
            <div className="brand-text">
              <span className="brand-primary">EV Smart</span>
              <span className="brand-secondary">Assistant</span>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {isAdmin && (
            <>
              <NavLink to="/admin/dashboard" className="sidebar-link" title="Platform Insights">
                <span className="nav-icon"><IconDashboard /></span>
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/admin/users" className="sidebar-link" title="User Directory">
                <span className="nav-icon"><IconUsers /></span>
                <span>User Directory</span>
              </NavLink>
              <NavLink to="/admin/owners" className="sidebar-link" title="Owners Management">
                <span className="nav-icon"><IconOwner /></span>
                <span>Owners</span>
              </NavLink>
              <NavLink to="/admin/stations" className="sidebar-link" title="Stations Management">
                <span className="nav-icon"><IconStation /></span>
                <span>Stations</span>
              </NavLink>
            </>
          )}

          {isOwner && (
            <>
              <NavLink to="/owner/dashboard" className="sidebar-link" title="Owner Dashboard">
                <span className="nav-icon"><IconDashboard /></span>
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/owner/my-stations" className="sidebar-link" title="My Stations Management">
                <span className="nav-icon"><IconStation /></span>
                <span>My Stations</span>
              </NavLink>
              <NavLink to="/owner/bookings" className="sidebar-link" title="View Station Reservations">
                <span className="nav-icon"><IconCalendar /></span>
                <span>Reservations</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <Link to="/profile" className="sidebar-user" title="View my profile">
            <span className="btn-icon" style={{ marginRight: '0.85rem', color: 'white' }}>
              {isAdmin && <IconAdmin />}
              {!isAdmin && !isOwner && <IconEVUser />}
              {isOwner && <IconOwner />}
            </span>
            <span className="username" style={{ color: 'white', textTransform: 'uppercase' }}>{user?.username?.toUpperCase()}</span>
          </Link>
          <button onClick={handleLogout} className="premium-logout-btn" title="Logout">
            <span className="btn-icon"><IconLogout /></span>
            <span>LOGOUT</span>
          </button>
        </div>
      </aside>
    );
  }

  // ── Regular Auth or Guest: Top Navbar ────────────────────────────────────────
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="nav-left">
          <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
            <div className="brand-icon">
              <span className="lightning"><IconLightning /></span>
            </div>
            <div className="brand-text">
              <span className="brand-primary">EV Smart</span>
              <span className="brand-secondary">Assistant</span>
            </div>
          </Link>
        </div>

        <button
          className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className={`navbar-menu ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="nav-center">
            <div className="nav-links">
              {isAuthenticated && (
                <>
                  <NavLink to="/" end className="nav-link" onClick={closeMobileMenu}>
                    <span className="nav-icon"><IconHome /></span>
                    Home
                  </NavLink>
                  <div
                    className="nav-dropdown"
                    onMouseEnter={() => !isMobileMenuOpen && setIsRouteDropdownOpen(true)}
                    onMouseLeave={() => !isMobileMenuOpen && setIsRouteDropdownOpen(false)}
                  >
                    <div
                      className={`nav-link dropdown-toggle ${isRouteDropdownOpen ? 'active' : ''}`}
                      onClick={() => isMobileMenuOpen && setIsRouteDropdownOpen(!isRouteDropdownOpen)}
                    >
                      <span className="nav-icon"><IconMap /></span>
                      Route
                      <span className={`dropdown-arrow ${isRouteDropdownOpen ? 'open' : ''}`}>▼</span>
                    </div>
                    <div className={`dropdown-menu ${isRouteDropdownOpen ? 'show' : ''}`}>
                      <NavLink to="/calculator/route-check" className="dropdown-item" onClick={closeMobileMenu}>
                        Route Feasibility
                      </NavLink>
                      <NavLink to="/calculator/multi-stop" className="dropdown-item" onClick={closeMobileMenu}>
                        Multi-Stop Planner
                      </NavLink>
                    </div>
                  </div>
                  <NavLink to="/stations" className="nav-link" onClick={closeMobileMenu}>
                    <span className="nav-icon"><IconStation /></span>
                    Stations
                  </NavLink>
                  <NavLink to="/vehicles" className="nav-link" onClick={closeMobileMenu}>
                    <span className="nav-icon"><IconCar /></span>
                    Vehicles
                  </NavLink>
                  <NavLink to="/my-bookings" className="nav-link" onClick={closeMobileMenu}>
                    <span className="nav-icon"><IconCalendar /></span>
                    My Bookings
                  </NavLink>
                </>
              )}
            </div>
          </div>

          <div className="nav-right">
            <div className="nav-auth">
              {isAuthenticated ? (
                <div className="nav-authenticated">
                  <Link to="/profile" className="nav-user-info" title="View Profile">
                    <span className="btn-icon" style={{ marginRight: '0.75rem', color: 'white' }}>
                      {isAdmin && <IconAdmin />}
                      {isOwner && <IconOwner />}
                      {!isAdmin && !isOwner && <IconEVUser />}
                    </span>
                    <span className="username">{user?.username?.toUpperCase()}</span>
                  </Link>
                  <button onClick={handleLogout} className="premium-logout-btn" title="Logout">
                    <span className="btn-icon"><IconLogout /></span>
                    <span>LOGOUT</span>
                  </button>
                </div>
              ) : (
                <div className="nav-guest">
                  <NavLink to="/" end className="nav-link home-guest-link" onClick={closeMobileMenu}>
                    <span className="nav-icon"><IconHome /></span>
                    HOME
                  </NavLink>
                  <NavLink to="/login" className="nav-link login-link" onClick={closeMobileMenu}>
                    <span className="nav-icon"><IconLogin /></span>
                    LOGIN
                  </NavLink>
                  <NavLink to="/register" className="nav-link nav-register-btn" onClick={closeMobileMenu}>
                    <span className="nav-icon"><IconRegister /></span>
                    REGISTER
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
