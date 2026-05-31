import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { setEmployee, getDefaultPortalRoute } from '../utils/auth';
import MarcomLogo from '../components/MarcomLogo';

/** @typedef {'login' | 'forgot_phone' | 'forgot_otp' | 'forgot_new'} ForgotStep */

export default function Login({ portalType = 'default' }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const [forgotStep, setForgotStep] = useState('login');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [smsStatus, setSmsStatus] = useState({
    loaded: false,
    smsConfigured: false,
    otpPrefix: 'VG',
    message: '',
  });

  useEffect(() => {
    const prefill = location.state?.prefill;
    if (prefill?.email && prefill?.password) {
      setFormData({ email: prefill.email, password: prefill.password });
    }
  }, [location.state]);

  useEffect(() => {
    let active = true;
    const loadSmsStatus = async () => {
      try {
        const res = await api.get('/auth/forgot-password/sms-status');
        if (!active) return;
        const data = res.data?.data || {};
        setSmsStatus({
          loaded: true,
          smsConfigured: !!data.smsConfigured,
          otpPrefix: data.otpPrefix || 'VG',
          message: data.message || '',
        });
      } catch {
        if (!active) return;
        setSmsStatus((prev) => ({ ...prev, loaded: true }));
      }
    };
    loadSmsStatus();
    return () => {
      active = false;
    };
  }, []);

  const resetForgotFlow = () => {
    setForgotStep('login');
    setForgotPhone('');
    setForgotOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setForgotMessage('');
    setOtpVerified(false);
    setError('');
  };

  const otpPrefix = (smsStatus.otpPrefix || 'VG').toUpperCase().slice(0, 6);
  const portalLoginType = String(portalType || 'default').toLowerCase();
  const isMasterPortalLogin = portalLoginType === 'master';
  const isSetupPortalLogin = portalLoginType === 'setup';

  const applyDemoCredentials = (panel) => {
    if (panel === 'master') {
      setFormData({ email: 'master.admin@crm.com', password: 'Master@123' });
      if (!isMasterPortalLogin) navigate('/login/master');
      return;
    }
    if (panel === 'setup') {
      setFormData({ email: 'setup.admin@crm.com', password: 'Setup@123' });
      if (!isSetupPortalLogin) navigate('/login/setup');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const loginPayload = {
        ...formData,
        ...(isMasterPortalLogin || isSetupPortalLogin
          ? { portal: isMasterPortalLogin ? 'master' : 'setup' }
          : {}),
      };
      const response = await api.post('/auth/login', loginPayload);

      if (response.data && response.data.success) {
        const employee = response.data.data?.employee;
        const token = response.data.data?.token;

        if (!employee || !token) {
          setError('Invalid response format from server');
          return;
        }

        setEmployee(employee, token);
        const nextRoute = getDefaultPortalRoute(employee);
        navigate(nextRoute, { replace: true });
      } else {
        setError(response.data?.message || 'Login failed');
      }
    } catch (err) {
      let errorMessage = 'Login failed';

      if (err.response) {
        if (err.response.status === 404) {
          errorMessage =
            'API endpoint not found. Check: 1) Node backend is running 2) Vite proxy port matches backend port';
        } else if (err.response.status === 401) {
          errorMessage = err.response.data?.message || err.response.data?.debug || 'Invalid email or password';
        } else if (err.response.status === 500) {
          errorMessage = err.response.data?.message || 'Server error. Check Node backend logs.';
        } else {
          errorMessage =
            err.response.data?.message || err.response.data?.debug || `Login failed (${err.response.status})`;
        }
      } else if (err.request) {
        errorMessage =
          'Cannot connect to backend. Check: 1) Node backend is running 2) frontend/.env.local VITE_API_PORT matches backend PORT';
      } else {
        errorMessage = 'Login failed: ' + (err.message || 'Unknown error');
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setError('');
    setForgotMessage('');
    setOtpVerified(false);
    setResetToken('');
    try {
      const res = await api.post('/auth/forgot-password/request-otp', { phone: forgotPhone });
      if (res.data?.success) {
        setForgotMessage(
          res.data.message || 'OTP aapke mobile par bhej diya gaya hai. Phone par aaya code enter karein.'
        );
        setForgotOtp('');
        setForgotStep('forgot_otp');
      } else {
        setError(res.data?.message || 'OTP SMS par nahi bheja ja saka.');
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (err.response?.status === 429
            ? '1 minute wait karein, phir dubara try karein.'
            : err.response?.status === 404
              ? err.response.data?.message
              : err.response?.status === 502 || err.response?.status === 503
                ? err.response.data?.message
                : 'OTP bhejne mein error. Super Admin → System Settings → SMS OTP mein API key configure karein.')
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password/verify-otp', {
        phone: forgotPhone,
        otp: forgotOtp.length === 6 ? `${otpPrefix}${forgotOtp}` : forgotOtp,
      });
      if (res.data?.success && res.data.data?.resetToken && res.data.data?.otpVerified) {
        setResetToken(res.data.data.resetToken);
        setOtpVerified(true);
        setForgotStep('forgot_new');
        setForgotMessage('');
      } else {
        setError(res.data?.message || 'OTP galat hai ya expire ho gaya.');
        setOtpVerified(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verify nahi hua. Dubara try karein.');
      setOtpVerified(false);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otpVerified || !resetToken) {
      setError('Pehle mobile par aaya OTP verify karein.');
      setForgotStep('forgot_otp');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords match nahi kar rahe');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password kam se kam 8 characters hona chahiye');
      return;
    }
    setForgotLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password/reset', {
        resetToken,
        newPassword,
      });
      if (res.data?.success) {
        const msg = res.data.message || 'Password update ho gaya. Ab login karein.';
        resetForgotFlow();
        setForgotMessage(msg);
      } else {
        setError(res.data?.message || 'Password reset fail');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Password update nahi hua');
    } finally {
      setForgotLoading(false);
    }
  };

  const showForgot = forgotStep !== 'login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md border border-white/20 backdrop-blur-sm bg-white/90">
        <div className="flex justify-center mb-10">
          <MarcomLogo showSubtitle={false} showText={false} className="w-32 h-32 sm:w-40 sm:h-40" />
        </div>
        {(isMasterPortalLogin || isSetupPortalLogin) && (
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-3 text-center">
            <p className="text-[11px] uppercase tracking-widest text-blue-700 font-bold">
              {isMasterPortalLogin ? 'Master Panel Login' : 'Super Admin Setup Login'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {isMasterPortalLogin
                ? 'Use Master Panel specific user ID and password.'
                : 'Use Setup Panel specific user ID and password.'}
            </p>
          </div>
        )}
        {!isMasterPortalLogin && !isSetupPortalLogin && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate('/login/master')}
              className="px-3 py-2 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Master Panel Login
            </button>
            <button
              type="button"
              onClick={() => navigate('/login/setup')}
              className="px-3 py-2 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Super Admin Setup Login
            </button>
          </div>
        )}
        {!showForgot && (
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyDemoCredentials('master')}
              className="px-3 py-2 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Use Master Credentials
            </button>
            <button
              type="button"
              onClick={() => applyDemoCredentials('setup')}
              className="px-3 py-2 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Use Setup Credentials
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{error}</div>
        )}
        {forgotMessage && !error && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-800 rounded text-sm">
            {forgotMessage}
          </div>
        )}

        {!showForgot && (
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
                autoComplete="username"
              />
            </div>

            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <div className="mb-6 text-right">
              <button
                type="button"
                onClick={() => {
                  setForgotStep('forgot_phone');
                  setError('');
                  setForgotMessage('');
                  setOtpVerified(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="ml-3 text-sm text-indigo-600 hover:text-indigo-800 underline"
              >
                Email OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}

        {forgotStep === 'forgot_phone' && (
          <form onSubmit={handleRequestOtp}>
            <p className="text-sm text-gray-600 mb-4">
              Registered mobile number daalein. OTP <strong>SMS</strong> par jayega (format: {otpPrefix} + 6
              digits).
            </p>
            {smsStatus.loaded && !smsStatus.smsConfigured && (
              <p className="text-xs text-red-600 mb-3">
                SMS abhi configured nahi hai. Super Admin {'->'} System Settings {'->'} SMS OTP mein API key save karein.
              </p>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Mobile number</label>
              <input
                type="tel"
                required
                value={forgotPhone}
                onChange={(e) => setForgotPhone(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 8083866879"
                autoComplete="tel"
              />
            </div>
            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mb-2"
            >
              {forgotLoading ? 'Sending OTP...' : 'Send OTP on SMS'}
            </button>
            <button
              type="button"
              onClick={resetForgotFlow}
              className="w-full text-gray-600 py-2 text-sm hover:text-gray-900"
            >
              Back to login
            </button>
          </form>
        )}

        {forgotStep === 'forgot_otp' && (
          <form onSubmit={handleVerifyOtp}>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{forgotPhone}</strong> par SMS aaya hoga. Code enter karke verify karein — tabhi password reset
              khulega.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">OTP from SMS</label>
              <div className="flex">
                <span className="inline-flex items-center px-4 py-2 border border-r-0 rounded-l-lg bg-blue-50 text-blue-700 font-bold text-lg">
                  {otpPrefix}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 border rounded-r-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.35em] text-lg font-semibold"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={forgotLoading || forgotOtp.length !== 6}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mb-2"
            >
              {forgotLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotStep('forgot_phone');
                setForgotOtp('');
                setForgotMessage('');
              }}
              className="w-full text-gray-600 py-2 text-sm hover:text-gray-900"
            >
              Resend OTP / Change number
            </button>
          </form>
        )}

        {forgotStep === 'forgot_new' && otpVerified && resetToken && (
          <form onSubmit={handleResetPassword}>
            <p className="text-sm text-green-700 mb-4 font-medium">OTP verified. Ab naya password set karein.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="New password"
                autoComplete="new-password"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm password"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium mb-2"
            >
              {forgotLoading ? 'Saving...' : 'Update password'}
            </button>
            <button type="button" onClick={resetForgotFlow} className="w-full text-gray-600 py-2 text-sm">
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
