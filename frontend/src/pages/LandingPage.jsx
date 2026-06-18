import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiArrowRight,
  FiAward,
  FiBarChart2,
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiFile,
  FiFileText,
  FiFolder,
  FiGrid,
  FiHeadphones,
  FiLayers,
  FiMail,
  FiMenu,
  FiPieChart,
  FiShield,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import MarcomLogo from '../components/MarcomLogo';
import api from '../utils/api';
import '../styles/landing.css';

const CURRENCY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function makeSlug(value, fallback = 'plan') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
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
      // fall through to comma-separated parsing
    }

    return modules
      .split(',')
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
}

function inferPlanType(plan) {
  const explicit = normalizeText(plan?.plan_type || plan?.type || plan?.planType).toLowerCase();
  if (explicit.includes('all')) return 'all-in-one';
  if (explicit.includes('crm')) return 'crm';
  if (explicit.includes('hrms') || explicit.includes('hr')) return 'hrms';

  const modules = parseModules(plan?.modules_included).join(' ').toLowerCase();
  const crmHints = ['crm', 'lead', 'pipeline', 'quotation', 'invoice', 'payment', 'customer', 'follow', 'whatsapp', 'report'];
  const hrmsHints = ['hrms', 'employee', 'attendance', 'leave', 'payroll', 'salary', 'department', 'designation', 'document', 'posh', 'onboarding'];
  const hasCrm = crmHints.some((hint) => modules.includes(hint));
  const hasHrms = hrmsHints.some((hint) => modules.includes(hint));

  if (hasCrm && hasHrms) return 'all-in-one';
  if (hasHrms) return 'hrms';
  if (hasCrm) return 'crm';
  return 'all-in-one';
}

function planVisibleForProduct(plan, product) {
  const planType = inferPlanType(plan);
  return planType === 'all-in-one' || planType === product;
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return 'Custom';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'Custom';
  }

  return CURRENCY.format(numeric);
}

function formatCycle(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'yearly' || normalized === 'annual') return '/ year';
  if (normalized === 'custom') return 'Pricing';
  return '/ month';
}

function resolveCheckoutKey(plan, index = 0) {
  const explicit = normalizeText(plan?.checkout_key || plan?.checkoutKey || plan?.slug || '').toLowerCase();
  if (['starter', 'business', 'enterprise'].includes(explicit)) {
    return explicit;
  }

  const title = normalizeText(plan?.name || plan?.title).toLowerCase();
  if (title.includes('enterprise') || title.includes('custom')) return 'enterprise';
  if (title.includes('business') || title.includes('growth') || title.includes('pro')) return 'business';
  if (title.includes('starter') || title.includes('basic') || title.includes('beginner')) return 'starter';

  if (plan?.price === null || plan?.price === undefined || plan?.price === '') {
    return 'enterprise';
  }

  if (index === 1) return 'business';
  if (index >= 2) return 'enterprise';
  return 'starter';
}

function formatModuleHighlights(plan, product, index) {
  const modules = parseModules(plan?.modules_included);
  if (modules.length) {
    return modules.slice(0, 4);
  }

  const fallbackHighlights = {
    crm: [
      ['Lead Management', 'Sales Pipeline', 'Email Automation', 'Reports'],
      ['Quotation Management', 'Invoice Management', 'WhatsApp Integration', 'Team Performance'],
      ['Advanced Analytics', 'Custom Integrations', 'Dedicated Support', 'Security Controls'],
    ],
    hrms: [
      ['Employee Management', 'Attendance Tracking', 'Leave Management', 'Documents'],
      ['Payroll System', 'Salary Slips', 'Department Setup', 'Reports'],
      ['POSH Module', 'Self Service Portal', 'Advanced Analytics', 'Dedicated Support'],
    ],
  };

  const items = fallbackHighlights[product] || fallbackHighlights.crm;
  return items[Math.min(index, items.length - 1)];
}

function normalizePlan(plan, index, product) {
  return {
    id: makeSlug(plan?.id ?? plan?.name ?? `plan-${product}-${index}`),
    title: normalizeText(plan?.name || 'Plan') || 'Plan',
    planType: inferPlanType(plan),
    typeLabel: inferPlanType(plan) === 'all-in-one' ? 'All-in-One' : inferPlanType(plan).toUpperCase(),
    priceLabel: formatPrice(plan?.price),
    cycleLabel: formatCycle(plan?.billing_cycle),
    checkoutKey: resolveCheckoutKey(plan, index),
    isPopular: Boolean(plan?.is_popular || plan?.popular || plan?.featured) || index === 1,
    highlights: formatModuleHighlights(plan, product, index),
    raw: plan,
  };
}

