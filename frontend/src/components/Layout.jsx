import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getEmployee,
  clearAuth,
  hasCrmModuleAccess,
  hasHrmsModuleAccess,
  hasModuleAccess,
  isPoshManagementRole,
  isHrPortalRole,
  normalizeRole,
} from "../utils/auth";
import api from "../utils/api";
import MarcomLogo from "./MarcomLogo";
import NotificationDropdown from "./NotificationDropdown";

export default function Layout() {
  const [employee, setEmployee] = useState(null);
  const [company, setCompany] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatPollingEnabled, setChatPollingEnabled] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const isCompanyRoute = location.pathname.startsWith("/company/details");
  const isDesigner =
    employee &&
    (employee.role === "designer" ||
      employee.designation?.toLowerCase().includes("designer") ||
      employee.email?.includes(".designer"));
  const role = normalizeRole(employee?.role);
  const canCRM = !isCompanyRoute && employee ? hasCrmModuleAccess(employee) : false;
  const canHRMS = !isCompanyRoute && employee ? hasHrmsModuleAccess(employee) : false;
  const canPOSH = !isCompanyRoute && employee ? hasModuleAccess(employee, "posh") : false;
  const isHRorAdmin = isHrPortalRole(role);
  const isHrPanel = location.pathname.startsWith("/hr");
  const hasPoshManagerAccess = employee ? isPoshManagementRole(employee) : false;
  const showHrManagementNav = isHrPanel && isHrPortalRole(role);
  const showCrmNav = canCRM && !showHrManagementNav;
  const poshPath = isHrPanel || hasPoshManagerAccess ? "/hr/posh" : "/posh";

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      setSessionReady(false);

      if (isCompanyRoute) {
        const companyData = localStorage.getItem("company");
        const companyToken = localStorage.getItem("company_token");

        if (!companyData || !companyToken) {
          navigate("/login", { replace: true });
          return;
        }

        try {
          const parsedCompany = JSON.parse(companyData);
          if (cancelled) return;
          setCompany(parsedCompany);
          setEmployee(null);
          setCheckedIn(false);
          setCheckingStatus(true);
          setUnreadChatCount(0);
          setSessionReady(true);
        } catch (e) {
          console.error("Error parsing company data:", e);
          navigate("/login", { replace: true });
        }
        return;
      }

      const emp = getEmployee();
      if (!emp) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }

      try {
        const response = await api.get("/auth/verify");
        const verifiedEmployee = response.data?.data?.employee;
        if (!verifiedEmployee) {
          throw new Error("Invalid session payload");
        }

        if (cancelled) return;
        setEmployee(verifiedEmployee);
        setCompany(null);
        localStorage.setItem("employee", JSON.stringify(verifiedEmployee));
        setCheckedIn(false);
        setCheckingStatus(true);
        setUnreadChatCount(0);
        setChatPollingEnabled(true);
        setSessionReady(true);
      } catch (error) {
        if (cancelled) return;
        if (error.response?.status === 401) {
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }

        setEmployee(emp);
        setCompany(null);
        setCheckedIn(false);
        setCheckingStatus(true);
        setUnreadChatCount(0);
        setSessionReady(true);
      }
    };

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [navigate, isCompanyRoute]);

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
        return;
      }
    }
  };

  const checkCheckInStatus = async () => {
    if (isCompanyRoute) return;

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
      if (error.response?.status === 401) {
        setCheckedIn(false);
      } else if (error.code === "ERR_NETWORK") {
        setCheckedIn(false);
      } else if (error.response?.status === 404) {
        setCheckedIn(false);
      }
      if (error.response?.status && error.response.status !== 401 && error.response.status !== 404) {
        console.error("Check status error:", error);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (isCompanyRoute || !sessionReady || !employee) return;

    setCheckingStatus(true);
    setCheckedIn(false);
    checkCheckInStatus();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [employee, isCompanyRoute, sessionReady, chatPollingEnabled]);

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    try {
      // Get location if available
      let location = "Office";
      let latitude = null;
      let longitude = null;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            location = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(
              4
            )}`;
          },
          () => {
            // Location denied or unavailable
          }
        );
      }

      await api.post("/checkin/checkin", {
        location,
        latitude,
        longitude,
      });

      setCheckedIn(true);
      setShowProfileDropdown(false);
      alert("Check-in successful!");
    } catch (error) {
      alert(error.response?.data?.message || "Check-in failed");
    } finally {
      setCheckInLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showProfileDropdown &&
        !event.target.closest(".profile-dropdown-container")
      ) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileDropdown]);

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    // Exact match for company routes to avoid conflicts
    if (path === "/company-management" || path === "/company/details") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    if (isCompanyRoute) {
      // Company logout
      localStorage.removeItem("company_token");
      localStorage.removeItem("company");
      navigate("/login", { replace: true });
    } else {
      // Employee logout
      try {
        await api.post("/auth/logout");
      } catch (error) {
        // Silently handle logout errors - still logout locally
        // Don't log 404 errors (endpoint might not be accessible)
        if (error.response?.status && error.response.status !== 404) {
          console.error("Logout error:", error);
        }
      }
      clearAuth();
      navigate("/login", { replace: true });
    }
  };

  // Don't render if not authenticated
  if (!sessionReady) return null;
  if (isCompanyRoute && !company) return null;
  if (!isCompanyRoute && !employee) return null;

  const panelInfo = getPanelHeaderInfo({ isCompanyRoute, company, employee, pathname: location.pathname });
  const accountInitial = isCompanyRoute
    ? (company?.company_name || "C").charAt(0).toUpperCase()
    : (employee?.name || "E").charAt(0).toUpperCase();
  const accountName = isCompanyRoute
    ? company?.company_name || "Company"
    : employee?.name || "Employee";
  const accountEmail = isCompanyRoute
    ? company?.email || "Company Email"
    : employee?.email || "Employee Email";
  const accountRoleLabel = isCompanyRoute ? "Company" : employee?.role || "Employee";
  const portalHome = getPanelHomePath({ isCompanyRoute, pathname: location.pathname });
  const calendarPath = getPanelCalendarPath(location.pathname);
  const chatPath = getPanelChatPath(location.pathname);

  return (
    // Keep navbar + sidebar fixed; only the main content scrolls.
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Shared panel header (matches Company Admin) */}
      <header className="fixed top-0 left-0 right-0 h-24 bg-[#2c86ab] shadow-lg border-b border-[#247596] backdrop-blur-sm z-50 px-4 sm:px-6 overflow-visible">
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
            <div className="w-40 sm:w-64 h-full flex items-center justify-center border-r border-white/10 pr-4">
              <Link to={portalHome} className="flex items-center shrink-0">
                <MarcomLogo className="w-[86px] h-[86px] transition-transform duration-300 hover:scale-110 select-none" />
              </Link>
            </div>
          </div>

            <div className="hidden md:flex flex-1 items-center gap-4 px-6 h-full">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white bg-white/10 border border-white/20 shadow-inner">
                <i className={`fas ${panelInfo.icon} text-base`}></i>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[24px] font-black uppercase tracking-[0.14em] text-white leading-tight">
                  {panelInfo.title}
                </h1>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/95 truncate">
                  {panelInfo.subtitle}
                </p>
              </div>
              <span className="flex-shrink-0 inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase text-white bg-white/15 border border-white/30">
                {panelInfo.badge}
              </span>
            </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {!isCompanyRoute && (
              <div className="hidden xl:flex items-center gap-2">
                <TopNavButton to={portalHome} icon="fas fa-home" label="Home" />
                <TopNavButton to={calendarPath} icon="fas fa-calendar-alt" label="Calendar" />
                <TopNavButton to={chatPath} icon="fas fa-comments" label="Chat" />
              </div>
            )}

            {!isCompanyRoute && <NotificationDropdown theme="light" unreadCount={unreadChatCount} />}

            {/* Profile Dropdown */}
            <div className="relative profile-dropdown-container z-[9999]">
              <button
                type="button"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                aria-haspopup="menu"
                aria-expanded={showProfileDropdown}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 relative z-[9999]"
              >
                <div className="w-10 h-10 rounded-full bg-white text-[#2c86ab] flex items-center justify-center text-sm font-bold shadow-md hover:shadow-lg transition-shadow">
                  {accountInitial}
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

              {/* Dropdown Menu */}
              {showProfileDropdown && (
                <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[10000]">
                  {/* User Info Section */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md">
                        {accountInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {accountName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {accountEmail}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {accountRoleLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info for Employee */}
                  {!isCompanyRoute && employee && (
                    <div className="px-4 py-2 border-b border-gray-200">
                      {employee.employee_code && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-500">
                            Employee Code:
                          </span>
                          <span className="text-xs font-medium text-gray-900">
                            {employee.employee_code}
                          </span>
                        </div>
                      )}
                      {employee.phone && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-500">
                            Phone:
                          </span>
                          <span className="text-xs font-medium text-gray-900">
                            {employee.phone}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Info for Company */}
                  {isCompanyRoute && company && (
                    <div className="px-4 py-2 border-b border-gray-200">
                      {company.company_code && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-500">
                            Company Code:
                          </span>
                          <span className="text-xs font-medium text-gray-900">
                            {company.company_code}
                          </span>
                        </div>
                      )}
                      {company.client_code && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-500">
                            Client Code:
                          </span>
                          <span className="text-xs font-medium text-gray-900">
                            {company.client_code}
                          </span>
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-gray-500">
                            Phone:
                          </span>
                          <span className="text-xs font-medium text-gray-900">
                            {company.phone}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Check-In Section for Employees */}
                  {!isCompanyRoute && (
                    <div className="px-4 py-2 border-b border-gray-200">
                      {checkingStatus ? (
                        <div className="flex items-center justify-center py-2">
                          <div className="text-xs text-gray-500">
                            Loading check-in status...
                          </div>
                        </div>
                      ) : checkedIn ? (
                        <div className="flex items-center justify-between py-2 px-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span className="text-xs font-medium text-green-700">
                              Checked In
                            </span>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCheckIn}
                          disabled={checkInLoading}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg"
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>
                            {checkInLoading ? "Checking In..." : "Check In"}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Logout Button */}
                  <div className="px-2 py-2">
                    <button
                      type="button"
                      onClick={handleLogout}
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
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Fixed Sidebar + Scrollable Main Content */}
      <div className="pt-24 h-full">
        {/* Sidebar (fixed) */}
        <aside className="fixed top-24 left-0 bottom-0 w-64 bg-white border-r border-gray-200/50 shadow-sm flex flex-col z-40">
          <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
            {isCompanyRoute ? (
              // Company-specific navigation
              <Link
                to="/company/details"
                className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${location.pathname === "/company/details"
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                  : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                  }`}
              >
                <svg
                  className={`w-5 h-5 mr-3 ${location.pathname === "/company/details"
                    ? "text-white"
                    : "text-gray-500 group-hover:text-blue-600"
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Company Details</span>
                {location.pathname === "/company/details" && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                )}
              </Link>
            ) : (
              // Employee navigation
              <>
                {/* Dashboard (Common for all employees) */}
                <Link
                  to={portalHome}
                  className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive(portalHome)
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                    }`}
                >
                  <svg
                    className={`w-5 h-5 mr-3 ${isActive(portalHome)
                      ? "text-white"
                      : "text-gray-500 group-hover:text-blue-600"
                      }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  <span>Dashboard</span>
                  {isActive(portalHome) && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                  )}
                </Link>

                <Link
                  to={calendarPath}
                  className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive(calendarPath)
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                    }`}
                >
                  <svg
                    className={`w-5 h-5 mr-3 ${isActive(calendarPath)
                      ? "text-white"
                      : "text-gray-500 group-hover:text-blue-600"
                      }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Calendar</span>
                  {isActive(calendarPath) && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                  )}
                </Link>

                {canPOSH && (
                  <Link
                    to={poshPath}
                    className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive(poshPath)
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                      : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                      }`}
                  >
                    <svg
                      className={`w-5 h-5 mr-3 ${isActive(poshPath)
                        ? "text-white"
                        : "text-gray-500 group-hover:text-blue-600"
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3l7 4v5c0 4.5-3 8.5-7 9-4-0.5-7-4.5-7-9V7l7-4z"
                      />
                    </svg>
                    <span>{hasPoshManagerAccess ? "POSH Management" : "POSH Portal"}</span>
                    {isActive(poshPath) && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </Link>
                )}


                {/* Sales Features - Hidden for HR and Designers */}
                {showCrmNav && !isDesigner && (
                  <>
                    <Link
                      to="/leads"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/leads")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/leads")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span>Leads</span>
                      {isActive("/leads") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/meetings"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/meetings")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/meetings")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Meetings</span>
                      {isActive("/meetings") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/tasks"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/tasks")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/tasks")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                      <span>Tasks</span>
                      {isActive("/tasks") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/followups"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/followups")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/followups")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Follow-ups</span>
                      {isActive("/followups") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/quotations"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/quotations")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/quotations")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>Quotations</span>
                      {isActive("/quotations") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/sample-reports"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/sample-reports")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/sample-reports")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>Semple Reports</span>
                      {isActive("/sample-reports") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>
                    <Link
                      to="/client-history"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/client-history")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/client-history")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>Client History</span>
                      {isActive("/client-history") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>
                    <Link
                      to="/group-meetings"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/group-meetings")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/group-meetings")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>Group Meeting</span>
                      {isActive("/group-meetings") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Invoices - Only for Admin and Manager */}
                    {hasModuleAccess(employee, "invoices") && (
                        <Link
                          to="/invoices"
                          className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/invoices")
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                            : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                            }`}
                        >
                          <svg
                            className={`w-5 h-5 mr-3 ${isActive("/invoices")
                              ? "text-white"
                              : "text-gray-500 group-hover:text-blue-600"
                              }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
                            />
                          </svg>
                          <span>Invoices</span>
                          {isActive("/invoices") && (
                            <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                          )}
                        </Link>
                      )}
                  </>
                )}

                {/* Common Navigation (Non-HR Users) */}
                {!showHrManagementNav && !isDesigner && (
                  <>
                    <Link
                      to={chatPath}
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive(chatPath)
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <div className="relative">
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive(chatPath)
                            ? "text-white"
                            : "text-gray-500 group-hover:text-blue-600"
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        {unreadChatCount > 0 && !isActive(chatPath) && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadChatCount > 9 ? "9+" : unreadChatCount}
                          </span>
                        )}
                      </div>
                      <span>Team Chat</span>
                      {isActive(chatPath) && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {canCRM && (
                      <Link
                        to="/history"
                        className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/history")
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                          : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                          }`}
                      >
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive("/history")
                            ? "text-white"
                            : "text-gray-500 group-hover:text-blue-600"
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>History</span>
                        {isActive("/history") && (
                          <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </Link>
                    )}

                    {canHRMS && (
                      <>
                        {/* HRMS Section for Regular Employees */}
                        <div className="pt-4 pb-2">
                          <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            HRMS
                          </p>
                        </div>
                        <Link
                          to="/hrms/leaves"
                          className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/leaves")
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                            : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                            }`}
                        >
                          <svg className={`w-5 h-5 mr-3 ${isActive("/hrms/leaves") ? "text-white" : "text-gray-500 group-hover:text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Leaves</span>
                        </Link>
                        <Link
                          to="/hrms/attendance"
                          className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/attendance")
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                            : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                            }`}
                        >
                          <svg className={`w-5 h-5 mr-3 ${isActive("/hrms/attendance") ? "text-white" : "text-gray-500 group-hover:text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Attendance</span>
                        </Link>
                        <Link
                          to="/hrms/salary-slips"
                          className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/salary-slips")
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                            : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                            }`}
                        >
                          <svg className={`w-5 h-5 mr-3 ${isActive("/hrms/salary-slips") ? "text-white" : "text-gray-500 group-hover:text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Salary Slips</span>
                        </Link>
                        {isHRorAdmin && (
                          <Link
                            to="/hrms/documents"
                            className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/documents")
                              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                              }`}
                          >
                            <svg className={`w-5 h-5 mr-3 ${isActive("/hrms/documents") ? "text-white" : "text-gray-500 group-hover:text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>HR Documents</span>
                          </Link>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Designer Section */}
                {isDesigner && canCRM && !showHrManagementNav && (
                  <>
                    <Link
                      to="/tasks"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/tasks") && !location.search.includes("pending")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/tasks") && !location.search.includes("pending")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                      <span>My Tasks</span>
                      {isActive("/tasks") && !location.search.includes("pending") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/followups"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/followups")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/followups")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Work Follow-up</span>
                      {isActive("/followups") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/tasks?filter=pending"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${location.pathname === "/tasks" && location.search.includes("pending")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${location.pathname === "/tasks" && location.search.includes("pending")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span>Pending Tasks</span>
                      {location.pathname === "/tasks" && location.search.includes("pending") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/group-meetings"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/group-meetings")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/group-meetings")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span>Group Meetings</span>
                      {isActive("/group-meetings") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* HRMS Section for Designers */}
                    <div className="pt-4 pb-2">
                      <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        HRMS
                      </p>
                    </div>

                    <Link
                      to="/hrms/leaves"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/leaves")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hrms/leaves")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Leaves</span>
                      {isActive("/hrms/leaves") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/hrms/attendance"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/attendance")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hrms/attendance")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Attendance</span>
                      {isActive("/hrms/attendance") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    <Link
                      to="/hrms/salary-slips"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/salary-slips")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hrms/salary-slips")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Salary Slips</span>
                      {isActive("/hrms/salary-slips") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {isHRorAdmin && (
                      <Link
                        to="/hrms/documents"
                        className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hrms/documents")
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                          : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                          }`}
                      >
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive("/hrms/documents")
                            ? "text-white"
                            : "text-gray-500 group-hover:text-blue-600"
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>HR Documents</span>
                        {isActive("/hrms/documents") && (
                          <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </Link>
                    )}

                    <Link
                      to={chatPath}
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive(chatPath)
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <div className="relative">
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive(chatPath)
                            ? "text-white"
                            : "text-gray-500 group-hover:text-blue-600"
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        {unreadChatCount > 0 && !isActive(chatPath) && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadChatCount > 9 ? "9+" : unreadChatCount}
                          </span>
                        )}
                      </div>
                      <span>Team Chat</span>
                      {isActive(chatPath) && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>
                  </>
                )}

                {/* HR Users see only HR workflow options */}
                {showHrManagementNav && (
                  <>
                    {/* <div className="pt-4 pb-2">
                      <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        HR Management
                      </p>
                    </div> */}

                    {/* Employee Management */}
                    <Link
                      to="/hr/employees"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/employees")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/employees")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span>Employee Details </span>
                      {isActive("/hr/employees") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Attendance Policy & Monitoring */}
                    <Link
                      to="/hr/hrms/attendance"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/attendance")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/attendance")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Attendance Policy </span>
                      {isActive("/hr/hrms/attendance") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Leave Type & Rules Management */}
                    <Link
                      to="/hr/hrms/leaves"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/leaves")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/leaves")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Leave Type & Rules </span>
                      {isActive("/hr/hrms/leaves") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Salary Structure & Salary Slip Generation */}
                    <Link
                      to="/hr/hrms/salary"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/salary")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/salary")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Salary Slip</span>
                      {isActive("/hr/hrms/salary") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Offer Letter & HR Document Generation */}
                    <Link
                      to="/hr/hrms/documents"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/documents")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/documents")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span> HR Documents</span>
                      {isActive("/hr/hrms/documents") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Departments */}
                    <Link
                      to="/hr/hrms/departments"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/departments")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/departments")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7h6l2 2h10v9a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z"
                        />
                      </svg>
                      <span>Departments</span>
                      {isActive("/hr/hrms/departments") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Designations */}
                    <Link
                      to="/hr/hrms/designations"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/designations")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/designations")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m4-8a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Designations</span>
                      {isActive("/hr/hrms/designations") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Shifts */}
                    <Link
                      to="/hr/hrms/shifts"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/shifts")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/shifts")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Shift Management</span>
                      {isActive("/hr/hrms/shifts") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Holidays */}
                    <Link
                      to="/hr/hrms/holidays"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/holidays")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/holidays")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Holidays</span>
                      {isActive("/hr/hrms/holidays") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Performance */}
                    <Link
                      to="/hr/hrms/performance"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/performance")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/performance")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Performance</span>
                      {isActive("/hr/hrms/performance") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Announcements */}
                    <Link
                      to="/hr/hrms/announcements"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/announcements")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/announcements")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1 0v14m-7-7h14" />
                      </svg>
                      <span>Announcements</span>
                      {isActive("/hr/hrms/announcements") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Settings */}
                    <Link
                      to="/hr/hrms/settings"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/settings")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/settings")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.105 0-2 .895-2 2s.895 2 2 2 2-.895 2-2-.895-2-2-2zm7.4 2a7.4 7.4 0 01-.2 1.7l2 1.5-2 3.5-2.3-1a7.4 7.4 0 01-2.9 1.7l-.3 2.4H10l-.3-2.4a7.4 7.4 0 01-2.9-1.7l-2.3 1-2-3.5 2-1.5a7.4 7.4 0 01-.2-1.7 7.4 7.4 0 01.2-1.7l-2-1.5 2-3.5 2.3 1a7.4 7.4 0 012.9-1.7L10 3h4l.3 2.4a7.4 7.4 0 012.9 1.7l2.3-1 2 3.5-2 1.5c.1.6.2 1.1.2 1.7z" />
                      </svg>
                      <span>Settings</span>
                      {isActive("/hr/hrms/settings") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* HR Reports */}
                    <Link
                      to="/hr/hrms/reports"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/reports")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/reports")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>HR Reports</span>
                      {isActive("/hr/hrms/reports") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Joining QR Generator */}
                    <Link
                      to="/hr/hrms/joining-qr"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/joining-qr")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/joining-qr")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M4 8h16M4 16h16M4 4h16"
                        />
                      </svg>
                      <span>Joining QR Link</span>
                      {isActive("/hr/hrms/joining-qr") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Joining Submissions */}
                    <Link
                      to="/hr/hrms/joining-submissions"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/hr/hrms/joining-submissions")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/hr/hrms/joining-submissions")
                          ? "text-white"
                          : "text-gray-500 group-hover:text-blue-600"
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                        />
                      </svg>
                      <span>Joining Requests</span>
                      {isActive("/hr/hrms/joining-submissions") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Team Chat - Grouped with HR Management */}
                    <Link
                      to={chatPath}
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive(chatPath)
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <div className="relative">
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive(chatPath)
                            ? "text-white"
                            : "text-gray-500 group-hover:text-blue-600"
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        {unreadChatCount > 0 && !isActive(chatPath) && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadChatCount > 9 ? "9+" : unreadChatCount}
                          </span>
                        )}
                      </div>
                      <span>Team Chat</span>
                      {isActive(chatPath) && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {canCRM && !showHrManagementNav && (
                      <Link
                        to="/history"
                        className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/history")
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                          : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                          }`}
                      >
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive("/history")
                            ? "text-white"
                            : "text-gray-500 group-hover:text-blue-600"
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>History</span>
                        {isActive("/history") && (
                          <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </Link>
                    )}
                  </>
                )}
              </>
            )}
          </nav>
        </aside>

        {/* Main Content Area (scroll only here) */}
        <div className="ml-64 h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden">
          <main className="p-6 lg:p-8 min-h-full">
            <div>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div >
  );
}

