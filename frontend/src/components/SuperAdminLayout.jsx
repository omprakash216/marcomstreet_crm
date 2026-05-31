import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import api from "../utils/api";
import { clearAuth, getEmployee, isSuperAdminRole, normalizeSuperAdminPanel } from "../utils/auth";
import MarcomLogo from "./MarcomLogo";

const masterNavSections = [
  {
    title: "Platform",
    links: [
      { to: "/superadmin", label: "Dashboard", icon: "fa-tachometer-alt", end: true },
      { to: "/superadmin/companies", label: "Companies", icon: "fa-building" },
      { to: "/superadmin/create-company", label: "Create Company", icon: "fa-plus-square" },
      { to: "/superadmin/subscriptions", label: "Subscription Plans", icon: "fa-layer-group" },
      { to: "/superadmin/billing/requests", label: "Plan Requests", icon: "fa-file-signature" },
      { to: "/superadmin/modules", label: "Module Manager", icon: "fa-cubes" },
      { to: "/superadmin/users", label: "Global Users", icon: "fa-users-cog" },
      { to: "/superadmin/roles", label: "Roles & Access", icon: "fa-user-shield" },
      { to: "/superadmin/super-admins", label: "Super Admins", icon: "fa-user-shield" },
      { to: "/superadmin/admins-users", label: "Admins & Users", icon: "fa-users" },
    ],
  },
  {
    title: "Setup Management",
    links: [
      { to: "/superadmin/company-admins", label: "Company Admins", icon: "fa-user-tie" },
      { to: "/superadmin/access-assign", label: "Access Assign", icon: "fa-key" },
      { to: "/superadmin/module-assign", label: "Module Assign", icon: "fa-puzzle-piece" },
      { to: "/superadmin/plan-assign", label: "Plan Assign", icon: "fa-id-card" },
      { to: "/superadmin/setup-reports", label: "Setup Reports", icon: "fa-chart-pie" },
      { to: "/superadmin/my-activity", label: "My Activity", icon: "fa-clipboard-list" },
    ],
  },
  {
    title: "Product Control",
    links: [
      { to: "/superadmin/crm", label: "CRM Control", icon: "fa-chart-line" },
      { to: "/superadmin/hrms-control", label: "HRMS Control", icon: "fa-sitemap" },
      { to: "/superadmin/feature-flags", label: "Feature Flags", icon: "fa-toggle-on" },
    ],
  },
  {
    title: "Billing & Analytics",
    links: [
      { to: "/superadmin/billing/invoices", label: "Invoices", icon: "fa-file-invoice-dollar" },
      { to: "/superadmin/billing/transactions", label: "Transactions", icon: "fa-credit-card" },
      { to: "/superadmin/analytics/revenue", label: "Revenue Analytics", icon: "fa-chart-area" },
      { to: "/superadmin/analytics/usage", label: "Usage Analytics", icon: "fa-chart-bar" },
    ],
  },
  {
    title: "System",
    links: [
      { to: "/superadmin/integrations/api", label: "API Integrations", icon: "fa-plug" },
      { to: "/superadmin/integrations/webhooks", label: "Webhooks", icon: "fa-exchange-alt" },
      { to: "/superadmin/templates", label: "Templates", icon: "fa-copy" },
      { to: "/superadmin/notifications/email-templates", label: "Email Templates", icon: "fa-envelope" },
      { to: "/superadmin/tickets", label: "Support Tickets", icon: "fa-life-ring" },
      { to: "/superadmin/security/login-sessions", label: "Login Sessions", icon: "fa-shield-alt" },
      { to: "/superadmin/security-center", label: "Security Center", icon: "fa-user-lock" },
      { to: "/superadmin/audit-logs", label: "Audit Logs", icon: "fa-history" },
      { to: "/superadmin/settings", label: "System Settings", icon: "fa-cog" },
      { to: "/superadmin/system-monitor", label: "System Monitor", icon: "fa-heartbeat" },
      { to: "/superadmin/system/backups", label: "Backups", icon: "fa-database" },
      { to: "/superadmin/white-label-settings", label: "White Label", icon: "fa-paint-brush" },
      { to: "/superadmin/profile", label: "Profile", icon: "fa-user-circle" },
    ],
  },
  {
    title: "Universal Portals",
    links: [
      { to: "/admin", label: "Admin Portal", icon: "fa-building", tone: "blue" },
      { to: "/hr", label: "HR Portal", icon: "fa-users", tone: "emerald" },
      { to: "/manager", label: "Manager Portal", icon: "fa-chart-bar", tone: "amber" },
      { to: "/", label: "Employee Portal", icon: "fa-home", tone: "slate", end: true },
    ],
  },
];

const setupNavSections = [
  {
    title: "Setup Panel",
    links: [
      { to: "/superadmin/setup", label: "Dashboard", icon: "fa-tachometer-alt", end: true },
      { to: "/superadmin/companies", label: "Companies", icon: "fa-building" },
      { to: "/superadmin/create-company", label: "Create Company", icon: "fa-plus-square" },
      { to: "/superadmin/company-admins", label: "Company Admins", icon: "fa-user-shield" },
      { to: "/superadmin/users", label: "Users", icon: "fa-users" },
      { to: "/superadmin/access-assign", label: "Access Assign", icon: "fa-key" },
      { to: "/superadmin/module-assign", label: "Module Assign", icon: "fa-cubes" },
      { to: "/superadmin/plan-assign", label: "Plan Assign", icon: "fa-layer-group" },
      { to: "/superadmin/reports", label: "Reports", icon: "fa-chart-bar" },
      { to: "/superadmin/my-activity", label: "My Activity", icon: "fa-history" },
      { to: "/superadmin/support-tickets", label: "Tickets", icon: "fa-ticket-alt" },
      { to: "/superadmin/profile", label: "Profile", icon: "fa-id-badge" },
    ],
  },
];

