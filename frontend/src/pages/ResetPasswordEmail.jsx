import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MarcomLogo from '../components/MarcomLogo';

export default function ResetPasswordEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialEmail = useMemo(() => {
    const fromState = location.state?.email ? String(location.state.email) : '';
    const fromQuery = searchParams.get('email') || '';
    return (fromState || fromQuery).trim().toLowerCase();
  }, [location.state, searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/email/reset', {
        email,
        newPassword,
      });
      if (res.data?.success) {
        setMessage(res.data.message || 'Password reset successful.');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1200);
      } else {
        setError(res.data?.message || 'Unable to reset password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 w-full max-w-md border border-white/20 backdrop-blur-sm bg-white/90">
        <div className="flex justify-center mb-8">
          <MarcomLogo showSubtitle={false} showText={false} className="w-24 h-24 sm:w-32 sm:h-32" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Reset Password</h1>
        <p className="text-sm text-gray-600 mb-6">Set a strong password for your account.</p>

        {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{error}</div>}
        {message && !error && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-800 rounded text-sm">{message}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
              placeholder="At least 8 chars, Aa1!"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mb-2"
          >
            {loading ? 'Updating...' : 'Reset Password'}
          </button>

          <button type="button" onClick={() => navigate('/login')} className="w-full text-gray-600 py-2 text-sm">
            Back to login
          </button>
        </form>
      </div>
    </div>
  );
}
