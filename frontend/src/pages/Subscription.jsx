import { useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const plans = {
  starter: { name: 'Starter', price: '₹999 / month', features: ['CRM', 'HRMS', 'API Access'] },
  business: { name: 'Business', price: '₹2499 / month', features: ['CRM', 'HRMS', 'API Access', 'Automation'] },
  enterprise: { name: 'Enterprise', price: 'Custom Pricing', features: ['CRM', 'HRMS', 'API Access', 'Dedicated Success'] },
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Subscription() {
  const query = useQuery();
  const navigate = useNavigate();
  const planKey = query.get('plan') || 'starter';
  const plan = plans[planKey] ?? plans.starter;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const form = new FormData(e.currentTarget);
      const email = String(form.get('email') || '').trim();
      const fullName = String(form.get('fullName') || '').trim();
      const company = String(form.get('company') || '').trim();

      const resp = await api.post('/billing/checkout', { email, fullName, company, plan: planKey });
      const sessionId = resp.data?.data?.sessionId;
      if (!sessionId) throw new Error(resp.data?.message || 'Failed to create checkout session');

      navigate(`/pay?session=${encodeURIComponent(sessionId)}`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl bg-white border border-slate-200 shadow-2xl p-8 md:p-10 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Subscription</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Activate your {plan.name} plan</h1>
          <p className="text-sm text-slate-600">
            Enter your details to proceed to payment. After successful payment, your login will be activated.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-start">
          <form className="space-y-4" onSubmit={handleCheckout}>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Work Email</label>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@company.com"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Company</label>
                <input
                  type="text"
                  name="company"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Company name (optional)"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Payment Method</label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Next step will open the payment screen (UPI / Card / Netbanking).
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition disabled:opacity-60"
            >
              {submitting ? 'Creating checkout…' : 'Proceed to payment'}
            </button>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              After successful payment, your account will be activated for login using your email.
            </p>
          </form>

          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Selected Plan</p>
            <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
            <p className="text-sm font-semibold text-slate-700">{plan.price}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="pt-3 text-xs text-slate-500 border-t border-slate-200 mt-3">
              Need a different configuration?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300">
                Talk to our team after login
              </Link>
              .
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

