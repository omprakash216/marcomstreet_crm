import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Create separate API instance for company (without employee auth)
const companyApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for better error handling
companyApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 404) {
      console.error('❌ Company API Endpoint Not Found:', {
        url: error.config?.url,
        method: error.config?.method,
      });
    }
    return Promise.reject(error);
  }
);

export default function CompanyLogin() {
  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const validateForm = () => {
    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.password.trim()) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 3) {
      setError('Password must be at least 3 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate form
    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      console.log('📤 Sending company registration/login request...', formData);
      
      const response = await companyApi.post('/companies/login', formData);
      
      console.log('✅ Response received:', response.data);
      
      if (response.data.success && response.data.data) {
        // Store company data and token
        const companyData = response.data.data.company || response.data.data;
        const token = response.data.data.token || companyData.id;
        
        console.log('💾 Storing company data:', { companyData, token });
        
        localStorage.setItem('company', JSON.stringify(companyData));
        localStorage.setItem('company_token', String(token));
        
        // Verify storage
        const storedCompany = localStorage.getItem('company');
        const storedToken = localStorage.getItem('company_token');
        console.log('✅ Verification - Stored company:', storedCompany ? 'Yes' : 'No');
        console.log('✅ Verification - Stored token:', storedToken);
        
        setSuccess(response.data.message || 'Registration successful! Redirecting...');
        
        // Redirect immediately with proper navigation
        setTimeout(() => {
          console.log('🔄 Redirecting to company details...');
          // Use window.location for complete page reload to ensure proper state
          window.location.href = '/company/details';
        }, 800);
      } else {
        setError(response.data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('❌ Company login error:', err);
      
      if (err.response) {
        // Server responded with error
        const errorMessage = err.response.data?.message || 'Registration failed';
        setError(errorMessage);
        
        // Show more details in console for debugging
        console.error('Error details:', {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          url: err.config?.url,
        });
      } else if (err.request) {
        // Request was made but no response received
        setError('Cannot connect to server. Please check if XAMPP/Apache is running.');
        console.error('No response received:', err.request);
      } else {
        // Something else happened
        setError('An unexpected error occurred. Please try again.');
        console.error('Error:', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Company Login</h1>
        <p className="text-center text-gray-600 mb-8">New Company Registration</p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{success}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter company name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="company@example.com"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Phone *</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="+1234567890"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Password *</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Registering...
              </span>
            ) : (
              'Register & Login'
            )}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 text-center">
          <p>Already registered? <button onClick={() => navigate('/login')} className="text-green-600 hover:underline">Employee Login</button></p>
        </div>
      </div>
    </div>
  );
}

