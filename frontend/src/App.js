import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RouteCheck from './pages/RouteCheck';
import Stations from './pages/Stations';
import Vehicles from './pages/Vehicles';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminOwners from './pages/AdminOwners';
import AdminStations from './pages/AdminStations';
import OwnerStations from './pages/OwnerStations';
import OwnerBookings from './pages/OwnerBookings';
import MultiStopPlanner from './pages/MultiStopPlanner';
import Profile from './pages/Profile';
import MyBookings from './pages/MyBookings';
import PrivateRoute from './components/PrivateRoute';
import './App.css';

function AppLayout() {
  const { isAuthenticated, isAdmin, isOwner } = useAuth();
  const showSidebar = isAuthenticated && (isAdmin || isOwner);

  return (
    <div className={`App ${showSidebar ? 'with-sidebar' : ''}`}>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/calculator/route-check" element={<PrivateRoute><RouteCheck /></PrivateRoute>} />
          <Route path="/calculator/multi-stop" element={<PrivateRoute><MultiStopPlanner /></PrivateRoute>} />
          <Route path="/stations" element={<PrivateRoute><Stations /></PrivateRoute>} />
          <Route path="/vehicles" element={<PrivateRoute><Vehicles /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/my-bookings" element={<PrivateRoute><MyBookings /></PrivateRoute>} />
          <Route
            path="/owner/dashboard"
            element={
              <PrivateRoute>
                <OwnerDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/my-stations"
            element={
              <PrivateRoute>
                <OwnerStations />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/bookings"
            element={
              <PrivateRoute>
                <OwnerBookings />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <PrivateRoute requiredRole="admin">
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <PrivateRoute requiredRole="admin">
                <AdminUsers />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/owners"
            element={
              <PrivateRoute requiredRole="admin">
                <AdminOwners />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/stations"
            element={
              <PrivateRoute requiredRole="admin">
                <AdminStations />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;
