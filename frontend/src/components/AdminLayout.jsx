import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { getEmployee, clearAuth } from "../utils/auth";
import api from "../utils/api";
import MarcomLogo from "./MarcomLogo";
import NotificationDropdown from "./NotificationDropdown";

export default function AdminLayout() {
  const [employee, setEmployee] = useState(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const emp = getEmployee();
    if (!emp) {
      navigate("/login", { replace: true });
      return;
    }

    // Check if user is admin
    if (emp.role !== "admin") {
      navigate("/", { replace: true });
      return;
    }

    setEmployee(emp);
  }, [navigate]);

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
      // Silently handle logout errors - still logout locally
      // Don't log 404 errors (endpoint might not be accessible)
      if (error.response?.status && error.response.status !== 404) {
        console.error("Logout error:", error);
      }
    }
    clearAuth();
    navigate("/login", { replace: true });
  };

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  const closeMobileSidebar = () => {
    setShowMobileSidebar(false);
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Mobile Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-60 z-40 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="max-w-full px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1 h-full">
              {/* Branding Integrated with Sidebar Width */}
              <div className="w-20 sm:w-64 h-full border-r border-gray-100 flex items-center justify-center px-4 sm:px-6 relative z-50">
                <MarcomLogo className="w-20 h-20 sm:w-[137px] sm:h-[8rem] transition-transform duration-300 hover:scale-110 select-none" />
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={toggleMobileSidebar}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors mr-2 flex-shrink-0"
              >
                <i className="fas fa-bars text-gray-700 text-lg"></i>
              </button>

              {/* Admin Badge */}
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-100 rounded-lg border border-blue-200 ml-2">
                <i className="fas fa-user-shield text-blue-600 text-sm"></i>
                <span className="text-xs sm:text-sm font-semibold text-blue-700 hidden sm:inline">
                  Admin Panel
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Notifications */}
              <NotificationDropdown />

              {/* User Profile */}
              <div className="flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-4 border-l border-gray-200">
                <div className="text-right hidden sm:block">
                  <p className="text-xs sm:text-sm font-semibold text-gray-800">
                    {employee.name || "Admin"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {employee.email || ""}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-md">
                  {employee.name ? employee.name.charAt(0).toUpperCase() : "A"}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <i className="fas fa-sign-out-alt text-red-600"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed lg:fixed top-24 left-0 z-50 w-64 flex-shrink-0 bg-white border-r border-gray-200 shadow-lg lg:shadow-sm flex flex-col h-[calc(100vh-6rem)] transition-transform duration-300 ${showMobileSidebar
          ? "translate-x-0"
          : "-translate-x-full lg:translate-x-0"
          }`}
      >

        {/* Header Label for Mobile */}
        <div className="lg:hidden flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Admin Menu</h2>
          <button
            onClick={closeMobileSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="fas fa-times text-gray-700"></i>
          </button>
        </div>

        <nav className="p-3 sm:p-4 space-y-1 overflow-y-auto flex-1">
          <Link
            to="/admin"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin") && location.pathname === "/admin"
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-tachometer-alt w-5 mr-3 flex-shrink-0 ${isActive("/admin") && location.pathname === "/admin"
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Admin Dashboard</span>
            {isActive("/admin") && location.pathname === "/admin" && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>
          <Link
            to="/admin/calendar"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/calendar")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-calendar-alt w-5 mr-3 flex-shrink-0 ${isActive("/admin/calendar")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Meeting Calendar</span>
            {isActive("/admin/calendar") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>


          <Link
            to="/admin/api-integration"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/api-integration")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-code w-5 mr-3 flex-shrink-0 ${isActive("/admin/api-integration")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">API Integration</span>
            {isActive("/admin/api-integration") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/revenue"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/revenue")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-chart-line w-5 mr-3 flex-shrink-0 ${isActive("/admin/revenue")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Revenue & Forecast</span>
            {isActive("/admin/revenue") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/insights"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/insights")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-chart-bar w-5 mr-3 flex-shrink-0 ${isActive("/admin/insights")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Dashboard Insights</span>
            {isActive("/admin/insights") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/attendance"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/attendance")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-calendar-check w-5 mr-3 flex-shrink-0 ${isActive("/admin/attendance")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Attendance Dashboard</span>
            {isActive("/admin/attendance") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/ai-lead-score"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/ai-lead-score")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-robot w-5 mr-3 flex-shrink-0 ${isActive("/admin/ai-lead-score")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">AI Guidance Lead Score</span>
            {isActive("/admin/ai-lead-score") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/task-assignment"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/task-assignment")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-tasks w-5 mr-3 flex-shrink-0 ${isActive("/admin/task-assignment")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Task Assignment</span>
            {isActive("/admin/task-assignment") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/companies"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/companies")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-building w-5 mr-3 flex-shrink-0 ${isActive("/admin/companies")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Company Management</span>
            {isActive("/admin/companies") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/employees"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/employees")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-user-tie w-5 mr-3 flex-shrink-0 ${isActive("/admin/employees")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Employee Management</span>
            {isActive("/admin/employees") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/departments"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/departments")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-sitemap w-5 mr-3 flex-shrink-0 ${isActive("/admin/departments")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Department Management</span>
            {isActive("/admin/departments") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/reports"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/reports")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-chart-bar w-5 mr-3 flex-shrink-0 ${isActive("/admin/reports")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Reports</span>
            {isActive("/admin/reports") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>
          <Link
            to="/admin/ai-lead-score"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/ai-lead-score")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-robot w-5 mr-3 flex-shrink-0 ${isActive("/admin/ai-lead-score")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">AI Lead Scoring</span>
            {isActive("/admin/ai-lead-score") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/attendance"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/attendance")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-user-clock w-5 mr-3 flex-shrink-0 ${isActive("/admin/attendance")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Attendance Tracking</span>
            {isActive("/admin/attendance") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>

          <Link
            to="/admin/audit-logs"
            onClick={closeMobileSidebar}
            className={`group flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive("/admin/audit-logs")
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 font-semibold"
              : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
              }`}
          >
            <i
              className={`fas fa-history w-5 mr-3 flex-shrink-0 ${isActive("/admin/audit-logs")
                ? "text-white"
                : "text-gray-500 group-hover:text-blue-600"
                }`}
            ></i>
            <span className="truncate">Audit Logs</span>
            {isActive("/admin/audit-logs") && (
              <div className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"></div>
            )}
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="main-content-wrapper flex-1 min-w-0 bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 lg:ml-64 pt-24 overflow-x-hidden">
        <main className="p-3 sm:p-4 lg:p-6 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
