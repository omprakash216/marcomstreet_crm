import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MarcomLogo from '../components/MarcomLogo';
import AuthToast from '../components/AuthToast';

const TOKEN_EXPIRY_MS = 10 * 60 * 1000;

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

function formatCountdown(ms) {
  const remaining = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function passwordChecks(password) {
  const value = String(password || '');
  return [
    { label: 'At least 8 characters', ok: value.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(value) },
    { label: 'One lowercase letter', ok: /[a-z]/.test(value) },
    { label: 'One number', ok: /\d/.test(value) },
    { label: 'One special character', ok: /[^A-Za-z0-9]/.test(value) },
  ];
}

export default function ResetPasswordEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toastTimerRef = useRef(null);

  const initialEmail = useMemo(() => {
    const fromState = location.state?.email ? String(location.state.email) : '';
    const fromQuery = searchParams.get('email') || '';
    return normalizeEmail(fromState || fromQuery);
  }, [location.state?.email, searchParams]);

  const initialResetToken = useMemo(() => {
    const fromState = location.state?.resetToken ? String(location.state.resetToken) : '';
    const fromQuery = searchParams.get('token') || '';
    return String(fromState || fromQuery).trim();
  }, [location.state?.resetToken, searchParams]);

  const initialTokenExpiresAt = useMemo(() => {
    const fromState = parseTimestamp(location.state?.resetTokenExpiresAt);
    const fromQuery = parseTimestamp(searchParams.get('tokenExpiresAt'));
    return fromState || fromQuery || Date.now() + TOKEN_EXPIRY_MS;
  }, [location.state?.resetTokenExpiresAt, searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [resetTokenExpiresAt, setResetTokenExpiresAt] = useState(initialTokenExpiresAt);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(location.state?.toast || null);
  const [completed, setCompleted] = useState(false);
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
    if (!email || !resetToken) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, resetToken, navigate]);

  const tokenRemainingMs = Math.max(0, resetTokenExpiresAt - now);
  const isTokenExpired = tokenRemainingMs <= 0;
  const checks = passwordChecks(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/forgot-password/reset', {
        email,
        resetToken,
        newPassword,
        confirmPassword,
      });

      if (!res.data?.success) {
        const message = res.data?.message || 'Unable to reset password.';
        setError(message);
        showToast({ type: 'error', title: 'Reset failed', message });
        return;
      }

      setCompleted(true);
      showToast({
        type: 'success',
        title: 'Password updated',
        message: res.data.message || 'Password reset successfully. Please login.',
      });
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to reset password.';
      setError(message);
      showToast({ type: 'error', title: 'Reset failed', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] px-4 py-10 text-slate-900">
      <AuthToast toast={toast} />

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_28px_100px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 px-6 py-8 text-white shadow-inner lg:px-8 lg:py-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.34),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.35),transparent_35%)]" />
            <div className="relative z-10">
              <div className="mb-10 flex items-center gap-4">
                <MarcomLogo className="h-14 w-14 rounded-2xl bg-white/10 p-2 ring-1 ring-white/15" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-emerald-200/80">Password Reset</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Set a new password</h1>
                </div>
              </div>

              <div className="max-w-md space-y-5">
                <p className="text-base leading-7 text-slate-200">
                  Your OTP has been verified. Choose a strong password and confirm it to finish the reset flow. The
                  temporary reset token expires quickly, so complete this step before the timer runs out.
                </p>

                <div className="grid gap-3">
                  {STEPS.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                        step.id === 3
                          ? 'border-emerald-400/40 bg-white/10 text-white shadow-lg shadow-emerald-950/20'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          step.id === 3 ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {step.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{step.label}</p>
                        <p className="text-xs text-slate-300/80">
                          {step.id === 1 && 'Email confirmed in the previous step'}
                          {step.id === 2 && 'OTP verified and reset token issued'}
                          {step.id === 3 && 'Strong password is being created now'}
                          {step.id === 4 && 'Login can continue immediately after save'}
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
                <p className="text-xs font-semibold uppercase tracking-[0.38em] text-slate-500">Step 3</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Create new password</h2>
              </div>
              <div className="hidden rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 sm:block">
                {formatCountdown(tokenRemainingMs)}
              </div>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Email</p>
                <p className="mt-2 truncate text-sm font-semibold text-slate-900">{email}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Reset token</p>
                <p className={`mt-2 text-sm font-semibold ${isTokenExpired ? 'text-rose-600' : 'text-slate-900'}`}>
                  {isTokenExpired ? 'Reset session expired' : `Expires in ${formatCountdown(tokenRemainingMs)}`}
                </p>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {completed ? (
              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-5 py-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-emerald-900">Password reset successfully</h3>
                      <p className="mt-2 text-sm leading-6 text-emerald-800">
                        Your account password has been updated. You can log in with the new password right away.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Back to login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">New password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      placeholder="Re-enter the same password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">Password rules</p>
                  <div className="mt-3 grid gap-2">
                    {checks.map((rule) => (
                      <div key={rule.label} className="flex items-center gap-3 text-sm">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                            rule.ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {rule.ok ? '✓' : '•'}
                        </span>
                        <span className={rule.ok ? 'text-emerald-700' : 'text-slate-600'}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || isTokenExpired}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Saving...' : 'Reset password'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  Back to login
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