const navToneClasses = {
  default: {
    active: "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md",
    inactive: "text-gray-700 hover:bg-blue-50 hover:text-blue-700",
  },
  blue: {
    active: "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md",
    inactive: "text-gray-700 hover:bg-blue-50 hover:text-blue-700",
  },
  emerald: {
    active: "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md",
    inactive: "text-gray-700 hover:bg-emerald-50 hover:text-emerald-700",
  },
  amber: {
    active: "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md",
    inactive: "text-gray-700 hover:bg-amber-50 hover:text-amber-700",
  },
  slate: {
    active: "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md",
    inactive: "text-gray-700 hover:bg-slate-50 hover:text-slate-800",
  },
};

export default function SuperAdminLayout() {
  const [employee] = useState(() => getEmployee());
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const panelType = normalizeSuperAdminPanel(employee?.superadmin_panel);
  const isSetupPanel = panelType === "setup";
  const dashboardHome = isSetupPanel ? "/superadmin/setup" : "/superadmin/master";
  const navSections = isSetupPanel ? setupNavSections : masterNavSections;
  const panelHeader = isSetupPanel
    ? {
        title: "SUPER ADMIN PANEL – COMPANY SETUP & MANAGEMENT",
        subtitle: "Create Companies, Users & Assign Access",
        badge: "Company Setup",
        icon: "fa-building",
      }
    : {
        title: "MASTER PANEL – PLATFORM OWNER (FULL ACCESS)",
        subtitle: "Complete Control Over All Companies, Users, Plans, Modules & System",
        badge: "Full Access",
        icon: "fa-crown",
      };

  useEffect(() => {
    if (!employee || !isSuperAdminRole(employee.role)) {
      navigate("/", { replace: true });
    }
  }, [employee, navigate]);

  useEffect(() => {
    setShowMobileSidebar(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeProfile = (event) => {
      if (!event.target.closest(".superadmin-profile-dropdown")) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      if (error.response?.status && error.response.status !== 404) {
        console.error("Logout error:", error);
      }
    }
    clearAuth();
    navigate("/login", { replace: true });
  };

  if (!employee || !isSuperAdminRole(employee.role)) return null;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {showMobileSidebar && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      <header className="fixed left-0 right-0 top-0 z-50 h-24 overflow-visible border-b border-[#247596] bg-[#2c86ab] px-4 shadow-lg backdrop-blur-sm sm:px-6">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='22' height='22' viewBox='0 0 22 22' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 7v8M7 11h8' stroke='rgba(255,255,255,0.18)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1600px] items-center justify-between">
          <div className="flex h-full items-center gap-4">
            <button
              type="button"
              onClick={() => setShowMobileSidebar((shown) => !shown)}
              className="rounded-lg p-2 text-white transition-colors hover:bg-white/10 lg:hidden"
              aria-label="Toggle sidebar"
            >
              <i className="fas fa-bars text-xl" />
            </button>
            <Link
              to={dashboardHome}
              className="flex h-full w-40 shrink-0 items-center justify-center border-r border-white/10 pr-4 sm:w-64"
            >
              <MarcomLogo className="h-[86px] w-[86px] select-none transition-transform duration-300 hover:scale-110" />
            </Link>
          </div>

          <div className="hidden h-full flex-1 items-center gap-4 px-6 md:flex">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-inner">
              <i className={`fas ${panelHeader.icon} text-lg`} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-wide text-white">
                {panelHeader.title}
              </h1>
              <p className="truncate text-xs font-semibold text-blue-100">{panelHeader.subtitle}</p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
              {panelHeader.badge}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="superadmin-profile-dropdown relative">
              <button
                type="button"
                onClick={() => setShowProfileDropdown((shown) => !shown)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-white transition-colors hover:bg-white/10"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-[#2c86ab] shadow-md">
                  {(employee.name || "S").charAt(0).toUpperCase()}
                </span>
                <i className={`fas fa-chevron-down text-xs transition-transform ${showProfileDropdown ? "rotate-180" : ""}`} />
              </button>
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-200 bg-white py-2 shadow-xl">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{employee.name || "Super Admin"}</p>
                    <p className="truncate text-xs text-gray-500">{employee.email}</p>
                    <span className="mt-2 inline-flex rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                      Super Admin
                    </span>
                  </div>
                  <div className="px-2 pt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                      <i className="fas fa-sign-out-alt" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside
        className={`fixed bottom-0 left-0 top-24 z-40 flex w-64 flex-col border-r border-gray-200 bg-white shadow-sm transition-transform duration-300 ${
          showMobileSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <nav className="flex-1 space-y-5 overflow-y-auto p-4">
          {navSections.map((section) => (
            <section key={section.title}>
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">{section.title}</p>
              <div className="space-y-1">
                {section.links.map((link) => {
                  const targetTo = link.to === "/superadmin" ? dashboardHome : link.to;
                  const tone = navToneClasses[link.tone] || navToneClasses.default;
                  return (
                    <NavLink
                      key={targetTo}
                      to={targetTo}
                      end={link.end}
                      className={({ isActive }) =>
                        `group flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                          isActive ? tone.active : tone.inactive
                        }`
                      }
                    >
                      <i className={`fas ${link.icon} mr-3 w-5 text-center`} />
                      <span>{link.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className="h-full overflow-y-auto pt-24 lg:pl-64">
        <main className="min-h-full p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
