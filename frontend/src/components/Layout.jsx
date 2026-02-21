import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { getEmployee, clearAuth } from "../utils/auth";
import api from "../utils/api";
import MarcomLogo from "./MarcomLogo";
import NotificationDropdown from "./NotificationDropdown";

export default function Layout() {
  const [employee, setEmployee] = useState(null);
  const [company, setCompany] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === "/";
  const isCompanyRoute = location.pathname.startsWith("/company/details");
  const isDesigner =
    employee &&
    (employee.role === "designer" ||
      employee.designation?.toLowerCase().includes("designer") ||
      employee.email?.includes(".designer"));

  useEffect(() => {
    if (isCompanyRoute) {
      // Handle company routes
      const companyData = localStorage.getItem("company");
      const companyToken = localStorage.getItem("company_token");

      if (!companyData || !companyToken) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        setCompany(JSON.parse(companyData));
      } catch (e) {
        console.error("Error parsing company data:", e);
        navigate("/login", { replace: true });
      }
    } else {
      // Handle employee routes
      const emp = getEmployee();
      if (!emp) {
        navigate("/login", { replace: true });
        return;
      }
      setEmployee(emp);
      // Check check-in status for employees (only if logged in)
      if (emp && !isCompanyRoute) {
        checkCheckInStatus();
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 10000);
        return () => clearInterval(interval);
      }
    }
  }, [navigate, isCompanyRoute]);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/chat?action=unread_count");
      if (response.data.success) {
        setUnreadChatCount(response.data.count);
      }
    } catch (error) {
      // Silently fail for most errors, but handle 401 (Unauthorized)
      if (error.response?.status === 401) {
        // Token is invalid/expired - force logout to stop the polling loop
        clearAuth();
        navigate("/login", { replace: true });
      }
    }
  };

  const checkCheckInStatus = async () => {
    if (isCompanyRoute) return;

    // Only check if employee is logged in and token exists
    const token = localStorage.getItem("token");
    if (!token) {
      setCheckingStatus(false);
      return;
    }

    try {
      const response = await api.get("/checkin/status");
      if (response.data && response.data.success) {
        setCheckedIn(response.data.data?.checked_in || false);
      }
    } catch (error) {
      // Silently handle errors - don't log expected 401 or network errors
      if (error.response?.status === 401) {
        // User not authenticated - this is expected if not logged in
        setCheckedIn(false);
      } else if (error.code === "ERR_NETWORK") {
        // Backend not available - silently fail
        setCheckedIn(false);
      } else if (error.response?.status === 404) {
        // Endpoint not found - silently fail (might be API routing issue)
        setCheckedIn(false);
      }
      // Only log unexpected errors (not 401, 404, or network errors)
      if (
        error.response?.status &&
        error.response.status !== 401 &&
        error.response.status !== 404
      ) {
        console.error("Check status error:", error);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

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
  if (isCompanyRoute && !company) return null;
  if (!isCompanyRoute && !employee) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Professional Header */}
      <header className="bg-white shadow-lg border-b border-gray-200/50 backdrop-blur-sm relative z-40">
        <div className="max-w-full">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center h-full">
              {/* Branding Integrated with Sidebar Width */}
              <div className="w-40 sm:w-64 h-full border-r border-gray-100 flex items-center justify-center px-4 sm:px-6 relative z-50">
                <MarcomLogo className="w-20 h-20 sm:w-[137px] sm:h-[8rem] transition-transform duration-300 hover:scale-110 select-none" />
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4 relative z-50">
              {/* Notification Bell */}
              {!isCompanyRoute && (
                <Link
                  to="/notifications"
                  className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
                  title="Notifications"
                >
                  <svg
                    className={`w-7 h-7 transition-colors ${unreadChatCount > 0 ? "text-blue-600" : "text-gray-500 group-hover:text-blue-600"
                      }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadChatCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg border-2 border-white animate-pulse">
                      {unreadChatCount > 9 ? "9+" : unreadChatCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Profile Dropdown */}
              <div className="relative profile-dropdown-container z-[9999]">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 relative z-[9999]"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md hover:shadow-lg transition-shadow">
                    {isCompanyRoute
                      ? company
                        ? company.company_name.charAt(0).toUpperCase()
                        : "C"
                      : employee
                        ? employee.name.charAt(0).toUpperCase()
                        : "E"}
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? "rotate-180" : ""
                      }`}
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
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[9999]">
                    {/* User Info Section */}
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md">
                          {isCompanyRoute
                            ? company
                              ? company.company_name.charAt(0).toUpperCase()
                              : "C"
                            : employee
                              ? employee.name.charAt(0).toUpperCase()
                              : "E"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {isCompanyRoute
                              ? company
                                ? company.company_name
                                : "Company"
                              : employee
                                ? employee.name
                                : "Employee"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {isCompanyRoute
                              ? company?.email || "Company Email"
                              : employee?.email || "Employee Email"}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {isCompanyRoute
                              ? "Company"
                              : employee?.role || "Employee"}
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
        </div>
      </header>

      {/* Professional Sidebar Navigation */}
      <div className="flex">
        <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200/50 shadow-sm min-h-[calc(100vh-6rem)] flex flex-col">
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
                  to="/"
                  className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/")
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                    }`}
                >
                  <svg
                    className={`w-5 h-5 mr-3 ${isActive("/")
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
                  {isActive("/") && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                  )}
                </Link>

                <Link
                  to="/calendar"
                  className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/calendar")
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                    }`}
                >
                  <svg
                    className={`w-5 h-5 mr-3 ${isActive("/calendar")
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
                  {isActive("/calendar") && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                  )}
                </Link>


                {/* Sales Features - Hidden for HR and Designers */}
                {!isDesigner && employee?.role !== "human_resources" && (
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
                    {(employee?.role === "admin" ||
                      employee?.role === "manager") && (
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
                {employee?.role !== "human_resources" && !isDesigner && (
                  <>
                    <Link
                      to="/chat"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/chat")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <div className="relative">
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive("/chat")
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
                        {unreadChatCount > 0 && !isActive("/chat") && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadChatCount > 9 ? "9+" : unreadChatCount}
                          </span>
                        )}
                      </div>
                      <span>Team Chat</span>
                      {isActive("/chat") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

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
                  </>
                )}

                {/* Designer Section */}
                {isDesigner && (
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

                    <Link
                      to="/chat"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/chat")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <div className="relative">
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive("/chat")
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
                        {unreadChatCount > 0 && !isActive("/chat") && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadChatCount > 9 ? "9+" : unreadChatCount}
                          </span>
                        )}
                      </div>
                      <span>Team Chat</span>
                      {isActive("/chat") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>
                  </>
                )}

                {/* HR Users see only HR workflow options */}
                {employee?.role === "human_resources" && (
                  <>
                    <div className="pt-4 pb-2">
                      <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        HR Management
                      </p>
                    </div>

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
                      <span>Employee Management</span>
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
                      <span>Attendance Policy & Monitoring</span>
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
                      <span>Leave Type & Rules Management</span>
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
                      <span>Salary Structure & Slips</span>
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
                      <span>Offer Letters & HR Documents</span>
                      {isActive("/hr/hrms/documents") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* HR Reports */}
                    <Link
                      to="/reports"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/reports")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <svg
                        className={`w-5 h-5 mr-3 ${isActive("/reports")
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
                      <span>HR Reports (Attendance, Leave, Salary)</span>
                      {isActive("/reports") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

                    {/* Team Chat - Grouped with HR Management */}
                    <Link
                      to="/chat"
                      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive("/chat")
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                        }`}
                    >
                      <div className="relative">
                        <svg
                          className={`w-5 h-5 mr-3 ${isActive("/chat")
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
                        {unreadChatCount > 0 && !isActive("/chat") && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadChatCount > 9 ? "9+" : unreadChatCount}
                          </span>
                        )}
                      </div>
                      <span>Team Chat</span>
                      {isActive("/chat") && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>

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
                        Express content from lines 1450 to 1455
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
                  </>
                )}
              </>
            )}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <main className="p-6 lg:p-8">
            <div>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div >
  );
}
