import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useMemo, forwardRef } from "react";
import { createPortal } from "react-dom";
import { getEmployee, clearAuth, normalizeRole, isSuperAdminRole, hasModuleAccess } from "../utils/auth";
import api from "../utils/api";
import MarcomLogo from "./MarcomLogo";
import NotificationDropdown from "./NotificationDropdown";

function getAdminSidebarSections(showMasterCompanyManagement, showPoshManagement = false) {
  const sections = [
    {
      key: "company",
      label: "Company",
      icon: "fas fa-building",
      items: [
        { to: "/admin/company-profile", icon: "fas fa-id-card", label: "Company Profile" },
        { to: "/admin/calendar", icon: "fas fa-calendar-alt", label: "Meeting Calendar" },
        { to: "/admin/chat", icon: "fas fa-comments", label: "Team Chat" },
      ],
    },
    {
      key: "crm",
      label: "CRM & Sales",
      icon: "fas fa-chart-line",
      items: [
        { to: "/admin/leads", icon: "fas fa-bullhorn", label: "Leads" },
        { to: "/admin/clients", icon: "fas fa-user-friends", label: "Clients" },
        { to: "/admin/followups", icon: "fas fa-phone-volume", label: "Follow-ups" },
        { to: "/admin/deals-pipeline", icon: "fas fa-filter", label: "Deals / Pipeline" },
        { to: "/admin/quotations", icon: "fas fa-file-signature", label: "Quotations" },
        { to: "/admin/quotation-templates", icon: "fas fa-file-invoice", label: "Quotation Formats" },
        { to: "/admin/invoices", icon: "fas fa-file-invoice-dollar", label: "Invoices" },
        { to: "/admin/sales-orders", icon: "fas fa-truck", label: "Sales Orders" },
      ],
    },
    {
      key: "finance",
      label: "Finance & Bank",
      icon: "fas fa-wallet",
      items: [
        { to: "/admin/payments", icon: "fas fa-credit-card", label: "Payments" },
        { to: "/admin/accounts", icon: "fas fa-university", label: "Bank Accounts" },
        { to: "/admin/expenses", icon: "fas fa-receipt", label: "Expenses" },
        {
          to: "/admin/reports?scope=finance",
          icon: "fas fa-chart-bar",
          label: "Finance Reports",
          activeWhen: (location) => location.pathname === "/admin/reports" && (!location.search || location.search.includes("scope=finance")),
        },
      ],
    },
    {
      key: "inventory",
      label: "Inventory",
      icon: "fas fa-boxes",
      items: [
        { to: "/admin/products", icon: "fas fa-box-open", label: "Products" },
        { to: "/admin/stock", icon: "fas fa-layer-group", label: "Stock" },
        { to: "/admin/purchases", icon: "fas fa-shopping-cart", label: "Purchases" },
        { to: "/admin/suppliers", icon: "fas fa-truck-loading", label: "Suppliers" },
        { to: "/admin/warehouses", icon: "fas fa-warehouse", label: "Warehouses" },
        { to: "/admin/inventory", icon: "fas fa-boxes", label: "Inventory Mgmt" },
      ],
    },
    {
      key: "hrms",
      label: "HRMS",
      icon: "fas fa-users-cog",
      items: [
        { to: "/admin/employees", icon: "fas fa-users", label: "Employees" },
        { to: "/admin/departments", icon: "fas fa-sitemap", label: "Departments" },
        { to: "/admin/attendance", icon: "fas fa-user-clock", label: "Attendance" },
        { to: "/admin/leaves", icon: "fas fa-calendar-minus", label: "Leaves" },
        { to: "/admin/payroll", icon: "fas fa-money-check-alt", label: "Payroll" },
        { to: "/admin/announcements", icon: "fas fa-bullhorn", label: "Announcements" },
        { to: "/admin/documents", icon: "fas fa-folder-open", label: "Documents" },
      ],
    },
    {
      key: "projects",
      label: "Projects & Tasks",
      icon: "fas fa-project-diagram",
      items: [
        { to: "/admin/projects", icon: "fas fa-project-diagram", label: "Projects" },
        { to: "/admin/tasks", icon: "fas fa-tasks", label: "Tasks" },
        { to: "/admin/task-board", icon: "fas fa-columns", label: "Task Board" },
        { to: "/admin/timesheets", icon: "fas fa-clock", label: "Timesheets" },
        { to: "/admin/task-assignment", icon: "fas fa-clipboard-check", label: "Task Assignments" },
      ],
    },
    {
      key: "insights",
      label: "Business Intelligence",
      icon: "fas fa-brain",
      items: [
        { to: "/admin/revenue", icon: "fas fa-money-bill-wave", label: "Revenue & Forecast" },
        { to: "/admin/insights", icon: "fas fa-lightbulb", label: "Smart Insights" },
        { to: "/admin/ai-lead-score", icon: "fas fa-robot", label: "AI Lead Scoring" },
      ],
    },
    {
      key: "system",
      label: "System & Support",
      icon: "fas fa-sliders-h",
      items: [
        { to: "/admin/api-integration", icon: "fas fa-plug", label: "API Integration" },
        {
          to: "/admin/reports?scope=system",
          icon: "fas fa-file-alt",
          label: "System Reports",
          activeWhen: (location) => location.pathname === "/admin/reports" && location.search.includes("scope=system"),
        },
        { to: "/admin/export-reports", icon: "fas fa-file-export", label: "Export Reports" },
        { to: "/admin/support-tickets", icon: "fas fa-life-ring", label: "Support / Tickets" },
        { to: "/admin/audit-logs", icon: "fas fa-history", label: "Audit Logs" },
        { to: "/admin/rbac", icon: "fas fa-user-shield", label: "Roles & Access" },
        { to: "/admin/company-settings", icon: "fas fa-cog", label: "Company Settings" },
      ],
    },
  ];

  if (showMasterCompanyManagement) {
    sections.splice(1, 0, {
      key: "master",
      label: "Master Panel",
      icon: "fas fa-crown",
      items: [
        { to: "/superadmin/companies", icon: "fas fa-building", label: "Companies" },
      ],
    });
  }

  if (showPoshManagement) {
    sections.splice(5, 0, {
      key: "posh",
      label: "POSH Management",
      icon: "fas fa-shield-alt",
      items: [
        { to: "/admin/posh", icon: "fas fa-shield-alt", label: "Dashboard", activeWhen: (location) => location.pathname === "/admin/posh" && !location.search },
        { to: "/admin/posh?tab=complaints", icon: "fas fa-clipboard-list", label: "All Complaints", activeWhen: (location) => location.pathname === "/admin/posh" && location.search.includes("tab=complaints") },
        { to: "/admin/posh?tab=icc", icon: "fas fa-user-shield", label: "ICC Committee", activeWhen: (location) => location.pathname === "/admin/posh" && location.search.includes("tab=icc") },
        { to: "/admin/posh?tab=investigations", icon: "fas fa-search", label: "Investigations", activeWhen: (location) => location.pathname === "/admin/posh" && location.search.includes("tab=investigations") },
        { to: "/admin/posh?tab=hearings", icon: "fas fa-calendar-check", label: "Hearings", activeWhen: (location) => location.pathname === "/admin/posh" && location.search.includes("tab=hearings") },
        { to: "/admin/posh?tab=evidence", icon: "fas fa-lock", label: "Evidence Vault", activeWhen: (location) => location.pathname === "/admin/posh" && location.search.includes("tab=evidence") },
        { to: "/admin/posh?tab=reports", icon: "fas fa-chart-pie", label: "Reports", activeWhen: (location) => location.pathname === "/admin/posh" && location.search.includes("tab=reports") },
        { to: "/admin/posh?tab=settings", icon: "fas fa-cog", label: "Settings", activeWhen: (location) => location.pathname === "/admin/posh" && location.search.includes("tab=settings") },
      ],
    });
  }

  return sections;
}

