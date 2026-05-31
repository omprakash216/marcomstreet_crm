import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, forwardRef } from "react";
import { createPortal } from "react-dom";
import { getEmployee, clearAuth, normalizeRole } from "../utils/auth";
import api from "../utils/api";
import MarcomLogo from "./MarcomLogo";
import NotificationDropdown from "./NotificationDropdown";

export default function AdminLayout() {
  const [employee, setEmployee] = useState(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const dropdownRef = useRef(null);
  const profileButtonRef = useRef(null);
  const profileMenuRef = useRef(null);
  const mainScrollRef = useRef(null);
  const [profileMenuPosition, setProfileMenuPosition] = useState({
    top: 88,
    left: 16,
    width: 288,
    maxHeight: 320,
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const emp = getEmployee();
    if (!emp) {
      navigate("/login", { replace: true });
      return;
    }

    const role = normalizeRole(emp.role);
    if (role !== "admin" && role !== "superadmin" && role !== "super_admin") {
      navigate("/", { replace: true });
      return;
    }

    setEmployee(emp);
    checkCheckInStatus();
  }, [navigate]);

  const checkCheckInStatus = async () => {
    try {
      const response = await api.get("/checkin/status");
      if (response.data && response.data.success) {
        setCheckedIn(response.data.data?.checked_in || false);
      }
    } catch (error) {
      // Silently handle status check errors
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleCheckIn = async () => {
    if (checkedIn) return;
    setCheckInLoading(true);
    try {
      let punchLocation = "Office";
      let latitude = null;
      let longitude = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          punchLocation = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
        } catch (e) {
          // Fallback if geo fails
        }
      }

      await api.post("/checkin/checkin", {
        location: punchLocation,
        latitude,
        longitude
      });

      setCheckedIn(true);
      alert("Shift started successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Check-in failed");
    } finally {
      setCheckInLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      const clickedProfileButton = dropdownRef.current?.contains(event.target);
      const clickedProfileMenu = profileMenuRef.current?.contains(event.target);
      if (!clickedProfileButton && !clickedProfileMenu) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Keep route transitions predictable inside the custom scroll container.
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [location.pathname, location.search]);

  const updateProfileMenuPosition = () => {
    const trigger = profileButtonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const width = Math.min(288, Math.max(240, viewportWidth - 32));
    const left = Math.min(Math.max(16, rect.right - width), viewportWidth - width - 16);
    const top = Math.min(rect.bottom + 8, viewportHeight - 16);

    setProfileMenuPosition({
      top,
      left,
      width,
      maxHeight: Math.max(96, viewportHeight - top - 16),
    });
  };

  useEffect(() => {
    if (!showProfileDropdown) return;

    updateProfileMenuPosition();
    window.addEventListener("resize", updateProfileMenuPosition);
    window.addEventListener("scroll", updateProfileMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateProfileMenuPosition);
      window.removeEventListener("scroll", updateProfileMenuPosition, true);
    };
  }, [showProfileDropdown]);

  const isActive = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

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

  const toggleMobileSidebar = () => setShowMobileSidebar(!showMobileSidebar);
  const closeMobileSidebar = () => setShowMobileSidebar(false);

  if (!employee) return null;

  return (
    <div className="admin-shell h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Mobile Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Header */}
      <header className="admin-topbar fixed top-0 left-0 right-0 h-24 bg-[#2c86ab] shadow-lg border-b border-[#247596] backdrop-blur-sm z-50 px-4 sm:px-6 overflow-visible">
        {/* Plus pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='22' height='22' viewBox='0 0 22 22' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 7v8M7 11h8' stroke='rgba(255,255,255,0.18)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="h-full flex items-center justify-between max-w-[1600px] mx-auto w-full relative z-10">
          <div className="flex items-center h-full gap-4">
            <button
              onClick={toggleMobileSidebar}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <i className="fas fa-bars text-xl"></i>
            </button>
            <div className="w-40 sm:w-64 h-full flex items-center justify-center border-r border-white/10 pr-4">
              <Link to="/admin" className="flex items-center shrink-0">
                <MarcomLogo className="w-[86px] h-[86px] transition-transform duration-300 hover:scale-110 select-none" />
              </Link>
            </div>
          </div>

          {/* Middle Banner (Desktop only) */}
          <div className="hidden md:flex flex-1 items-center gap-4 px-6 h-full">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white bg-white/10 border border-white/20 shadow-inner">
              <i className="fas fa-cubes text-lg"></i>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-extrabold tracking-wide text-white leading-tight">
                Company Admin Panel
              </h1>
              <p className="text-xs font-semibold text-blue-100 truncate">
                Complete Company Management System & HRMS
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase text-white bg-white/15 border border-white/30">
              COMPANY ADMIN
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Global Attendance Toggle */}
            <div className="hidden xs:block">
              {checkingStatus ? (
                <div className="w-24 h-9 bg-white/10 animate-pulse rounded-xl"></div>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={checkInLoading || checkedIn}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md group ${
                    checkedIn
                      ? "bg-green-500/20 text-green-100 border border-green-400/30 cursor-default"
                      : "bg-white text-[#2c86ab] hover:bg-white/90 hover:shadow-lg active:scale-95"
                  }`}
                >
                  <i className={`fas ${checkedIn ? "fa-check-circle" : "fa-clock"} ${!checkedIn && !checkInLoading ? 'animate-pulse' : ''}`}></i>
                  <span className="hidden sm:inline">
                    {checkedIn ? "Shift Active" : checkInLoading ? "Pinching..." : "Check In"}
                  </span>
                  <span className="sm:hidden">
                    {checkedIn ? "P" : "IN"}
                  </span>
                </button>
              )}
            </div>

            <div className="hidden xl:flex items-center gap-2">
              <TopNavButton to="/admin" icon="fas fa-home" label="Home" />
              <TopNavButton to="/admin/calendar" icon="fas fa-calendar-alt" label="Calendar" />
              <TopNavButton to="/admin/support-tickets" icon="fas fa-life-ring" label="Support" />
            </div>

            <NotificationDropdown theme="light" />

            <div className="relative profile-dropdown-container z-[9999]" ref={dropdownRef}>
              <button
                ref={profileButtonRef}
                type="button"
                onClick={() => {
                  updateProfileMenuPosition();
                  setShowProfileDropdown((current) => !current);
                }}
                aria-haspopup="menu"
                aria-expanded={showProfileDropdown}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 relative z-[9999]"
              >
                <div className="w-10 h-10 rounded-full bg-white text-[#2c86ab] flex items-center justify-center text-sm font-bold shadow-md hover:shadow-lg transition-shadow">
                  {employee.name ? employee.name.charAt(0).toUpperCase() : "A"}
                </div>
                <svg
                  className={`w-4 h-4 text-white transition-transform ${showProfileDropdown ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {showProfileDropdown &&
        createPortal(
          <ProfileMenu
            ref={profileMenuRef}
            employee={employee}
            onLogout={handleLogout}
            style={{
              top: profileMenuPosition.top,
              left: profileMenuPosition.left,
              width: profileMenuPosition.width,
              maxHeight: profileMenuPosition.maxHeight,
            }}
          />,
          document.body
        )}

      <div className="admin-workspace flex pt-24 flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`admin-sidebar fixed lg:sticky top-24 left-0 z-40 w-72 h-[calc(100vh-6rem)] bg-white border-r border-gray-200 transition-transform duration-300 transform ${
            showMobileSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="h-full min-h-0 flex flex-col pt-4">
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto pb-8 custom-scrollbar">
              <SidebarLink to="/admin" icon="fas fa-tachometer-alt" label="Dashboard" active={isActive("/admin") && location.pathname === "/admin"} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Company Admin</p>
              </div>
              <SidebarLink to="/admin/company-profile" icon="fas fa-id-card" label="Company Profile" active={isActive("/admin/company-profile")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/calendar" icon="fas fa-calendar-alt" label="Meeting Calendar" active={isActive("/admin/calendar")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/chat" icon="fas fa-comments" label="Team Chat" active={isActive("/admin/chat")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/attendance" icon="fas fa-user-clock" label="Attendance" active={isActive("/admin/attendance")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/leaves" icon="fas fa-calendar-minus" label="Leaves" active={isActive("/admin/leaves")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/payroll" icon="fas fa-money-check-alt" label="Payroll" active={isActive("/admin/payroll")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/leads" icon="fas fa-bullhorn" label="Leads" active={isActive("/admin/leads")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/clients" icon="fas fa-user-friends" label="Clients" active={isActive("/admin/clients")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/followups" icon="fas fa-phone-volume" label="Follow-ups" active={isActive("/admin/followups")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/deals-pipeline" icon="fas fa-filter" label="Deals / Pipeline" active={isActive("/admin/deals-pipeline")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/quotations" icon="fas fa-file-signature" label="Quotations" active={isActive("/admin/quotations")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/quotation-templates" icon="fas fa-file-invoice" label="Quotation Formats" active={isActive("/admin/quotation-templates")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/invoices" icon="fas fa-file-invoice-dollar" label="Invoices" active={isActive("/admin/invoices")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/payments" icon="fas fa-credit-card" label="Payments" active={isActive("/admin/payments")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/accounts" icon="fas fa-university" label="Bank Accounts" active={isActive("/admin/accounts")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/expenses" icon="fas fa-receipt" label="Expenses" active={isActive("/admin/expenses")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/reports" icon="fas fa-chart-bar" label="Finance Reports" active={isActive("/admin/reports")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Inventory</p>
              </div>
              <SidebarLink to="/admin/products" icon="fas fa-box-open" label="Products" active={isActive("/admin/products")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/stock" icon="fas fa-layer-group" label="Stock" active={isActive("/admin/stock")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/purchases" icon="fas fa-shopping-cart" label="Purchases" active={isActive("/admin/purchases")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/suppliers" icon="fas fa-truck-loading" label="Suppliers" active={isActive("/admin/suppliers")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/warehouses" icon="fas fa-warehouse" label="Warehouses" active={isActive("/admin/warehouses")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/inventory" icon="fas fa-boxes" label="Inventory Mgmt" active={isActive("/admin/inventory")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Projects & Tasks</p>
              </div>
              <SidebarLink to="/admin/projects" icon="fas fa-project-diagram" label="Projects" active={isActive("/admin/projects")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/tasks" icon="fas fa-tasks" label="Tasks" active={isActive("/admin/tasks")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/task-board" icon="fas fa-columns" label="Task Board" active={isActive("/admin/task-board")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/timesheets" icon="fas fa-clock" label="Timesheets" active={isActive("/admin/timesheets")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/task-assignment" icon="fas fa-clipboard-check" label="Task Assignments" active={isActive("/admin/task-assignment")} onClick={closeMobileSidebar} />

              <SidebarLink to="/admin/companies" icon="fas fa-building" label="Companies" active={isActive("/admin/companies")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Business Intelligence</p>
              </div>

              <SidebarLink to="/admin/revenue" icon="fas fa-money-bill-wave" label="Revenue & Forecast" active={isActive("/admin/revenue")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/insights" icon="fas fa-lightbulb" label="Smart Insights" active={isActive("/admin/insights")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/ai-lead-score" icon="fas fa-robot" label="AI Lead Scoring" active={isActive("/admin/ai-lead-score")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Operations</p>
              </div>

              <SidebarLink to="/admin/employees" icon="fas fa-users" label="Employees" active={isActive("/admin/employees")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/departments" icon="fas fa-sitemap" label="Departments" active={isActive("/admin/departments")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/announcements" icon="fas fa-bullhorn" label="Announcements" active={isActive("/admin/announcements")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/notifications" icon="fas fa-bell" label="Notifications" active={isActive("/admin/notifications")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/export-reports" icon="fas fa-file-export" label="Export Reports" active={isActive("/admin/export-reports")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/documents" icon="fas fa-folder-open" label="Documents" active={isActive("/admin/documents")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">System</p>
              </div>

              <SidebarLink to="/admin/integrations" icon="fas fa-plug" label="Integrations" active={isActive("/admin/integrations")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/api-integration" icon="fas fa-plug" label="API Integration" active={isActive("/admin/api-integration")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/reports" icon="fas fa-file-alt" label="System Reports" active={isActive("/admin/reports")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/support-tickets" icon="fas fa-life-ring" label="Support / Tickets" active={isActive("/admin/support-tickets")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/audit-logs" icon="fas fa-history" label="Audit Logs" active={isActive("/admin/audit-logs")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/rbac" icon="fas fa-user-shield" label="Roles & Access" active={isActive("/admin/rbac")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/company-settings" icon="fas fa-cog" label="Company Settings" active={isActive("/admin/company-settings")} onClick={closeMobileSidebar} />
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main
          ref={mainScrollRef}
          className="admin-main flex-1 min-h-0 overflow-y-auto bg-gray-50/50 px-4 sm:px-6 lg:px-8 pt-0 pb-6"
        >
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

const ProfileMenu = forwardRef(function ProfileMenu({ employee, onLogout, style }, ref) {
  return (
    <div
      ref={ref}
      role="menu"
      className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[10000] overflow-y-auto"
      style={style}
    >
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md">
            {employee.name ? employee.name.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {employee.name || "Admin"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {employee.email || "admin@crm.com"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Administrator</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-gray-200">
        <div className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100">
          Primary Admin
        </div>
      </div>

      <div className="px-2 py-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
});

function SidebarLink({ to, icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200 border-b-2 border-blue-700"
          : "text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100"
      }`}
    >
      <i className={`${icon} w-6 text-center text-base mr-3 ${active ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`}></i>
      <span className="truncate flex-1">{label}</span>
      {active && <div className="w-1.5 h-1.5 bg-white rounded-full ml-2 animate-pulse"></div>}
    </Link>
  );
}

function TopNavButton({ to, icon, label }) {
  const location = useLocation();
  const active = to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
        active
          ? "bg-white text-[#2c86ab] border-white shadow-md"
          : "bg-white/10 text-white border-white/20 hover:bg-white/20"
      }`}
    >
      <i className={icon}></i>
      <span>{label}</span>
    </Link>
  );
}
