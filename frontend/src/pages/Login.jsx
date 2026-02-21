import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { setEmployee } from '../utils/auth';
import MarcomLogo from '../components/MarcomLogo';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', formData);

      console.log('Login Response:', response.data);

      if (response.data && response.data.success) {
        const employee = response.data.data?.employee;
        const token = response.data.data?.token;

        if (!employee || !token) {
          setError('Invalid response format from server');
          console.error('Invalid response:', response.data);
          return;
        }

        console.log('Setting employee:', employee);
        console.log('Setting token:', token);

        setEmployee(employee, token);

        // Role-based redirect
        const role = employee.role || 'employee';
        console.log('Employee role:', role);

        if (role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (role === 'manager') {
          navigate('/manager', { replace: true });
        } else if (role === 'human_resources') {
          navigate('/hr', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(response.data?.message || 'Login failed');
      }
    } catch (err) {
      // Better error handling
      let errorMessage = 'Login failed';

      if (err.response) {
        // Server responded with error
        if (err.response.status === 404) {
          errorMessage = 'API endpoint not found. Please check: 1) Vite dev server is running 2) Backend API is accessible 3) Folder name matches (SALES-CRM-NEW)';
          console.error('404 Error Details:', {
            url: err.config?.url,
            baseURL: err.config?.baseURL,
            message: 'Check vite.config.js proxy settings'
          });
        } else if (err.response.status === 401) {
          errorMessage = err.response.data?.message || err.response.data?.debug || 'Invalid email or password';
        } else if (err.response.status === 500) {
          errorMessage = err.response.data?.message || 'Server error. Please check: 1) Database is running 2) Backend files are correct';
        } else {
          errorMessage = err.response.data?.message || err.response.data?.debug || `Login failed (${err.response.status})`;
        }
      } else if (err.request) {
        // Request made but no response
        errorMessage = 'Cannot connect to server. Please ensure: 1) Apache/XAMPP is running 2) Backend files are in correct location 3) Vite proxy is configured correctly';
        console.error('Network Error:', err.message);
      } else {
        // Something else happened
        errorMessage = 'Login failed: ' + (err.message || 'Unknown error');
        console.error('Login Error:', err);
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md border border-white/20 backdrop-blur-sm bg-white/90">
        <div className="flex justify-center mb-10">
          <MarcomLogo
            showSubtitle={false}
            showText={false}
            className="w-32 h-32 sm:w-40 sm:h-40"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your.email@crm.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* <div className="mt-6 text-sm text-gray-600 text-center">
          <p className="font-semibold mb-2">Login Credentials:</p>
          <div className="space-y-2 text-left bg-gray-50 p-3 rounded-lg">
            <div className="border-l-4 border-blue-600 pl-2">
              <p className="font-semibold text-blue-700">Admin:</p>
              <p><strong>Email:</strong> admin@marcomstreet.com</p>
              <p><strong>Password:</strong> admin123</p>
            </div>
            <div className="border-l-4 border-green-600 pl-2 mt-2">
              <p className="font-semibold text-green-700">Employee:</p>
              <p><strong>Email:</strong> sarah.sales@marcomstreet.com</p>
              <p><strong>Password:</strong> password123</p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}

