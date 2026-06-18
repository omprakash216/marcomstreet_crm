import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MarcomLogo from '../components/MarcomLogo';
import AuthToast from '../components/AuthToast';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

const STEPS = [
  { id: 1, label: 'Email' },
  { id: 2, label: 'OTP' },
  { id: 3, label: 'Password' },
  { id: 4, label: 'Done' },
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseTimestamp(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function extractOtpDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function formatCountdown(ms) {
  const remaining = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function VerifyEmailOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toastTimerRef = useRef(null);

  const initialEmail = useMemo(() => {
    const fromState = location.state?.email ? String(location.state.email) : '';
    const fromQuery = searchParams.get('email') || '';
    return normalizeEmail(fromState || fromQuery);
  }, [location.state?.email, searchParams]);

  const initialOtpExpiresAt = useMemo(() => {
    const fromState = parseTimestamp(location.state?.otpExpiresAt);
    const fromQuery = parseTimestamp(searchParams.get('expiresAt'));
    return fromState || fromQuery || Date.now() + OTP_EXPIRY_MS;
  }, [location.state?.otpExpiresAt, searchParams]);

  const initialDebugOtp = useMemo(() => {
    const fromState = extractOtpDigits(location.state?.debugOtp);
    const fromQuery = extractOtpDigits(searchParams.get('debugOtp'));
    return fromState || fromQuery || '';
  }, [location.state?.debugOtp, searchParams]);

  const initialResendAvailableAt = useMemo(() => {
    const fromState = parseTimestamp(location.state?.resendAvailableAt);
    const fromQuery = parseTimestamp(searchParams.get('resendAt'));
    return fromState || fromQuery || Date.now() + RESEND_COOLDOWN_MS;
  }, [location.state?.resendAvailableAt, searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(initialDebugOtp);
  const [debugOtp, setDebugOtp] = useState(initialDebugOtp);
  const [otpExpiresAt, setOtpExpiresAt] = useState(initialOtpExpiresAt);
  const [resendAvailableAt, setResendAvailableAt] = useState(initialResendAvailableAt);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(location.state?.toast || null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!location.state?.toast) return undefined;
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(toastTimerRef.current);
  }, [location.state?.toast]);

  const showToast = (nextToast) => {
    setToast(nextToast);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (!initialDebugOtp) return;
    setDebugOtp(initialDebugOtp);
    setOtp(initialDebugOtp);
  }, [initialDebugOtp]);

  const otpRemainingMs = Math.max(0, otpExpiresAt - now);
  const resendRemainingMs = Math.max(0, resendAvailableAt - now);
  const isOtpExpired = otpRemainingMs <= 0;
  const canResend = resendRemainingMs <= 0 && !resending;

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/forgot-password/verify-otp', {
        email,
        otp,
      });

      if (!res.data?.success) {
        const message = res.data?.message || 'OTP verification failed.';
        setError(message);
        showToast({ type: 'error', title: 'Verification failed', message });
        return;
      }

      const resetToken = res.data?.resetToken || res.data?.data?.resetToken;
      const resetTokenExpiresAt = res.data?.data?.resetTokenExpiresAt || null;
      navigate('/forgot-password/reset', {
        replace: true,
        state: {
          email,
          resetToken,
          resetTokenExpiresAt,
          toast: {
            type: 'success',
            title: 'OTP verified',
            message: res.data.message || 'OTP verified successfully.',
          },
        },
      });
    } catch (err) {
      const message = err.response?.data?.message || 'OTP verification failed.';
      setError(message);
      showToast({ type: 'error', title: 'Verification failed', message });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setError('');

    try {
      const res = await api.post('/auth/forgot-password/send-otp', { email });
      if (!res.data?.success) {
        const message = res.data?.message || 'Could not resend OTP.';
        setError(message);
        showToast({ type: 'error', title: 'Resend failed', message });
        return;
      }

      const payload = res.data?.data || {};
      const nextDebugOtp = extractOtpDigits(payload.debugOtp || res.data?.debugOtp || '');
      const nextExpiresAt = parseTimestamp(payload.expiresAt) || Date.now() + OTP_EXPIRY_MS;
      const nextResendAt = parseTimestamp(payload.resendAvailableAt) || Date.now() + RESEND_COOLDOWN_MS;
      if (nextDebugOtp) {
        setDebugOtp(nextDebugOtp);
        setOtp(nextDebugOtp);
      }
      setOtpExpiresAt(nextExpiresAt);
      setResendAvailableAt(nextResendAt);
      showToast({
        type: 'success',
        title: 'OTP resent',
        message: nextDebugOtp
          ? `${res.data.message || 'If this email is registered, OTP has been sent.'} Preview OTP: ${nextDebugOtp}`
          : res.data.message || 'If this email is registered, OTP has been sent.',
      });
    } catch (err) {
      const message = err.response?.data?.message || 'Could not resend OTP.';
      setError(message);
      showToast({ type: 'error', title: 'Resend failed', message });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.18),_transparent_28%),linear-gradient(180deg,#f7fbff_0%,#ecf3ff_100%)] px-4 py-10 text-slate-900">
      <AuthToast toast={toast} />

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_28px_100px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 px-6 py-8 text-white shadow-inner lg:px-8 lg:py-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,0.48),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.35),transparent_35%)]" />
            <div className="relative z-10">
              <div className="mb-10 flex items-center gap-4">
                <MarcomLogo className="h-14 w-14 rounded-2xl bg-white/10 p-2 ring-1 ring-white/15" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-blue-200/80">Password Reset</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Verify your OTP</h1>
                </div>
              </div>

              <div className="max-w-md space-y-5">
                <p className="text-base leading-7 text-slate-200">
                  A secure code was sent to your registered email. Verify it here to receive a temporary reset token
                  and continue to the password setup screen.
                </p>

                <div className="grid gap-3">
                  {STEPS.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                        step.id === 2
                          ? 'border-blue-400/40 bg-white/10 text-white shadow-lg shadow-blue-950/20'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          step.id === 2 ? 'bg-blue-400 text-slate-950' : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {step.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{step.label}</p>
                        <p className="text-xs text-slate-300/80">
                          {step.id === 1 && 'We already have your email'}
                          {step.id === 2 && 'OTP entry with expiry and resend cooldown'}
                          {step.id === 3 && 'Strong password and confirm password validation'}
                          {step.id === 4 && 'Final success state and back to login'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="relative rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.38em] text-slate-500">Step 2</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Enter OTP</h2>
              </div>
              <div className="hidden rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 sm:block">
                {formatCountdown(otpRemainingMs)}
              </div>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Email</p>
                <p className="mt-2 truncate text-sm font-semibold text-slate-900">{email}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Timer</p>
                <p className={`mt-2 text-sm font-semibold ${isOtpExpired ? 'text-rose-600' : 'text-slate-900'}`}>
                  {isOtpExpired ? 'OTP expired' : `OTP expires in ${formatCountdown(otpRemainingMs)}`}
                </p>
              </div>
            </div>

            {debugOtp ? (
              <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Local preview mode active. OTP:
                <span className="ml-2 font-bold tracking-[0.3em] text-sky-900">{debugOtp}</span>
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">OTP</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-lg font-semibold tracking-[0.4em] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Resend</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {canResend ? 'Ready to resend' : `Available in ${formatCountdown(resendRemainingMs)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!canResend}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resending ? 'Resending...' : 'Resend OTP'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || isOtpExpired}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/forgot-password', { replace: true, state: { email } })}
                className="w-full text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                Change email
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
