import { Link } from 'react-router-dom';
import MarcomLogo from '../components/MarcomLogo';
import heroImage from '../assets/landing-hero.png';
import '../styles/landing.css';

const crmFeatures = [
  { title: 'Sales Pipeline', description: 'Visualize every deal, prioritize follow-ups, and close faster from one dashboard.' },
  { title: 'Email Automation', description: 'Auto nurture leads with sequences that trigger on behavior and deal value.' },
  { title: 'Lead Tracking', description: 'Know who is engaged, what they viewed, and when to reach out next.' },
  { title: 'Revenue Analytics', description: 'Slice revenue by campaign, employee, or customer to spot momentum.' },
];

const hrmsFeatures = [
  { title: 'Employee Management', description: 'Centralize profiles, onboarding kits, and document signatures under one roof.' },
  { title: 'Attendance Tracking', description: 'Geo-fenced punch-in, late alerts, and attendance analytics for every team.' },
  { title: 'Payroll System', description: 'Automate payroll runs, approvals, and statutory reports with transparency.' },
  { title: 'Leave Management', description: 'Approve leave workflows, track balances, and sync with payroll instantly.' },
];

const partnerLogos = ['Slack', 'Gmail', 'WhatsApp', 'Zapier', 'API'];

const pricingPlans = [
  { id: 'starter', title: 'Starter', price: '₹999', info: '/ month', highlights: ['CRM', 'HRMS', 'API Access'] },
  { id: 'business', title: 'Business', price: '₹2499', info: '/ month', highlights: ['CRM', 'HRMS', 'API Access', 'Automation'] },
  { id: 'enterprise', title: 'Enterprise', price: 'Custom', info: 'Pricing', highlights: ['CRM', 'HRMS', 'API Access', 'Dedicated Success'] },
];

export default function LandingPage() {
  return (
    <div className="landing-root">
      <header className="landing-navbar">
        <div className="landing-navbar-inner">
          <div className="landing-logo">
            <div className="landing-logo-mark" aria-hidden="true">
              <MarcomLogo />
            </div>
            <span>MARCOM STREET</span>
          </div>

          <nav className="landing-nav" aria-label="Primary navigation">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Features
            </button>
            <Link to="/login" className="landing-nav-cta landing-nav-primary">
              Start Free Trial
            </Link>
            <button
              type="button"
              className="landing-nav-secondary"
              onClick={() => {
                const el = document.getElementById('features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Book a Demo
            </button>
            <Link to="/login" className="landing-nav-login">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <img className="landing-hero-bg" src={heroImage} alt="All-in-One CRM + HRMS hero" />
      </section>

      <div className="landing-sections">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-3 py-10 sm:px-6 lg:px-8 text-slate-900">
        <section id="features" className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Powerful CRM & HRMS features</p>
              <p className="text-2xl font-bold text-slate-900">Everything you need for revenue and people ops</p>
            </div>
            <div className="flex gap-4 text-sm text-slate-600">
              <Link to="/login" className="rounded-full border border-slate-200 px-4 py-2 font-semibold transition hover:border-slate-300">
                Go to Login
              </Link>
              <button className="rounded-full border border-transparent bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800">
                Explore features
              </button>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[{ title: 'CRM Features', data: crmFeatures }, { title: 'HRMS Features', data: hrmsFeatures }].map((group) => (
              <div key={group.title} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-xl font-semibold text-slate-900">{group.title}</h3>
                <div className="grid gap-4">
                  {group.data.map((feature) => (
                    <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">{feature.title}</p>
                      <p className="text-sm text-slate-600">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">See how it works</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            {partnerLogos.map((logo) => (
              <div key={logo} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1">{logo}</div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {['CRM Pipeline', 'Employee Directory', 'Attendance Calendar'].map((title) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 h-2 w-1/3 rounded-full bg-slate-400"></div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <div className="mt-3 h-28 rounded-2xl border border-slate-200 bg-white"></div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Flexible Pricing Plans</p>
          <div className="grid gap-6 md:grid-cols-3">
              {pricingPlans.map((plan) => (
              <div key={plan.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">{plan.title}</p>
                <p className="text-3xl font-bold text-slate-900">
                  {plan.price}
                  <span className="text-base font-semibold text-slate-600">{plan.info}</span>
                </p>
                <div className="space-y-2 text-sm text-slate-700">
                  {plan.highlights.map((highlight) => (
                    <p key={highlight} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                      {highlight}
                    </p>
                  ))}
                </div>
                <Link
                  to={`/subscribe?plan=${plan.id}`}
                  className="mt-auto rounded-2xl bg-slate-900 px-4 py-3 text-center text-base font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800"
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">*Custom plans and onboarding available for enterprise teams.</p>
        </section>
        </div>
      </div>
    </div>
  );
}