function fallbackPricingPlans(product) {
  const fallback = {
    crm: [
      {
        title: 'Starter',
        price: 999,
        priceLabel: '\u20B9999',
        cycleLabel: '/ month',
        checkoutKey: 'starter',
        isPopular: false,
        typeLabel: 'CRM',
        highlights: ['Lead Management', 'Sales Pipeline', 'Email Automation', 'Basic Reports'],
      },
      {
        title: 'Business',
        price: 2499,
        priceLabel: '\u20B92499',
        cycleLabel: '/ month',
        checkoutKey: 'business',
        isPopular: true,
        typeLabel: 'CRM',
        highlights: ['Quotation Management', 'Invoice Management', 'WhatsApp Integration', 'Advanced Reports'],
      },
      {
        title: 'Enterprise',
        price: null,
        priceLabel: 'Custom',
        cycleLabel: 'Pricing',
        checkoutKey: 'enterprise',
        isPopular: false,
        typeLabel: 'All-in-One',
        highlights: ['Custom Integrations', 'Dedicated Support', 'Advanced Security', 'Priority Onboarding'],
      },
    ],
    hrms: [
      {
        title: 'Starter',
        price: 999,
        priceLabel: '\u20B9999',
        cycleLabel: '/ month',
        checkoutKey: 'starter',
        isPopular: false,
        typeLabel: 'HRMS',
        highlights: ['Employee Management', 'Attendance Tracking', 'Leave Management', 'Basic Reports'],
      },
      {
        title: 'Business',
        price: 2499,
        priceLabel: '\u20B92499',
        cycleLabel: '/ month',
        checkoutKey: 'business',
        isPopular: true,
        typeLabel: 'HRMS',
        highlights: ['Payroll System', 'Salary Slips', 'Document Management', 'Advanced Reports'],
      },
      {
        title: 'Enterprise',
        price: null,
        priceLabel: 'Custom',
        cycleLabel: 'Pricing',
        checkoutKey: 'enterprise',
        isPopular: false,
        typeLabel: 'All-in-One',
        highlights: ['POSH Module', 'Self Service Portal', 'Dedicated Support', 'Advanced Analytics'],
      },
    ],
  };

  return fallback[product] || fallback.crm;
}

function buildLinePoints(values, width = 320, height = 150, padding = 16) {
  const safeValues = values.map((value) => Number(value) || 0);
  const max = safeValues.length ? Math.max(...safeValues) : 1;
  const min = safeValues.length ? Math.min(...safeValues) : 0;
  const range = max - min || 1;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  return safeValues.map((value, index) => {
    const x = padding + (index * plotWidth) / Math.max(safeValues.length - 1, 1);
    const y = height - padding - ((value - min) / range) * plotHeight;
    return { x, y };
  });
}

function buildAreaPath(points, height = 150, padding = 16) {
  if (!points.length) return '';
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  return `M ${firstPoint.x} ${height - padding} L ${line} L ${lastPoint.x} ${height - padding} Z`;
}

const CRM_FEATURES = [
  {
    icon: FiUsers,
    title: 'Lead Management',
    description: 'Capture inquiries from forms, calls, and campaigns, then route them into the live pipeline.',
  },
  {
    icon: FiTrendingUp,
    title: 'Sales Pipeline',
    description: 'Track every deal stage with visibility from first contact to final closure.',
  },
  {
    icon: FiBell,
    title: 'Follow-up Management',
    description: 'Set reminders, automate nudges, and make sure no hot lead goes quiet.',
  },
  {
    icon: FiUserCheck,
    title: 'Customer Management',
    description: 'Keep customer profiles, interactions, and account notes in one clean workspace.',
  },
  {
    icon: FiMail,
    title: 'Email & WhatsApp Integration',
    description: 'Send updates, quotations, and follow-ups straight from the CRM experience.',
  },
  {
    icon: FiFileText,
    title: 'Quotation Management',
    description: 'Create polished quotations fast and keep approval flow visible for every team member.',
  },
  {
    icon: FiCreditCard,
    title: 'Invoice Management',
    description: 'Turn approved quotations into invoices without jumping into another system.',
  },
  {
    icon: FiDollarSign,
    title: 'Payment Tracking',
    description: 'Track due, pending, and cleared payments with a revenue-first overview.',
  },
  {
    icon: FiBarChart2,
    title: 'Revenue Analytics',
    description: 'See campaign, employee, and customer performance in simple revenue dashboards.',
  },
  {
    icon: FiPieChart,
    title: 'Team Performance Tracking',
    description: 'Compare activity, closures, and response time across the sales team.',
  },
  {
    icon: FiHeadphones,
    title: 'Support Tickets',
    description: 'Capture customer issues and keep sales plus support visibility aligned.',
  },
  {
    icon: FiDownload,
    title: 'Reports & Export',
    description: 'Export the data you need for reviews, planning, and stakeholder updates.',
  },
];

