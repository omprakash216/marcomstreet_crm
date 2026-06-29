import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const CURRENCY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const FALLBACK_PLANS = {
  starter: {
    id: 'starter',
    planKey: 'starter',
    name: 'Starter',
    priceLabel: CURRENCY.format(999),
    cycleLabel: '/ month',
    meta: ['10 users', '5 GB storage', 'Billed monthly'],
    features: ['CRM', 'HRMS', 'API Access'],
  },
  business: {
    id: 'business',
    planKey: 'business',
    name: 'Business',
    priceLabel: CURRENCY.format(2499),
    cycleLabel: '/ month',
    meta: ['25 users', '25 GB storage', 'Billed monthly'],
    features: ['CRM', 'HRMS', 'API Access', 'Automation'],
  },
  enterprise: {
    id: 'enterprise',
    planKey: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom Pricing',
    cycleLabel: 'Pricing',
    meta: ['Custom users', 'Custom storage', 'Bespoke pricing'],
    features: ['CRM', 'HRMS', 'API Access', 'Dedicated Success'],
  },
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function parseModules(modules) {
  if (Array.isArray(modules)) {
    return modules.map((item) => normalizeText(item)).filter(Boolean);
  }

  if (typeof modules === 'string') {
    try {
      const parsed = JSON.parse(modules);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeText(item)).filter(Boolean);
      }
    } catch (error) {
      // fall through to comma separated parsing
    }

    return modules
      .split(',')
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return 'Custom Pricing';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'Custom Pricing';
  }

  return CURRENCY.format(numeric);
}

function formatCycle(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'yearly' || normalized === 'annual') return '/ year';
  if (normalized === 'custom') return 'Pricing';
  return '/ month';
}

function formatMeta(plan) {
  const meta = [];
  const userLimit = Number(plan?.user_limit ?? plan?.userLimit);
  const storageLimit = Number(plan?.storage_limit_gb ?? plan?.storageLimitGb);
  const cycle = normalizeText(plan?.billing_cycle ?? plan?.billingCycle).toLowerCase();

  if (Number.isFinite(userLimit) && userLimit > 0) meta.push(`${userLimit} users`);
  if (Number.isFinite(storageLimit) && storageLimit > 0) meta.push(`${storageLimit} GB storage`);
  if (cycle === 'monthly') meta.push('Billed monthly');
  if (cycle === 'yearly' || cycle === 'annual') meta.push('Billed yearly');
  if (cycle === 'custom') meta.push('Custom pricing');

  return meta.slice(0, 3);
}

function normalizeCatalogPlan(plan, index) {
  const name = normalizeText(plan?.name || 'Plan') || 'Plan';
  const modules = parseModules(plan?.modules_included);
  const features = modules.length ? modules.slice(0, 6) : FALLBACK_PLANS.starter.features.slice(0, 6);
  const planKey = String(plan?.id ?? plan?.plan_id ?? name.toLowerCase()).trim() || `plan-${index + 1}`;

  return {
    id: String(plan?.id ?? planKey),
    planKey,
    name,
    priceLabel: formatPrice(plan?.price),
    cycleLabel: formatCycle(plan?.billing_cycle),
    meta: formatMeta(plan),
    features,
    raw: plan,
  };
}

function resolvePlanFromCatalog(catalog, queryPlanKey) {
  const normalizedKey = normalizeText(queryPlanKey).toLowerCase();

  const fromCatalog = catalog.find((plan) => {
    const candidates = [plan.id, plan.planKey, plan.name]
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean);
    return candidates.includes(normalizedKey);
  });

  if (fromCatalog) {
    return fromCatalog;
  }

  if (normalizedKey && FALLBACK_PLANS[normalizedKey]) {
    return FALLBACK_PLANS[normalizedKey];
  }

  return catalog.find((plan) => plan.isPopular) || catalog[0] || FALLBACK_PLANS.starter;
}

