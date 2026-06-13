import { useState, useEffect } from 'react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import QRStation from './components/QRStation';
import InitPassword from './components/InitPassword';
import PWAInstallButton from './components/PWAInstallButton';
import { User } from './types';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [initToken, setInitToken] = useState<string | null>(null);

  // Read URL Path for standalone independent /station/:id router
  const path = window.location.pathname;
  const isDirectStationPath = path.startsWith('/station/');
  const stationIdFromRoute = isDirectStationPath ? path.split('/').pop() : undefined;

  // Watch URL for password initialization tokens on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const token = params.get('token');
    if (action === 'init_password' && token) {
      setInitToken(token);
    }
  }, []);

  // Restore persistent token authenticated session
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok) {
          setUser(data.user);
        } else {
          // Token is stale or invalid, delete it
          localStorage.removeItem('auth_token');
        }
      } catch (err) {
        console.error("Session restoration error:", err);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleLogin = (token: string, loggedInUser: User) => {
    localStorage.setItem('auth_token', token);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  // Switch off station kiosk mode or direct pathways
  const handleExitKiosk = () => {
    localStorage.removeItem('kiosk_station');
    localStorage.removeItem('kiosk_token_access');
    setIsKioskMode(false);
    // If we accessed through direct route, clear url back to homepage
    if (isDirectStationPath) {
      window.history.pushState({}, '', '/');
      window.location.reload();
    }
  };

  // Render station path immediately in fullscreen mode
  if (isDirectStationPath && stationIdFromRoute) {
    return (
      <QRStation 
        stationIdFromRoute={stationIdFromRoute} 
        onExitKiosk={handleExitKiosk} 
      />
    );
  }

  // Render regular stateful kiosk activated from login code
  if (isKioskMode) {
    return (
      <QRStation 
        onExitKiosk={handleExitKiosk} 
      />
    );
  }

  // Render password initializor flow if active
  if (initToken) {
    return (
      <InitPassword 
        token={initToken} 
        onSuccess={() => {
          window.history.pushState({}, '', '/');
          setInitToken(null);
        }} 
      />
    );
  }

  if (loading) {
    return (
      <div id="app-loading-screen" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm font-sans font-medium">Chargement de votre session...</p>
      </div>
    );
  }

  return (
    <div id="app-wrapper">
      {!user ? (
        <Login 
          onLoginSuccess={handleLogin} 
          onEnterStationKiosk={() => setIsKioskMode(true)} 
        />
      ) : user.role === 'admin' ? (
        <AdminDashboard 
          user={user} 
          onLogout={handleLogout} 
          onUserUpdate={(updatedUser: User) => setUser(updatedUser)}
        />
      ) : (
        <EmployeeDashboard 
          user={user} 
          onLogout={handleLogout} 
          onUserUpdate={(updatedUser: User) => setUser(updatedUser)}
        />
      )}
      <PWAInstallButton />
    </div>
  );
}
