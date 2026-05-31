import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import MarcomLogo from '../components/MarcomLogo';

export default function ForgotPasswordEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/forgot-password/email/request', { email });
      if (res.data?.success) {
        setMessage(res.data.message || 'If this email is registered, an OTP has been sent.');
        navigate('/forgot-password/verify', {
          replace: true,
          state: { email: email.trim().toLowerCase() },
        });
      } else {
        setError(res.data?.message || 'Could not send OTP.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 w-full max-w-md border border-white/20 backdrop-blur-sm bg-white/90">
        <div className="flex justify-center mb-8">
          <MarcomLogo showSubtitle={false} showText={false} className="w-28 h-28 sm:w-36 sm:h-36" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Forgot Password</h1>
        <p className="text-sm text-gray-600 mb-6">Enter your registered email to receive a 6-digit OTP.</p>

        {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{error}</div>}
        {message && !error && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-800 rounded text-sm">{message}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mb-2"
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>

          <button type="button" onClick={() => navigate('/login')} className="w-full text-gray-600 py-2 text-sm">
            Back to login
          </button>
        </form>
      </div>
    </div>
  );
}
