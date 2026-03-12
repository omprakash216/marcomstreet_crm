import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import CompanyManagement from './pages/CompanyManagement';
import CompanyDetails from './pages/CompanyDetails';
import EmployeeDashboard from './pages/EmployeeDashboard';
import Leads from './pages/Leads';
import Meetings from './pages/Meetings';
import Tasks from './pages/Tasks';
import Followups from './pages/Followups';
import Quotations from './pages/Quotations';
import Invoices from './pages/Invoices';
import History from './pages/History';
import WhatsAppHits from './pages/WhatsAppHits';
import Reports from './pages/Reports';
import SampleReports from './pages/SampleReports';
import ClientHistory from './pages/ClientHistory';
import GroupMeetings from './pages/GroupMeetings';
import Leaves from './pages/hrms/Leaves';
import Attendance from './pages/hrms/Attendance';
import SalarySlips from './pages/hrms/SalarySlips';
import HRDocuments from './pages/hrms/HRDocuments';
import Departments from './pages/hrms/Departments';
import Designations from './pages/hrms/Designations';
import Shifts from './pages/hrms/Shifts';
import Holidays from './pages/hrms/Holidays';
import Announcements from './pages/hrms/Announcements';
import Performance from './pages/hrms/Performance';
import Settings from './pages/hrms/Settings';
import HRReports from './pages/hrms/HRReports';
import Chat from './pages/chat/Chat';
import Notifications from './pages/Notifications';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminApiIntegration from './pages/admin/AdminApiIntegration';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminInsights from './pages/admin/AdminInsights';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminAILeadScore from './pages/admin/AdminAILeadScore';
import AdminTaskAssignment from './pages/admin/AdminTaskAssignment';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminInventory from './pages/admin/AdminInventory';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminExpenses from './pages/admin/AdminExpenses';
import DocumentGenerator from './pages/admin/DocumentGenerator';
import ManagerDashboard from './pages/ManagerDashboard';
import HRDashboard from './pages/HRDashboard';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import { isAuthenticated, getEmployee } from './utils/auth';
import LandingPage from './pages/LandingPage';
import Subscription from './pages/Subscription';
import Payment from './pages/Payment';
import SetPassword from './pages/SetPassword';

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <LandingPage />;
}

function AdminRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  const employee = getEmployee();
  if (employee && employee.role === 'admin') {
    return children;
  }
  return <Navigate to="/" />;
}

function ManagerRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  const employee = getEmployee();
  if (employee && (employee.role === 'admin' || employee.role === 'manager')) {
    return children;
  }
  return <Navigate to="/" />;
}

function HRRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  const employee = getEmployee();
  if (employee && (employee.role === 'admin' || employee.role === 'human_resources')) {
    return children;
  }
  return <Navigate to="/" />;
}

function CompanyRoute({ children }) {
  const companyToken = localStorage.getItem('company_token');
  const company = localStorage.getItem('company');

  if (companyToken && company) {
    return children;
  }
  // Redirect to employee login if company not logged in
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router
      basename={import.meta.env.BASE_URL || '/'}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/subscribe" element={<Subscription />} />
        <Route path="/pay" element={<Payment />} />
        <Route path="/set-password" element={<SetPassword />} />

        {/* Company Routes - Separate from Employee Routes */}
        <Route
          path="/company/details"
          element={
            <CompanyRoute>
              <Layout />
            </CompanyRoute>
          }
        >
          <Route index element={<CompanyDetails />} />
        </Route>

        {/* Manager Routes */}
        <Route
          path="/manager"
          element={
            <ManagerRoute>
              <Layout />
            </ManagerRoute>
          }
        >
          <Route index element={<ManagerDashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="followups" element={<Followups />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="sample-reports" element={<SampleReports />} />
          <Route path="client-history" element={<ClientHistory />} />
          <Route path="group-meetings" element={<GroupMeetings />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="reports" element={<Reports />} />
          <Route path="history" element={<History />} />
          <Route path="whatsapp" element={<WhatsAppHits />} />
          <Route path="hrms/attendance" element={<Attendance />} />
          <Route path="hrms/leaves" element={<Leaves />} />
          <Route path="chat" element={<Chat />} />
          <Route path="calendar" element={<Calendar />} />
        </Route>

        {/* HR Routes */}
        <Route
          path="/hr"
          element={
            <HRRoute>
              <Layout />
            </HRRoute>
          }
        >
          <Route index element={<HRDashboard />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="hrms/attendance" element={<Attendance />} />
          <Route path="hrms/leaves" element={<Leaves />} />
          <Route path="hrms/documents" element={<HRDocuments />} />
          <Route path="hrms/salary" element={<SalarySlips />} />
          <Route path="hrms/departments" element={<Departments />} />
          <Route path="hrms/designations" element={<Designations />} />
          <Route path="hrms/shifts" element={<Shifts />} />
          <Route path="hrms/holidays" element={<Holidays />} />
          <Route path="hrms/announcements" element={<Announcements />} />
          <Route path="hrms/performance" element={<Performance />} />
          <Route path="hrms/settings" element={<Settings />} />
          <Route path="hrms/reports" element={<HRReports />} />
          <Route path="calendar" element={<Calendar />} />
        </Route>

        {/* Employee Routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="followups" element={<Followups />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="sample-reports" element={<SampleReports />} />
          <Route path="client-history" element={<ClientHistory />} />
          <Route path="group-meetings" element={<GroupMeetings />} />
          <Route path="history" element={<History />} />
          <Route path="whatsapp-hits" element={<WhatsAppHits />} />
          <Route path="reports" element={<Reports />} />
          <Route path="company-management" element={<CompanyManagement />} />

          {/* HRMS Routes */}
          <Route path="hrms/leaves" element={<Leaves />} />
          <Route path="hrms/attendance" element={<Attendance />} />
          <Route path="hrms/salary-slips" element={<SalarySlips />} />

          {/* Chat Route */}
          <Route path="chat" element={<Chat />} />

          {/* Notifications Route */}
          <Route path="calendar" element={<Calendar />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="companies" element={<AdminCompanies />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="api-integration" element={<AdminApiIntegration />} />
          <Route path="revenue" element={<AdminRevenue />} />
          <Route path="insights" element={<AdminInsights />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="ai-lead-score" element={<AdminAILeadScore />} />
          <Route path="task-assignment" element={<AdminTaskAssignment />} />
          <Route path="departments" element={<AdminDepartments />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="accounts" element={<AdminAccounts />} />
          <Route path="expenses" element={<AdminExpenses />} />
          <Route path="reports" element={<Reports />} />
          <Route path="generate-document/:employeeId" element={<DocumentGenerator />} />
          <Route path="calendar" element={<Calendar />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