const HRMS_FEATURES = [
  {
    icon: FiUsers,
    title: 'Employee Management',
    description: 'Store employee profiles, onboarding records, and company details in one place.',
  },
  {
    icon: FiClock,
    title: 'Attendance Tracking',
    description: 'Track attendance, shifts, and late punches without manual follow-up.',
  },
  {
    icon: FiCalendar,
    title: 'Leave Management',
    description: 'Approve leave requests, manage balances, and sync with payroll workflows.',
  },
  {
    icon: FiCreditCard,
    title: 'Payroll System',
    description: 'Process salary runs with a transparent, approval-driven flow.',
  },
  {
    icon: FiFileText,
    title: 'Salary Slip',
    description: 'Generate salary slips instantly and share them without additional tools.',
  },
  {
    icon: FiGrid,
    title: 'Department & Designation',
    description: 'Organize the company structure with clear departments and roles.',
  },
  {
    icon: FiFolder,
    title: 'Document Management',
    description: 'Keep employee documents secure, searchable, and easy to access.',
  },
  {
    icon: FiUserCheck,
    title: 'Employee Self Service Portal',
    description: 'Let employees update profile details, view requests, and manage tasks independently.',
  },
  {
    icon: FiShield,
    title: 'POSH Module',
    description: 'Support safe and compliant workplace reporting with dedicated POSH handling.',
  },
  {
    icon: FiBriefcase,
    title: 'Partner Company Employee Management',
    description: 'Handle partner companies and external employee records with the same clarity.',
  },
  {
    icon: FiBarChart2,
    title: 'Reports & Analytics',
    description: 'Review attendance, leave, payroll, and HR trends from one analytics view.',
  },
  {
    icon: FiDownload,
    title: 'Export & Download',
    description: 'Download records and reports whenever you need offline access or sharing.',
  },
];

const CRM_WORKFLOW = [
  {
    icon: FiUsers,
    title: 'Lead Capture',
    description: 'Collect leads from forms, campaigns, and manual entry.',
  },
  {
    icon: FiBell,
    title: 'Follow-up',
    description: 'Automate reminders and move prospects forward.',
  },
  {
    icon: FiTrendingUp,
    title: 'Deal Pipeline',
    description: 'Track each opportunity across active deal stages.',
  },
  {
    icon: FiFileText,
    title: 'Quotation',
    description: 'Create and share quotations without switching tools.',
  },
  {
    icon: FiCreditCard,
    title: 'Invoice',
    description: 'Convert approvals into invoices instantly.',
  },
  {
    icon: FiBarChart2,
    title: 'Report',
    description: 'Monitor growth, revenue, and team output in real time.',
  },
];

const HRMS_WORKFLOW = [
  {
    icon: FiBriefcase,
    title: 'Employee Onboarding',
    description: 'Add employees, documents, and company details in one flow.',
  },
  {
    icon: FiClock,
    title: 'Attendance',
    description: 'Track attendance and working hours in real time.',
  },
  {
    icon: FiCalendar,
    title: 'Leave',
    description: 'Submit, review, and approve leave requests quickly.',
  },
  {
    icon: FiCreditCard,
    title: 'Payroll',
    description: 'Process salaries with accuracy and transparency.',
  },
  {
    icon: FiFileText,
    title: 'Salary Slip',
    description: 'Generate and share slips with a single action.',
  },
  {
    icon: FiBarChart2,
    title: 'Reports',
    description: 'Analyze HR performance and export useful reports.',
  },
];

const CRM_TESTIMONIALS = [
  {
    quote: 'This CRM helped us streamline our sales process and increase revenue by 40%.',
    name: 'Revi Sharma',
    role: 'Sales Head, TechVision',
    initials: 'RS',
  },
  {
    quote: 'Best CRM we have used so far. Easy to use and packed with powerful features.',
    name: 'Amit Verma',
    role: 'Director, MarketHub',
    initials: 'AV',
  },
];

