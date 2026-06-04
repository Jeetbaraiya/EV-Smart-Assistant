import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import ScrollToTop from './components/ScrollToTop';
import AIAssistant from './components/AIAssistant';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const RouteCheck = lazy(() => import('./pages/RouteCheck'));
const Stations = lazy(() => import('./pages/Stations'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminOwners = lazy(() => import('./pages/AdminOwners'));
const AdminStations = lazy(() => import('./pages/AdminStations'));
const AdminBookings = lazy(() => import('./pages/AdminBookings'));
const OwnerStations = lazy(() => import('./pages/OwnerStations'));
const OwnerBookings = lazy(() => import('./pages/OwnerBookings'));
const MultiStopPlanner = lazy(() => import('./pages/MultiStopPlanner'));
const Profile = lazy(() => import('./pages/Profile'));
const MyBookings = lazy(() => import('./pages/MyBookings'));

function AppLayout() {
  const { isAuthenticated, isAdmin, isOwner } = useAuth();
  const showSidebar = isAuthenticated && (isAdmin || isOwner);

  return (
    <div className={`App ${showSidebar ? 'with-sidebar' : ''} ${isAuthenticated ? 'authenticated' : ''}`}>
      <ScrollToTop />
      <Navbar />
      <main className="main-content">
        <Suspense fallback={<div className="loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', width: '100%' }}>Loading...</div>}>
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
            <Route
              path="/admin/bookings"
              element={
                <PrivateRoute requiredRole="admin">
                  <AdminBookings />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <AIAssistant />
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