function getPanelHeaderInfo({ isCompanyRoute, company, employee, pathname }) {
  if (isCompanyRoute) {
    return {
      title: company?.company_name || "Company Portal",
      subtitle: "Company profile, leads and business overview",
      badge: "Company",
      icon: "fa-building",
    };
  }

  if (pathname.startsWith("/manager")) {
    return {
      title: "Manager Panel",
      subtitle: "Team pipeline, tasks and performance control",
      badge: "Manager",
      icon: "fa-chart-bar",
    };
  }

  if (pathname.startsWith("/hr")) {
    return {
      title: "HR Portal",
      subtitle: "Human resources, attendance and employee operations",
      badge: "HRMS",
      icon: "fa-users",
    };
  }

  if (pathname.startsWith("/designer-manager")) {
    return {
      title: "Designer Manager Panel",
      subtitle: "Creative tasks, delivery and team coordination",
      badge: "Design",
      icon: "fa-palette",
    };
  }

  return {
    title: employee?.name ? `${employee.name}'s Dashboard` : "Employee Portal",
    subtitle: "CRM, tasks, follow-ups and personal workflow",
    badge: "Employee",
    icon: "fa-user",
  };
}

function getPanelHomePath({ isCompanyRoute, pathname }) {
  if (isCompanyRoute) return "/company/details";
  if (pathname.startsWith("/manager")) return "/manager";
  if (pathname.startsWith("/hr")) return "/hr";
  if (pathname.startsWith("/designer-manager")) return "/designer-manager";
  return "/";
}

function getPanelCalendarPath(pathname) {
  if (pathname.startsWith("/manager")) return "/manager/calendar";
  if (pathname.startsWith("/hr")) return "/hr/calendar";
  if (pathname.startsWith("/designer-manager")) return "/designer-manager/calendar";
  return "/calendar";
}

function getPanelChatPath(pathname) {
  if (pathname.startsWith("/manager")) return "/manager/chat";
  if (pathname.startsWith("/hr")) return "/hr/chat";
  if (pathname.startsWith("/designer-manager")) return "/designer-manager/chat";
  return "/chat";
}

function TopNavButton({ to, icon, label }) {
  const location = useLocation();
  const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

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