const HRMS_TESTIMONIALS = [
  {
    quote: 'HRMS has simplified our HR operations and saved us 70% of manual work.',
    name: 'Sneha Iyer',
    role: 'HR Manager, SoftTech',
    initials: 'SI',
  },
  {
    quote: 'Attendance, payroll, leave - everything is now easy and transparent.',
    name: 'Rahul Kapoor',
    role: 'HR Head, InnovateX',
    initials: 'RK',
  },
];

const PRODUCT_CONFIG = {
  crm: {
    route: '/crm',
    brandTag: 'CRM',
    badge: '#1 CRM Software for Growing Businesses',
    titlePrefix: 'Smart',
    titleAccent: 'CRM',
    titleSuffix: 'Software to Manage Leads, Sales & Customers',
    subtitle:
      'Track leads, automate follow-ups, manage deals, manage quotations, invoices, and grow revenue from one powerful dashboard.',
    primaryCta: 'Start Free Trial',
    secondaryCta: 'Book CRM Demo',
    ctaPlan: 'starter',
    sectionLead: 'Built for sales teams',
    sectionTitle: 'Powerful CRM Features',
    sectionDescription: 'Everything your sales team needs, from first inquiry to paid invoice.',
    workflowTitle: 'How CRM Works',
    workflowDescription: 'A clean flow from lead capture to revenue reporting.',
    pricingTitle: 'CRM Pricing Plans',
    pricingDescription: 'Active plans from the Super Admin panel appear here automatically.',
    testimonialTitle: 'What CRM Customers Say',
    testimonialDescription: 'Growing teams use MARCOM STREET to close faster and stay organized.',
    footerTitle: 'Ready to grow your sales with Smart CRM?',
    footerDescription: 'Start your free trial today. No credit card required.',
    benefits: ['No credit card required', 'Easy setup', 'Cancel anytime'],
    features: CRM_FEATURES,
    workflow: CRM_WORKFLOW,
    testimonials: CRM_TESTIMONIALS,
    preview: {
      title: 'Dashboard',
      sidebarIcons: [FiTarget, FiUsers, FiLayers, FiFile, FiBarChart2],
      activeSidebarIndex: 1,
      metrics: [
        { label: 'Total Leads', value: '2,450', trend: '+16.6%' },
        { label: 'Deals in Pipeline', value: '1,250', trend: '+14.7%' },
        { label: 'Won Deals', value: '990', trend: '+22.6%' },
        { label: 'Revenue', value: '\u20B958.6L', trend: '+12.6%' },
      ],
      chartTitle: 'Sales Pipeline Overview',
      chartSubTitle: 'Monthly progress across your revenue team',
      chartType: 'line',
      chartValues: [38, 44, 41, 53, 49, 66, 58, 72, 68, 81, 77, 88],
      chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      donutTitle: 'Leads by Source',
      donutCenterValue: '2,450',
      donutCenterLabel: 'Leads',
      donutSegments: [
        { label: 'Website', value: 38, color: '#2563eb' },
        { label: 'Referral', value: 24, color: '#7c3aed' },
        { label: 'Social', value: 18, color: '#0ea5e9' },
        { label: 'Campaigns', value: 20, color: '#f97316' },
      ],
      insightLabel: 'New Deal Won',
      insightTitle: 'Acme Corp',
      insightDescription: 'Deal Value: \u20B92,45,000',
      insightAvatar: 'AC',
    },
  },
  hrms: {
    route: '/hrms',
    brandTag: 'HRMS',
    badge: 'All-in-One HRMS for Modern Teams',
    titlePrefix: 'Complete',
    titleAccent: 'HRMS',
    titleSuffix: 'Software to Manage Employees, Attendance & Payroll',
    subtitle:
      'Manage employee records, attendance, leave, payroll, salary slips, documents, departments, and HR operations from one platform.',
    primaryCta: 'Start Free Trial',
    secondaryCta: 'Book HRMS Demo',
    ctaPlan: 'starter',
    sectionLead: 'Built for people teams',
    sectionTitle: 'Powerful HRMS Features',
    sectionDescription: 'One clean system for employee operations, compliance, and reporting.',
    workflowTitle: 'How HRMS Works',
    workflowDescription: 'From onboarding to payroll, everything stays in one flow.',
    pricingTitle: 'HRMS Pricing Plans',
    pricingDescription: 'Active plans from the Super Admin panel appear here automatically.',
    testimonialTitle: 'What HR Managers Say',
    testimonialDescription: 'HR teams rely on MARCOM STREET to save time and stay compliant.',
    footerTitle: 'Simplify your HR operations with Smart HRMS',
    footerDescription: 'Start your free trial today. No credit card required.',
    benefits: ['No credit card required', 'Easy setup', 'Cancel anytime'],
    features: HRMS_FEATURES,
    workflow: HRMS_WORKFLOW,
    testimonials: HRMS_TESTIMONIALS,
    preview: {
      title: 'HR Dashboard',
      sidebarIcons: [FiUsers, FiClock, FiCalendar, FiFolder, FiShield],
      activeSidebarIndex: 1,
      metrics: [
        { label: 'Total Employees', value: '512', trend: '+12 this month' },
        { label: 'Present Today', value: '398', trend: '77.7%' },
        { label: 'On Leave', value: '28', trend: '5.4%' },
        { label: 'This Month Payroll', value: '\u20B932.6L', trend: '+10.4%' },
      ],
      chartTitle: 'Attendance Overview',
      chartSubTitle: 'Weekly attendance and leave activity',
      chartType: 'bar',
      chartValues: [62, 73, 69, 81, 74, 86],
      chartLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      donutTitle: 'Leave Status',
      donutCenterValue: '28',
      donutCenterLabel: 'On Leave',
      donutSegments: [
        { label: 'Casual Leave', value: 42, color: '#2563eb' },
        { label: 'Sick Leave', value: 26, color: '#7c3aed' },
        { label: 'Paid Leave', value: 18, color: '#0ea5e9' },
        { label: 'Other Leave', value: 14, color: '#f97316' },
      ],
      insightLabel: 'Employee of the Month',
      insightTitle: 'Neha Sharma',
      insightDescription: 'HR Manager',
      insightAvatar: 'NS',
    },
  },
};

