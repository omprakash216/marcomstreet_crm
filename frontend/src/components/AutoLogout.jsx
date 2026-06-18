import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { clearAuth, isAuthenticated } from '../utils/auth';

export default function AutoLogout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const lastActivityRef = useRef(Date.now());
  const lastApiRefreshRef = useRef(Date.now());

  const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes in ms
  const API_REFRESH_THROTTLE = 2 * 60 * 1000; // 2 minutes in ms

  useEffect(() => {
    if (!isAuthenticated()) return;

    const handleActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;

      // Throttle backend activity refreshes
      if (now - lastApiRefreshRef.current > API_REFRESH_THROTTLE) {
        lastApiRefreshRef.current = now;
        api.post('/auth/refresh-activity').catch((err) => {
          console.warn('Failed to refresh backend activity:', err.message);
        });
      }
    };

    // Events to track user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Periodically check for inactivity
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > INACTIVITY_LIMIT) {
        clearInterval(interval);
        performAutoLogout();
      }
    }, 10000); // Check every 10 seconds

    async function performAutoLogout() {
      try {
        await api.post('/auth/logout');
      } catch (err) {
        console.error('Auto logout request failed:', err.message);
      } finally {
        clearAuth();
        sessionStorage.clear();
        navigate('/login', { replace: true });
        alert('You have been logged out due to inactivity.');
      }
    }

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
    };
  }, [location.pathname, navigate]);

  return children;
}
