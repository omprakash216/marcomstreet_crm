import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import MarcomLogo from '../components/MarcomLogo';
import AuthToast from '../components/AuthToast';

const STEPS = [
  { id: 1, label: 'Email' },
  { id: 2, label: 'OTP' },
  { id: 3, label: 'Password' },
  { id: 4, label: 'Done' },
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function extractOtpDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

export default function ForgotPasswordEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialEmail = useMemo(() => {
    const fromState = location.state?.email ? String(location.state.email) : '';
    const fromQuery = searchParams.get('email') || '';
    return normalizeEmail(fromState || fromQuery);
  }, [location.state, searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(location.state?.toast || null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    if (!location.state?.toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [location.state?.toast]);

  const showToast = (nextToast) => {
    setToast(nextToast);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = normalizeEmail(email);
      const res = await api.post('/auth/forgot-password/send-otp', { email: normalizedEmail });
      if (!res.data?.success) {
        setError(res.data?.message || 'Could not send OTP.');
        showToast({ type: 'error', title: 'OTP failed', message: res.data?.message || 'Could not send OTP.' });
        return;
      }

      const payload = res.data?.data || {};
      const debugOtp = extractOtpDigits(payload.debugOtp || res.data?.debugOtp || '');
      navigate('/forgot-password/verify', {
        replace: true,
        state: {
          email: normalizedEmail,
          otpExpiresAt: payload.expiresAt || null,
          resendAvailableAt: payload.resendAvailableAt || null,
          debugOtp,
          toast: {
            type: 'success',
            title: 'OTP sent',
            message: debugOtp
              ? `${res.data.message || 'If this email is registered, OTP has been sent.'} Preview OTP: ${debugOtp}`
              : res.data.message || 'If this email is registered, OTP has been sent.',
          },
        },
      });
    } catch (err) {
      const message = err.response?.data?.message || 'Could not send OTP.';
      setError(message);
      showToast({ type: 'error', title: 'Request failed', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] px-4 py-10 text-slate-900">
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
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Vanya Group Email OTP</h1>
                </div>
              </div>

              <div className="max-w-md space-y-5">
                <p className="text-base leading-7 text-slate-200">
                  Enter your registered email and we&apos;ll send a secure one-time password reset code to your inbox.
                  The flow continues with OTP verification, a temporary reset token, and a new password setup.
                </p>

                <div className="grid gap-3">
                  {STEPS.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                        step.id === 1
                          ? 'border-blue-400/40 bg-white/10 text-white shadow-lg shadow-blue-950/20'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          step.id === 1 ? 'bg-blue-400 text-slate-950' : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {step.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{step.label}</p>
                        <p className="text-xs text-slate-300/80">
                          {step.id === 1 && 'Start with the registered email address'}
                          {step.id === 2 && 'OTP box with expiry countdown and resend cooldown'}
                          {step.id === 3 && 'Strong password + confirm password validation'}
                          {step.id === 4 && 'Success state with quick return to login'}
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
                <p className="text-xs font-semibold uppercase tracking-[0.38em] text-slate-500">Step 1</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Enter your email</h2>
              </div>
              <div className="hidden rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 sm:block">
                Secure OTP
              </div>
            </div>

            <p className="mb-6 text-sm leading-6 text-slate-600">
              If the address is registered, we&apos;ll send a code in the format <span className="font-semibold text-slate-900">VG-482913</span>.
              You won&apos;t see whether an email exists or not.
            </p>

            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="admin@vanyagroup.com"
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                Back to login
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