function DashboardPreview({ config }) {
  const { preview } = config;
  const linePoints = buildLinePoints(preview.chartValues);
  const areaPath = buildAreaPath(linePoints);
  const conicGradient = preview.donutSegments.reduce(
    (result, segment, index, array) => {
      const total = array.reduce((sum, item) => sum + (Number(item.value) || 0), 0) || 1;
      const start = array.slice(0, index).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
      const end = start + (Number(segment.value) || 0);
      const startPct = (start / total) * 100;
      const endPct = (end / total) * 100;
      return `${result}${result ? ', ' : ''}${segment.color} ${startPct}% ${endPct}%`;
    },
    ''
  );

  return (
    <div className="landing-preview-shell">
      <div className="landing-preview">
        <div className="landing-preview-top">
          <div className="landing-preview-title">
            <span className="landing-preview-title-mark" aria-hidden="true" />
            <span>{preview.title}</span>
          </div>
          <div className="landing-preview-actions" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="landing-preview-body">
          <aside className="landing-preview-sidebar" aria-hidden="true">
            {preview.sidebarIcons.map((Icon, index) => (
              <span
                key={`sidebar-${preview.title}-${index}`}
                className={`landing-preview-sidebar-icon ${index === preview.activeSidebarIndex ? 'is-active' : ''}`}
              >
                <Icon />
              </span>
            ))}
          </aside>

          <div className="landing-preview-main">
            <div className="landing-preview-metrics">
              {preview.metrics.map((metric) => (
                <div className="landing-metric" key={`${preview.title}-${metric.label}`}>
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <span>{metric.trend}</span>
                </div>
              ))}
            </div>

            <div className="landing-preview-grid">
              <div className="landing-chart-card landing-chart-card--primary">
                <div className="landing-chart-card-header">
                  <div>
                    <p>{preview.chartTitle}</p>
                    <span>{preview.chartSubTitle}</span>
                  </div>
                  <FiTrendingUp />
                </div>

                {preview.chartType === 'line' ? (
                  <svg className="landing-line-chart" viewBox="0 0 320 150" role="img" aria-label={preview.chartTitle}>
                    <defs>
                      <linearGradient id="landing-line-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--landing-accent)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="var(--landing-accent)" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="landing-line-stroke" x1="0" x2="1">
                        <stop offset="0%" stopColor="var(--landing-accent)" />
                        <stop offset="100%" stopColor="var(--landing-accent-strong)" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#landing-line-fill)" />
                    <polyline
                      points={linePoints.map((point) => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke="url(#landing-line-stroke)"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {linePoints.map((point, index) => (
                      <circle
                        key={`line-point-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill="#ffffff"
                        stroke="var(--landing-accent)"
                        strokeWidth="3"
                      />
                    ))}
                  </svg>
                ) : (
                  <div className="landing-bar-chart" role="img" aria-label={preview.chartTitle}>
                    {preview.chartValues.map((value, index) => (
                      <div className="landing-bar-column" key={`bar-${preview.title}-${index}`}>
                        <div className="landing-bar-track">
                          <div
                            className="landing-bar-fill"
                            style={{ height: `${Math.max(22, Math.min(100, Number(value) || 0))}%` }}
                          />
                        </div>
                        <span>{preview.chartLabels[index]}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="landing-axis-labels" aria-hidden="true">
                  {preview.chartLabels.map((label) => (
                    <span key={`${preview.title}-${label}`}>{label}</span>
                  ))}
                </div>
              </div>

              <div className="landing-chart-card landing-chart-card--secondary">
                <div className="landing-chart-card-header">
                  <div>
                    <p>{preview.donutTitle}</p>
                    <span>Live breakdown</span>
                  </div>
                  <FiPieChart />
                </div>

                <div className="landing-donut-layout">
                  <div className="landing-donut" style={{ background: `conic-gradient(${conicGradient})` }}>
                    <div className="landing-donut-inner">
                      <strong>{preview.donutCenterValue}</strong>
                      <span>{preview.donutCenterLabel}</span>
                    </div>
                  </div>

                  <div className="landing-legend">
                    {preview.donutSegments.map((segment) => (
                      <div className="landing-legend-row" key={`${preview.title}-${segment.label}`}>
                        <span className="landing-legend-dot" style={{ background: segment.color }} />
                        <span>{segment.label}</span>
                        <strong>{segment.value}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="landing-insight-card">
              <div className="landing-insight-avatar">{preview.insightAvatar}</div>
              <div className="landing-insight-copy">
                <p>{preview.insightLabel}</p>
                <strong>{preview.insightTitle}</strong>
                <span>{preview.insightDescription}</span>
              </div>
              <FiAward />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature }) {
  const Icon = feature.icon;

  return (
    <article className="landing-feature-card">
      <div className="landing-feature-icon" aria-hidden="true">
        <Icon />
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
    </article>
  );
}

function WorkflowStep({ step, index, total }) {
  const Icon = step.icon;

  return (
    <article className="landing-workflow-step">
      <div className="landing-workflow-icon" aria-hidden="true">
        <Icon />
      </div>
      <h3>{step.title}</h3>
      <p>{step.description}</p>
      {index < total - 1 ? (
        <div className="landing-workflow-arrow" aria-hidden="true">
          <FiArrowRight />
        </div>
      ) : null}
    </article>
  );
}

function TestimonialCard({ testimonial }) {
  return (
    <article className="landing-testimonial-card">
      <div className="landing-testimonial-quote-mark" aria-hidden="true">
        <FiStar />
      </div>
      <p className="landing-testimonial-quote">{testimonial.quote}</p>
      <div className="landing-testimonial-meta">
        <div className="landing-avatar">{testimonial.initials}</div>
        <div>
          <strong>{testimonial.name}</strong>
          <span>{testimonial.role}</span>
        </div>
      </div>
    </article>
  );
}

function PricingPlanCard({ plan, product, index }) {
  return (
    <article className={`landing-plan-card ${plan.isPopular ? 'is-popular' : ''}`}>
      {plan.isPopular ? <div className="landing-plan-badge">Most Popular</div> : null}
      <p className="landing-plan-type">{plan.typeLabel}</p>
      <h3>{plan.title}</h3>
      <p className="landing-plan-price">
        {plan.priceLabel}
        <span>{plan.cycleLabel}</span>
      </p>
      <div className="landing-plan-features">
        {plan.highlights.map((item) => (
          <div className="landing-plan-feature" key={`${product}-${plan.id}-${item}`}>
            <FiCheckCircle />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <Link to={`/subscribe?plan=${encodeURIComponent(plan.checkoutKey)}`} className="landing-plan-button">
        Get Started
      </Link>
    </article>
  );
}

export default function LandingPage() {
  const location = useLocation();
  const product = location.pathname.startsWith('/hrms') ? 'hrms' : 'crm';
  const config = PRODUCT_CONFIG[product] || PRODUCT_CONFIG.crm;
  const productPath = config.route;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const navRef = useRef(null);

  useEffect(() => {
    document.title = `MARCOM STREET | ${config.brandTag}`;
  }, [config.brandTag]);

  useEffect(() => {
    setMobileNavOpen(false);
    setProductMenuOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setProductMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
        setProductMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setPricingLoading(true);
      try {
        const response = await api.get('/billing/plans');
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        const mapped = rows
          .map((row, index) => normalizePlan(row, index, product))
          .filter((plan) => planVisibleForProduct(plan.raw, product));

        if (!cancelled) {
          setPricingPlans(mapped.length ? mapped : fallbackPricingPlans(product).map((plan, index) => ({
            ...plan,
            id: `${product}-fallback-${index}`,
          })));
        }
      } catch (error) {
        if (!cancelled) {
          setPricingPlans(fallbackPricingPlans(product).map((plan, index) => ({
            ...plan,
            id: `${product}-fallback-${index}`,
          })));
        }
      } finally {
        if (!cancelled) {
          setPricingLoading(false);
        }
      }
    };

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, [product]);

  const handleScrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileNavOpen(false);
    setProductMenuOpen(false);
  };

  const toggleProductMenu = () => {
    setProductMenuOpen((current) => !current);
  };

  const pricingSkeletonCards = Array.from({ length: 3 }, (_, index) => (
    <div className="landing-plan-card landing-plan-card--skeleton" key={`skeleton-${index}`}>
      <div className="landing-skeleton-line landing-skeleton-line--small" />
      <div className="landing-skeleton-line landing-skeleton-line--title" />
      <div className="landing-skeleton-line landing-skeleton-line--price" />
      <div className="landing-skeleton-stack">
        <div className="landing-skeleton-line" />
        <div className="landing-skeleton-line" />
        <div className="landing-skeleton-line" />
        <div className="landing-skeleton-line" />
      </div>
    </div>
  ));

  return (
    <div className={`landing-page landing-page--${product}`}>
      <header className="landing-topbar" ref={navRef}>
        <div className="landing-topbar-inner">
          <Link className="landing-brand" to={productPath} aria-label="MARCOM STREET home">
            <span className="landing-brand-mark" aria-hidden="true">
              <MarcomLogo className="landing-brand-logo" />
            </span>
            <span className="landing-brand-copy">
              <strong>MARCOM STREET</strong>
              <span>{config.brandTag}</span>
            </span>
          </Link>

          <button
            type="button"
            className="landing-nav-toggle"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((value) => !value)}
          >
            {mobileNavOpen ? <FiX /> : <FiMenu />}
          </button>

          <nav className={`landing-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
            <button type="button" className="landing-nav-link" onClick={() => handleScrollTo('top')}>
              Home
            </button>

            <div className={`landing-product-menu-wrap ${productMenuOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="landing-nav-link landing-nav-link--dropdown"
                aria-haspopup="menu"
                aria-expanded={productMenuOpen}
                onClick={toggleProductMenu}
              >
                Product
                <FiChevronDown />
              </button>

              <div className="landing-product-menu" role="menu" aria-label="Product options">
                <Link
                  to="/crm"
                  className={`landing-product-option ${product === 'crm' ? 'is-active' : ''}`}
                  role="menuitem"
                >
                  <span>
                    <strong>CRM</strong>
                    <small>Sales pipeline and revenue</small>
                  </span>
                  {product === 'crm' ? <FiCheckCircle /> : <FiArrowRight />}
                </Link>
                <Link
                  to="/hrms"
                  className={`landing-product-option ${product === 'hrms' ? 'is-active' : ''}`}
                  role="menuitem"
                >
                  <span>
                    <strong>HRMS</strong>
                    <small>Employees, attendance, payroll</small>
                  </span>
                  {product === 'hrms' ? <FiCheckCircle /> : <FiArrowRight />}
                </Link>
              </div>
            </div>

            <button type="button" className="landing-nav-link" onClick={() => handleScrollTo('features')}>
              Features
            </button>
            <button type="button" className="landing-nav-link" onClick={() => handleScrollTo('pricing')}>
              Pricing
            </button>
            <Link
              to={`/subscribe?plan=${encodeURIComponent(config.ctaPlan)}`}
              className="landing-nav-pill landing-nav-pill--primary"
              onClick={() => {
                setMobileNavOpen(false);
                setProductMenuOpen(false);
              }}
            >
              Start Free Trial
            </Link>
            <button
              type="button"
              className="landing-nav-pill landing-nav-pill--secondary"
              onClick={() => handleScrollTo('pricing')}
            >
              Book a Demo
            </button>
            <Link
              to="/login"
              className="landing-nav-pill landing-nav-pill--ghost"
              onClick={() => {
                setMobileNavOpen(false);
                setProductMenuOpen(false);
              }}
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <div className="landing-kicker">{config.badge}</div>
              <h1 className="landing-hero-title">
                {config.titlePrefix}{' '}
                <span className="landing-hero-title-accent">{config.titleAccent}</span>{' '}
                {config.titleSuffix}
              </h1>
              <p className="landing-hero-subtitle">{config.subtitle}</p>

              <div className="landing-hero-actions">
                <Link to={`/subscribe?plan=${encodeURIComponent(config.ctaPlan)}`} className="landing-hero-button landing-hero-button--primary">
                  {config.primaryCta}
                </Link>
                <button
                  type="button"
                  className="landing-hero-button landing-hero-button--secondary"
                  onClick={() => handleScrollTo('pricing')}
                >
                  {config.secondaryCta}
                </button>
              </div>

              <div className="landing-hero-benefits" aria-label="Benefits">
                {config.benefits.map((item) => (
                  <span className="landing-hero-benefit" key={item}>
                    <FiCheckCircle />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="landing-hero-visual">
              <DashboardPreview config={config} />
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-panel">
            <div className="landing-section-header">
              <div>
                <div className="landing-section-lead">{config.sectionLead}</div>
                <h2>{config.sectionTitle}</h2>
                <p>{config.sectionDescription}</p>
              </div>
              <div className="landing-section-actions">
                <button type="button" className="landing-mini-button" onClick={() => handleScrollTo('pricing')}>
                  Explore pricing
                </button>
                <Link to="/login" className="landing-mini-button landing-mini-button--ghost">
                  Go to login
                </Link>
              </div>
            </div>

            <div className="landing-feature-grid">
              {config.features.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-panel landing-panel--soft" id="workflow">
            <div className="landing-section-header">
              <div>
                <div className="landing-section-lead">{config.sectionLead}</div>
                <h2>{config.workflowTitle}</h2>
                <p>{config.workflowDescription}</p>
              </div>
            </div>

            <div className="landing-workflow-grid">
              {config.workflow.map((step, index) => (
                <WorkflowStep key={step.title} step={step} index={index} total={config.workflow.length} />
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section" id="pricing">
          <div className="landing-pricing-layout">
            <div className="landing-panel">
              <div className="landing-section-header">
                <div>
                  <div className="landing-section-lead">{config.sectionLead}</div>
                  <h2>{config.pricingTitle}</h2>
                  <p>{config.pricingDescription}</p>
                </div>
              </div>

              <div className="landing-plan-grid" aria-busy={pricingLoading ? 'true' : 'false'}>
                {pricingLoading ? (
                  pricingSkeletonCards
                ) : pricingPlans.length ? (
                  pricingPlans.map((plan, index) => (
                    <PricingPlanCard key={plan.id || `${plan.title}-${index}`} plan={plan} product={product} index={index} />
                  ))
                ) : (
                  <div className="landing-empty-state">
                    <FiLayers />
                    <h3>No active plans yet</h3>
                    <p>Ask the Super Admin team to publish subscription plans, then refresh this page.</p>
                  </div>
                )}
              </div>

              <p className="landing-pricing-note">
                * Custom plans and onboarding can be configured from the Super Admin panel.
              </p>
            </div>

            <aside className="landing-panel landing-panel--testimonial">
              <div className="landing-section-header landing-section-header--stack">
                <div>
                  <div className="landing-section-lead">{product === 'crm' ? 'Revenue stories' : 'People stories'}</div>
                  <h2>{config.testimonialTitle}</h2>
                  <p>{config.testimonialDescription}</p>
                </div>
              </div>

              <div className="landing-testimonial-grid">
                {config.testimonials.map((testimonial) => (
                  <TestimonialCard key={testimonial.name} testimonial={testimonial} />
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="landing-footer-cta">
          <div>
            <h2>{config.footerTitle}</h2>
            <p>{config.footerDescription}</p>
          </div>
          <Link to={`/subscribe?plan=${encodeURIComponent(config.ctaPlan)}`} className="landing-footer-button">
            Start Free Trial
          </Link>
        </section>
      </main>
    </div>
  );
}