export default function AdminLayout() {
  const [employee, setEmployee] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [openSection, setOpenSection] = useState("company");
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatPollingEnabled, setChatPollingEnabled] = useState(true);
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
    let cancelled = false;

    const bootstrapSession = async () => {
      setAuthReady(false);

      const emp = getEmployee();
      if (!emp) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }

      const cachedRole = normalizeRole(emp.role);
      if (cachedRole !== "admin" && cachedRole !== "superadmin" && cachedRole !== "super_admin") {
        navigate("/", { replace: true });
        return;
      }

      try {
        const response = await api.get("/auth/verify");
        const verifiedEmployee = response.data?.data?.employee;
        if (!verifiedEmployee) {
          throw new Error("Invalid session payload");
        }

        const role = normalizeRole(verifiedEmployee.role);
        if (role !== "admin" && role !== "superadmin" && role !== "super_admin") {
          navigate("/", { replace: true });
          return;
        }

        if (cancelled) return;
        setEmployee(verifiedEmployee);
        localStorage.setItem("employee", JSON.stringify(verifiedEmployee));
        setCheckedIn(false);
        setCheckingStatus(true);
        setUnreadChatCount(0);
        setChatPollingEnabled(true);
        setAuthReady(true);
      } catch (error) {
        if (cancelled) return;
        if (error.response?.status === 401) {
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }

        setEmployee(emp);
        setCheckedIn(false);
        setCheckingStatus(true);
        setAuthReady(true);
      }
    };

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!authReady || !employee) return;
    setCheckingStatus(true);
    setCheckedIn(false);
    checkCheckInStatus();
  }, [authReady, employee]);

  const fetchUnreadCount = async () => {
    if (!employee || !chatPollingEnabled) return;

    try {
      const response = await api.get("/chat?action=unread_count");
      if (response.data.success) {
        setUnreadChatCount(response.data.count);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setUnreadChatCount(0);
        setChatPollingEnabled(false);
      }
    }
  };

  useEffect(() => {
    if (!authReady || !employee || !chatPollingEnabled) return;

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [authReady, employee, chatPollingEnabled]);

  const checkCheckInStatus = async () => {
    if (!employee) {
      setCheckingStatus(false);
      return;
    }

    try {
      const response = await api.get("/checkin/status");
      if (response.data && response.data.success) {
        setCheckedIn(response.data.data?.checked_in || false);
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        // Silently handle status check errors
      }
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
    const pathname = String(path || "").split("?")[0];
    if (pathname === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(pathname);
  };

  const isItemActive = (item) => {
    if (typeof item.activeWhen === "function") return item.activeWhen(location);
    return isActive(item.to);
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

  const showMasterCompanyManagement = employee ? isSuperAdminRole(employee?.role) : false;
  const showPoshManagement = employee ? hasModuleAccess(employee, "posh") : false;
  const sidebarSections = useMemo(
    () => getAdminSidebarSections(showMasterCompanyManagement, showPoshManagement),
    [showMasterCompanyManagement, showPoshManagement]
  );
  const activeSectionKey = sidebarSections.find((section) => section.items.some(isItemActive))?.key || "";

  useEffect(() => {
    if (activeSectionKey) setOpenSection(activeSectionKey);
  }, [activeSectionKey]);

  if (!authReady || !employee) return null;

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
            <div className="w-24 sm:w-64 h-full flex items-center justify-center border-r border-white/10 pr-3 sm:pr-4">
              <Link to="/admin" className="flex items-center shrink-0">
                <MarcomLogo className="h-14 w-14 select-none transition-transform duration-300 hover:scale-110 sm:h-[86px] sm:w-[86px]" />
              </Link>
            </div>
          </div>

          {/* Middle Banner (Desktop only) */}
            <div className="hidden md:flex flex-1 items-center gap-4 px-6 h-full">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white bg-white/10 border border-white/20 shadow-inner">
                <i className="fas fa-cubes text-base"></i>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[24px] font-black uppercase tracking-[0.14em] text-white leading-tight">
                  Company Admin Panel
                </h1>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/95 truncate">
                  Complete CRM System & HRMS
                </p>
              </div>
              <span className="flex-shrink-0 inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase text-white bg-white/15 border border-white/30">
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

            <NotificationDropdown theme="light" unreadCount={unreadChatCount} />

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

              <div className="pt-3 space-y-2">
                {sidebarSections.map((section) => {
                  const sectionActive = section.items.some(isItemActive);
                  return (
                    <SidebarSection
                      key={section.key}
                      section={section}
                      isOpen={openSection === section.key}
                      active={sectionActive}
                      onToggle={() => setOpenSection((current) => (current === section.key ? "" : section.key))}
                      isItemActive={isItemActive}
                      onLinkClick={closeMobileSidebar}
                    />
                  );
                })}
              </div>
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

function SidebarSection({ section, isOpen, active, onToggle, isItemActive, onLinkClick }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`group flex w-full items-center rounded-lg px-3 py-3 text-left text-sm font-black transition-all ${
          active || isOpen
            ? "bg-white text-blue-700 shadow-sm"
            : "text-gray-700 hover:bg-white hover:text-blue-700"
        }`}
      >
        <i className={`${section.icon} mr-3 w-5 text-center text-base ${active || isOpen ? "text-blue-600" : "text-gray-400 group-hover:text-blue-500"}`}></i>
        <span className="min-w-0 flex-1 truncate">{section.label}</span>
        <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-black ${active || isOpen ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
          {section.items.length}
        </span>
        <i className={`fas fa-chevron-down text-xs text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}></i>
      </button>

      {isOpen && (
        <div className="mt-1 space-y-1 border-t border-gray-100 px-1 py-2">
          {section.items.map((item) => (
            <SidebarLink
              key={`${section.key}-${item.to}-${item.label}`}
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={isItemActive(item)}
              onClick={onLinkClick}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({ to, icon, label, active, onClick, compact = false }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center rounded-xl transition-all duration-200 ${compact ? "px-3 py-2.5 text-[13px]" : "px-4 py-3 text-sm"} font-semibold ${
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
      title={label}
      aria-label={label}
      className={`group inline-flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold border transition-all duration-200 ${
        active
          ? "bg-white text-[#2c86ab] border-white shadow-md"
          : "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:-translate-y-0.5"
      }`}
    >
      <i className={`${icon} text-[14px] transition-transform duration-200 group-hover:scale-110`}></i>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