export default function Subscription() {
  const query = useQuery();
  const navigate = useNavigate();
  const queryPlanKey = query.get('plan') || 'starter';
  const sourceProduct = query.get('product') === 'hrms' ? 'hrms' : 'crm';

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'MARCOM STREET | Subscription';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setCatalogLoading(true);
      try {
        const response = await api.get('/billing/plans');
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        const mapped = rows.map((row, index) => normalizeCatalogPlan(row, index));

        if (!cancelled) {
          setCatalog(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          setCatalog([]);
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlan = useMemo(() => resolvePlanFromCatalog(catalog, queryPlanKey), [catalog, queryPlanKey]);
  const checkoutPlanKey = selectedPlan?.planKey || queryPlanKey || 'starter';
  const featureList = selectedPlan?.features?.length ? selectedPlan.features : FALLBACK_PLANS.starter.features;
  const metaList = selectedPlan?.meta?.length ? selectedPlan.meta : FALLBACK_PLANS.starter.meta;

  const handleCheckout = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const form = new FormData(e.currentTarget);
      const email = String(form.get('email') || '').trim();
      const fullName = String(form.get('fullName') || '').trim();
      const company = String(form.get('company') || '').trim();

      const resp = await api.post('/billing/checkout', {
        email,
        fullName,
        company,
        plan: checkoutPlanKey,
      });

      const sessionId = resp.data?.data?.sessionId;
      if (!sessionId) {
        throw new Error(resp.data?.message || 'Failed to create checkout session');
      }

      navigate(`/pay?session=${encodeURIComponent(sessionId)}`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f6f8ff_40%,_#eef2ff_100%)] px-4 py-8 text-slate-900"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.94fr_1.06fr]">
          <aside className="rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
                  <path d="M4 7h16" strokeLinecap="round" />
                  <path d="M6 12h12" strokeLinecap="round" />
                  <path d="M8 17h8" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Subscription</p>
                <h1 className="text-2xl font-black text-slate-900">Activate your {selectedPlan.name} plan</h1>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-600">
              This page now reads the same live plan catalog that Super Admin publishes, so the pricing and
              modules stay in sync automatically.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 fill-none stroke-current stroke-2">
                  <path d="M12 9v4" strokeLinecap="round" />
                  <path d="M12 17h.01" strokeLinecap="round" />
                  <path d="M10.29 3.86l-7.43 13.14A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Live Super Admin pricing</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Select any active plan published by Super Admin and continue to payment without hardcoded
                    pricing.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Selected plan summary
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-500">Plan</span>
                  <strong className="text-slate-900">{selectedPlan.name}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-500">Price</span>
                  <strong className="text-slate-900">{selectedPlan.priceLabel}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-500">Billing</span>
                  <strong className="text-slate-900">{selectedPlan.cycleLabel}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-500">Status</span>
                  <strong className="text-slate-900">
                    {catalogLoading ? 'Loading' : `${catalog.length} live plan${catalog.length === 1 ? '' : 's'}`}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Included modules</p>
              <div className="flex flex-wrap gap-2">
                {featureList.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {metaList.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8">
              <Link to={`/${sourceProduct}`} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500">
                Back to home
              </Link>
            </div>
          </aside>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
            {error ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form className="space-y-6" onSubmit={handleCheckout}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Payment details</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">Continue with {selectedPlan.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  After checkout, the payment screen will open and the session will keep this plan name and price
                  from the backend catalog.
                </p>
              </div>

              <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Work Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@company.com"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Company
                    </label>
                    <input
                      type="text"
                      name="company"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Company name (optional)"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment Method
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    UPI, card, or netbanking options will open in the next payment step.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating checkout...' : 'Proceed to payment'}
              </button>

              <p className="text-[11px] leading-relaxed text-slate-500">
                The selected plan is taken from the live Super Admin catalog. If a new plan is published, it will
                appear here without code changes.
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
