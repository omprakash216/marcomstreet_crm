import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MarcomLogo from '../components/MarcomLogo';

const RESEND_SECONDS = 30;

export default function VerifyEmailOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialEmail = useMemo(() => {
    const fromState = location.state?.email ? String(location.state.email) : '';
    const fromQuery = searchParams.get('email') || '';
    return (fromState || fromQuery).trim().toLowerCase();
  }, [location.state, searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/forgot-password/email/verify', {
        email,
        otp,
      });
      if (res.data?.success) {
        navigate('/forgot-password/reset', {
          replace: true,
          state: { email: email.trim().toLowerCase(), otpVerified: true },
        });
      } else {
        setError(res.data?.message || 'OTP verification failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/forgot-password/email/resend', { email });
      if (res.data?.success) {
        setMessage(res.data.message || 'If this email is registered, an OTP has been sent.');
        setCooldown(RESEND_SECONDS);
      } else {
        setError(res.data?.message || 'Could not resend OTP.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 w-full max-w-md border border-white/20 backdrop-blur-sm bg-white/90">
        <div className="flex justify-center mb-8">
          <MarcomLogo showSubtitle={false} showText={false} className="w-24 h-24 sm:w-32 sm:h-32" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Verify OTP</h1>
        <p className="text-sm text-gray-600 mb-6">Enter the 6-digit OTP sent to your registered email.</p>

        {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{error}</div>}
        {message && !error && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-800 rounded text-sm">{message}</div>
        )}

        <form onSubmit={handleVerify}>
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
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">OTP</label>
            <input
              type="text"
              required
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.35em] text-lg font-semibold text-center"
              placeholder="000000"
              autoComplete="one-time-code"
            />
          </div>

          <div className="mb-5 text-right">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              {resending ? 'Resending...' : cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mb-2"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <button type="button" onClick={() => navigate('/forgot-password')} className="w-full text-gray-600 py-2 text-sm">
            Back
          </button>
        </form>
      </div>
    </div>
  );
}
