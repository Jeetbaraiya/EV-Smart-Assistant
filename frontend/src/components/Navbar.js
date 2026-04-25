import React, { useState, useEffect } from 'react';
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
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
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

  // Lock body scroll when mobile menu is open (prevents background page scrolling)
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

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

  const [isMobileRouteOpen, setIsMobileRouteOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── Admin or Owner: Left Sidebar + Mobile Top Nav ────────────────────────────
  if (isAuthenticated && (isAdmin || isOwner)) {
    return (
      <>
        {/* ── Mobile Top Navigation Bar (mobile only) ── */}
        <nav className="mobile-top-nav">
          <div className="mobile-top-nav-inner">
            {isAdmin && (
              <>
                <NavLink to="/admin/dashboard" className="mobile-top-link" onClick={() => setIsSidebarOpen(false)}>
                  <span className="mobile-top-icon"><IconDashboard /></span>
                  <span>Dashboard</span>
                </NavLink>
                <NavLink to="/admin/users" className="mobile-top-link" onClick={() => setIsSidebarOpen(false)}>
                  <span className="mobile-top-icon"><IconUsers /></span>
                  <span>Users</span>
                </NavLink>
                <NavLink to="/admin/owners" className="mobile-top-link" onClick={() => setIsSidebarOpen(false)}>
                  <span className="mobile-top-icon"><IconOwner /></span>
                  <span>Owners</span>
                </NavLink>
                <NavLink to="/admin/stations" className="mobile-top-link" onClick={() => setIsSidebarOpen(false)}>
                  <span className="mobile-top-icon"><IconStation /></span>
                  <span>Stations</span>
                </NavLink>
              </>
            )}
            {isOwner && (
              <>
                <NavLink to="/owner/dashboard" className="mobile-top-link" onClick={() => setIsSidebarOpen(false)}>
                  <span className="mobile-top-icon"><IconDashboard /></span>
                  <span>Dashboard</span>
                </NavLink>
                <NavLink to="/owner/my-stations" className="mobile-top-link" onClick={() => setIsSidebarOpen(false)}>
                  <span className="mobile-top-icon"><IconStation /></span>
                  <span>Stations</span>
                </NavLink>
                <NavLink to="/owner/bookings" className="mobile-top-link" onClick={() => setIsSidebarOpen(false)}>
                  <span className="mobile-top-icon"><IconCalendar /></span>
                  <span>Bookings</span>
                </NavLink>
              </>
            )}
            <Link to="/profile" className="mobile-top-link" title="Profile">
              <span className="mobile-top-icon">
                {isAdmin ? <IconAdmin /> : <IconOwner />}
              </span>
              <span>Profile</span>
            </Link>
            <button className="mobile-top-link mobile-top-logout" onClick={handleLogout}>
              <span className="mobile-top-icon"><IconLogout /></span>
              <span>Logout</span>
            </button>
          </div>
        </nav>

        {/* ── Desktop Sidebar Toggle Button ── */}
        <button 
          className={`sidebar-mobile-toggle ${isSidebarOpen ? 'active' : ''}`}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

        <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
          <div className="sidebar-logo">
            <div className="brand-icon">
              <span className="lightning"><IconLightning /></span>
            </div>
            <div className="brand-text">
              <span className="brand-primary">EV Smart</span>
              <span className="brand-secondary">Assistant</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdmin && (
            <>
              <NavLink to="/admin/dashboard" className="sidebar-link" title="Platform Insights" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon"><IconDashboard /></span>
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/admin/users" className="sidebar-link" title="User Directory" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon"><IconUsers /></span>
                <span>User Directory</span>
              </NavLink>
              <NavLink to="/admin/owners" className="sidebar-link" title="Owners Management" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon"><IconOwner /></span>
                <span>Owners</span>
              </NavLink>
              <NavLink to="/admin/stations" className="sidebar-link" title="Stations Management" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon"><IconStation /></span>
                <span>Stations</span>
              </NavLink>
            </>
          )}

          {isOwner && (
            <>
              <NavLink to="/owner/dashboard" className="sidebar-link" title="Owner Dashboard" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon"><IconDashboard /></span>
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/owner/my-stations" className="sidebar-link" title="My Stations Management" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon"><IconStation /></span>
                <span>My Stations</span>
              </NavLink>
              <NavLink to="/owner/bookings" className="sidebar-link" title="View Station Reservations" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon"><IconCalendar /></span>
                <span>Reservations</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <Link to="/profile" className="sidebar-user" title="View my profile" onClick={() => setIsSidebarOpen(false)}>
            <span className="btn-icon" style={{ marginRight: '0.85rem', color: 'white' }}>
              {isAdmin && <IconAdmin />}
              {!isAdmin && !isOwner && <IconEVUser />}
              {isOwner && <IconOwner />}
            </span>
            <span className="username" style={{ color: 'white', textTransform: 'uppercase' }}>{user?.username?.toUpperCase()}</span>
          </Link>
          <button onClick={() => { setIsSidebarOpen(false); handleLogout(); }} className="premium-logout-btn" title="Logout">
            <span className="btn-icon"><IconLogout /></span>
            <span>LOGOUT</span>
          </button>
        </div>
      </aside>
      </>
    );
  }

  // ── Regular Auth or Guest: Top Navbar ────────────────────────────────────────
  return (
    <>
      {/* ── Mobile Dropup for Route Options ── */}
      {isAuthenticated && isMobileRouteOpen && (
        <>
          <div className="mobile-dropup-overlay" onClick={() => setIsMobileRouteOpen(false)}></div>
          <div className="mobile-dropup">
            <div className="mobile-dropup-header">
              <div className="dropup-pill"></div>
              <h4>Route Planner</h4>
            </div>
            <div className="mobile-dropup-body">
              <NavLink to="/calculator/route-check" className="mobile-dropup-item" onClick={() => { setIsMobileRouteOpen(false); closeMobileMenu(); }}>
                <span className="dropup-icon">🗺️</span>
                <div className="dropup-text">
                  <span className="dropup-title">Route Feasibility</span>
                  <span className="dropup-desc">Check if you can reach a single destination</span>
                </div>
              </NavLink>
              <NavLink to="/calculator/multi-stop" className="mobile-dropup-item" onClick={() => { setIsMobileRouteOpen(false); closeMobileMenu(); }}>
                <span className="dropup-icon">📍</span>
                <div className="dropup-text">
                  <span className="dropup-title">Multi-Stop Planner</span>
                  <span className="dropup-desc">Plan a complex trip with multiple stops</span>
                </div>
              </NavLink>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile Top Nav (authenticated users only, hidden on desktop) ── */}
      {isAuthenticated && (
        <>
          <nav className="mobile-top-nav mobile-top-nav--user">
            <div className="mobile-top-nav-inner">
              <NavLink to="/" end className="mobile-top-link" onClick={closeMobileMenu}>
                <span className="mobile-top-icon"><IconHome /></span>
                <span>Home</span>
              </NavLink>
              <button 
                className={`mobile-top-link ${isMobileRouteOpen ? 'active' : ''}`} 
                onClick={() => setIsMobileRouteOpen(!isMobileRouteOpen)}
              >
                <span className="mobile-top-icon"><IconMap /></span>
                <span>Route</span>
              </button>
              <NavLink to="/stations" className="mobile-top-link" onClick={closeMobileMenu}>
                <span className="mobile-top-icon"><IconStation /></span>
                <span>Stations</span>
              </NavLink>
              <NavLink to="/vehicles" className="mobile-top-link" onClick={closeMobileMenu}>
                <span className="mobile-top-icon"><IconCar /></span>
                <span>Vehicles</span>
              </NavLink>
              <NavLink to="/my-bookings" className="mobile-top-link" onClick={closeMobileMenu}>
                <span className="mobile-top-icon"><IconCalendar /></span>
                <span>Bookings</span>
              </NavLink>
              <Link to="/profile" className="mobile-top-link" onClick={closeMobileMenu}>
                <span className="mobile-top-icon"><IconEVUser /></span>
                <span>{user?.username?.slice(0,6) || 'Profile'}</span>
              </Link>
            </div>
          </nav>

          {/* ── Floating Logout Button — top-right, mobile only ── */}
          <button className="mobile-fab-logout" onClick={() => { closeMobileMenu(); handleLogout(); }} aria-label="Logout">
            <IconLogout />
          </button>
        </>
      )}

      <nav className={`navbar${isAuthenticated ? ' navbar--hide-on-mobile' : ''}`}>
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

          {/* Mobile-only project name in the center gap */}
          <div className="mobile-navbar-title">
            <span className="mobile-navbar-title-primary">EV Smart</span>
            <span className="mobile-navbar-title-secondary"> Assistant</span>
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
                    <Link to="/profile" className="nav-user-info" title="View Profile" onClick={closeMobileMenu}>
                      <span className="btn-icon" style={{ marginRight: '0.75rem', color: 'white' }}>
                        {isAdmin && <IconAdmin />}
                        {isOwner && <IconOwner />}
                        {!isAdmin && !isOwner && <IconEVUser />}
                      </span>
                      <span className="username">{user?.username?.toUpperCase()}</span>
                    </Link>
                    <button onClick={() => { closeMobileMenu(); handleLogout(); }} className="premium-logout-btn" title="Logout">
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

                    {/* ── Section 1: App Features Highlight ── */}
                    <div className="menu-section-divider" />
                    <div className="menu-features">
                      <p className="menu-section-label">✨ What You Get</p>
                      <div className="menu-feature-item">
                        <span className="menu-feature-icon">⚡</span>
                        <div>
                          <span className="menu-feature-title">Smart Route Planning</span>
                          <span className="menu-feature-desc">Optimize every journey for your EV</span>
                        </div>
                      </div>
                      <div className="menu-feature-item">
                        <span className="menu-feature-icon">🔋</span>
                        <div>
                          <span className="menu-feature-title">Range Calculator</span>
                          <span className="menu-feature-desc">Know exactly how far you can go</span>
                        </div>
                      </div>
                      <div className="menu-feature-item">
                        <span className="menu-feature-icon">📍</span>
                        <div>
                          <span className="menu-feature-title">Find Charging Stations</span>
                          <span className="menu-feature-desc">45+ verified stations across India</span>
                        </div>
                      </div>
                    </div>

                    {/* ── Section 3: How It Works ── */}
                    <div className="menu-section-divider" />
                    <div className="menu-how-it-works">
                      <p className="menu-section-label">🗺️ How It Works</p>
                      <div className="menu-steps">
                        <div className="menu-step">
                          <span className="menu-step-num">1</span>
                          <span className="menu-step-text">Register your account</span>
                        </div>
                        <span className="menu-step-arrow">→</span>
                        <div className="menu-step">
                          <span className="menu-step-num">2</span>
                          <span className="menu-step-text">Add your vehicle</span>
                        </div>
                        <span className="menu-step-arrow">→</span>
                        <div className="menu-step">
                          <span className="menu-step-num">3</span>
                          <span className="menu-step-text">Plan your route</span>
                        </div>
                      </div>
                    </div>

                    {/* ── Section 6: App Promo Banner ── */}
                    <div className="menu-promo-banner">
                      <span className="menu-promo-emoji">🚗</span>
                      <div className="menu-promo-text">
                        <span className="menu-promo-title">Plan smarter. Drive farther.</span>
                        <span className="menu-promo-sub">EV Smart Assistant — Free to use!</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;

