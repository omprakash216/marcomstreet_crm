import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { setEmployee, getEmployee, normalizeRole, isSuperAdminRole } from '../utils/auth';

export default function ProtectedRoute({ children, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const response = await api.get('/auth/me');
        if (response.data?.success || response.data?.data?.employee) {
          const emp = response.data.data.employee;
          if (active) {
            setEmployee(emp); // sync with sessionStorage
            setUser(emp);
            setAuthenticated(true);
          }
        } else {
          if (active) {
            setAuthenticated(false);
          }
        }
      } catch (err) {
        if (active) {
          setAuthenticated(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-semibold text-gray-500">Checking session security...</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = normalizeRole(user.role);
    const isAllowed = allowedRoles.some((role) => normalizeRole(role) === userRole);
    if (!isAllowed) {
      // Forbidden page design
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <div className="mb-4 rounded-full bg-red-100 p-4 text-red-600">
            <i className="fas fa-exclamation-triangle text-3xl"></i>
          </div>
          <h1 className="text-2xl font-black text-gray-900">403 - Access Forbidden</h1>
          <p className="mt-2 text-sm text-gray-600">You do not have permission to access this portal.</p>
          <Navigate to="/login" replace />
        </div>
      );
    }
  }

  return children;
}
