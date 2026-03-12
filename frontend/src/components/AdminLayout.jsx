import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getEmployee, clearAuth } from "../utils/auth";
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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const emp = getEmployee();
    if (!emp) {
      navigate("/login", { replace: true });
      return;
    }

    if (emp.role !== "admin") {
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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Mobile Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-24 bg-white shadow-lg border-b border-gray-200/50 backdrop-blur-sm z-50 px-4 sm:px-6">
        <div className="h-full flex items-center justify-between max-w-[1600px] mx-auto w-full">
          <div className="flex items-center h-full gap-4">
            <button
              onClick={toggleMobileSidebar}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              <i className="fas fa-bars text-xl"></i>
            </button>
            <div className="w-40 sm:w-64 h-full flex items-center justify-center">
              <Link to="/admin" className="flex items-center shrink-0">
                <MarcomLogo className="w-20 h-20 sm:w-[137px] sm:h-[8rem] transition-transform duration-300 hover:scale-110 select-none" />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Global Attendance Toggle */}
            <div className="hidden xs:block">
              {checkingStatus ? (
                <div className="w-24 h-9 bg-gray-100 animate-pulse rounded-xl"></div>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={checkInLoading || checkedIn}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md group ${checkedIn
                      ? "bg-green-50 text-green-600 border border-green-200 cursor-default"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg active:scale-95"
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

            <NotificationDropdown />

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-3 p-1.5 hover:bg-gray-50 rounded-full transition-all border border-transparent hover:border-gray-200 group"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-shadow">
                  {employee.name ? employee.name.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-800 leading-none mb-1">
                    {employee.name || "Admin"}
                  </p>
                  <p className="text-xs text-gray-500 leading-none">
                    Administrator
                  </p>
                </div>
                <i className={`fas fa-chevron-down text-[10px] text-gray-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`}></i>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{employee.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{employee.email}</p>
                    <div className="mt-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      Primary Admin
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                        <i className="fas fa-sign-out-alt"></i>
                      </div>
                      Logout Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-20 flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-20 left-0 z-40 w-72 h-[calc(100vh-5rem)] bg-white border-r border-gray-200 transition-transform duration-300 transform ${showMobileSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
        >
          <div className="h-full min-h-0 flex flex-col pt-4">
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto pb-8 custom-scrollbar">
              <SidebarLink to="/admin" icon="fas fa-tachometer-alt" label="Dashboard" active={isActive("/admin") && location.pathname === "/admin"} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Core Modules</p>
              </div>

              <SidebarLink to="/admin/calendar" icon="fas fa-calendar-alt" label="Meeting Calendar" active={isActive("/admin/calendar")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/inventory" icon="fas fa-boxes" label="Inventory Mgmt" active={isActive("/admin/inventory")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/accounts" icon="fas fa-university" label="Bank Accounts" active={isActive("/admin/accounts")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/expenses" icon="fas fa-receipt" label="Expenses" active={isActive("/admin/expenses")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/attendance" icon="fas fa-user-clock" label="Attendance" active={isActive("/admin/attendance")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Business Intelligence</p>
              </div>

              <SidebarLink to="/admin/revenue" icon="fas fa-money-bill-wave" label="Revenue & Forecast" active={isActive("/admin/revenue")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/insights" icon="fas fa-lightbulb" label="Smart Insights" active={isActive("/admin/insights")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/ai-lead-score" icon="fas fa-robot" label="AI Lead Scoring" active={isActive("/admin/ai-lead-score")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Operations</p>
              </div>

              <SidebarLink to="/admin/companies" icon="fas fa-building" label="Companies" active={isActive("/admin/companies")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/employees" icon="fas fa-users" label="Employees" active={isActive("/admin/employees")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/departments" icon="fas fa-sitemap" label="Departments" active={isActive("/admin/departments")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/task-assignment" icon="fas fa-tasks" label="Task Assignments" active={isActive("/admin/task-assignment")} onClick={closeMobileSidebar} />

              <div className="pt-4 pb-2">
                <p className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">System</p>
              </div>

              <SidebarLink to="/admin/api-integration" icon="fas fa-plug" label="API Integration" active={isActive("/admin/api-integration")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/reports" icon="fas fa-file-alt" label="System Reports" active={isActive("/admin/reports")} onClick={closeMobileSidebar} />
              <SidebarLink to="/admin/audit-logs" icon="fas fa-history" label="Audit Logs" active={isActive("/admin/audit-logs")} onClick={closeMobileSidebar} />
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-gray-50/50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ to, icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold ${active
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
