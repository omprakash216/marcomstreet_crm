import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ForgotPasswordEmail from './pages/ForgotPasswordEmail';
import VerifyEmailOtp from './pages/VerifyEmailOtp';
import ResetPasswordEmail from './pages/ResetPasswordEmail';
import SuperAdminCompanyManagement from './pages/superadmin/CompanyManagement';
import SuperAdminSubscriptionPlans from './pages/superadmin/SubscriptionPlans';
import SuperAdminAuditLogs from './pages/superadmin/AuditLogs';
import SuperAdminModuleManager from './pages/superadmin/ModuleManager';
import SuperAdminSettings from './pages/superadmin/SystemSettings';
import SuperAdminGlobalUsers from './pages/superadmin/GlobalUsers';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import SuperAdminCrmControl from './pages/superadmin/CrmControl';
import SuperAdminHrmsControl from './pages/superadmin/HrmsControl';
import SuperAdminBillingInvoices from './pages/superadmin/BillingInvoices';
import SuperAdminBillingTransactions from './pages/superadmin/BillingTransactions';
import SuperAdminFeatureFlags from './pages/superadmin/FeatureFlags';
import SuperAdminAnalyticsRevenue from './pages/superadmin/AnalyticsRevenue';
import SuperAdminAnalyticsUsage from './pages/superadmin/AnalyticsUsage';
import SuperAdminIntegrationsApi from './pages/superadmin/IntegrationsApi';
import SuperAdminIntegrationsWebhooks from './pages/superadmin/IntegrationsWebhooks';
import SuperAdminNotificationsEmailTemplates from './pages/superadmin/NotificationsEmailTemplates';
import SuperAdminSecurityLoginSessions from './pages/superadmin/SecurityLoginSessions';
import SuperAdminSystemBackups from './pages/superadmin/SystemBackups';
import SuperAdminSubscriptionRequests from './pages/superadmin/SubscriptionRequests';
import {
  AccessAssignPage,
  AdminsAndUsersPage,
  CompanyAdminsPage,
  CreateCompanyPage,
  ModuleAssignPage,
  MyActivityPage,
  PlanAssignPage,
  ProfilePage as SuperAdminProfilePage,
  RolesAccessPage,
  SecurityCenterPage,
  SetupReportsPage,
  SuperAdminUsersPage,
  SupportTicketsPage,
  SystemMonitorPage,
  TemplateCenterPage,
  WhiteLabelSettingsPage,
} from './pages/superadmin/SuperAdminUtilityPages';
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
import AdminClients from './pages/admin/AdminClients';
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
import PublicJoiningForm from './pages/public/PublicJoiningForm';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import SuperAdminLayout from './components/SuperAdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminCompanyProfile from './pages/admin/AdminCompanyProfile';
import AdminApiIntegration from './pages/admin/AdminApiIntegration';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminInsights from './pages/admin/AdminInsights';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminAILeadScore from './pages/admin/AdminAILeadScore';
import AdminTaskAssignment from './pages/admin/AdminTaskAssignment';
import AdminTaskBoard from './pages/admin/AdminTaskBoard';
import AdminDealsPipeline from './pages/admin/AdminDealsPipeline';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminInventory from './pages/admin/AdminInventory';
import AdminPurchases from './pages/admin/AdminPurchases';
import AdminSuppliers from './pages/admin/AdminSuppliers';
import AdminWarehouses from './pages/admin/AdminWarehouses';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminPayments from './pages/admin/AdminPayments';
import AdminExpenses from './pages/admin/AdminExpenses';
import AdminCompanySettings from './pages/admin/AdminCompanySettings';
import AdminQuotationTemplates from './pages/admin/AdminQuotationTemplates';
import AdminRBAC from './pages/admin/AdminRBAC';
import DocumentGenerator from './pages/admin/DocumentGenerator';
import AdminSupportTickets from './pages/admin/AdminSupportTickets';
import POSHPortal from './pages/posh/POSHPortal';
import ManagerDashboard from './pages/ManagerDashboard';
import HRDashboard from './pages/HRDashboard';
import DesignerManagerDashboard from './pages/DesignerManagerDashboard';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import JoiningQRGenerator from './pages/hrms/JoiningQRGenerator';
import JoiningSubmissions from './pages/hrms/JoiningSubmissions';
import {
  isAuthenticated,
  getEmployee,
  normalizeRole,
  isSuperAdminRole,
  hasCrmModuleAccess,
  hasHrmsModuleAccess,
  hasPoshModuleAccess,
  isHrPortalRole,
  getDefaultPortalRoute,
} from './utils/auth';
import LandingPage from './pages/LandingPage';
import Subscription from './pages/Subscription';
import Payment from './pages/Payment';
import SetPassword from './pages/SetPassword';
import CompanyLogin from './pages/CompanyLogin';

import ProtectedRoute from './components/ProtectedRoute';
import AutoLogout from './components/AutoLogout';

function PrivateRoute({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function fallbackRoute(employee) {
  const next = getDefaultPortalRoute(employee);
  return next || '/';
}

function CrmRoute({ children }) {
  const employee = getEmployee();
  if (employee && hasCrmModuleAccess(employee)) return children;
  return <Navigate to={fallbackRoute(employee)} replace />;
}

function HrmsRoute({ children }) {
  const employee = getEmployee();
  if (employee && hasHrmsModuleAccess(employee)) return children;
  return <Navigate to={fallbackRoute(employee)} replace />;
}

function AdminRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin', 'super_admin']}>
      {children}
    </ProtectedRoute>
  );
}

function ManagerRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager', 'superadmin', 'super_admin']}>
      {children}
    </ProtectedRoute>
  );
}

function HRRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin', 'super_admin', 'hr', 'human_resources', 'human_resource', 'humanresources', 'hr_manager', 'hrmanager']}>
      {children}
    </ProtectedRoute>
  );
}

function PoshRoute({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function CompanyRoute({ children }) {
  const companyToken = localStorage.getItem('company_token');
  const company = localStorage.getItem('company');

  if (companyToken && company) {
    return children;
  }
  return <Navigate to="/login" replace />;
}

function SuperAdminRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['superadmin', 'super_admin']}>
      {children}
    </ProtectedRoute>
  );
}

function EmployeeHomeRoute() {
  const employee = getEmployee();
  if (!employee) return <Navigate to="/login" />;
  const next = getDefaultPortalRoute(employee);
  if (next !== '/') return <Navigate to={next} replace />;
  return <Dashboard />;
}

function SuperAdminHomeRoute() {
  const employee = getEmployee();
  const next = getDefaultPortalRoute(employee);
  if (next === '/superadmin/setup' || next === '/superadmin/master') {
    return <Navigate to={next} replace />;
  }
  return <Navigate to="/superadmin/master" replace />;
}

function AdminCompaniesRedirect() {
  const employee = getEmployee();
  const role = normalizeRole(employee?.role);
  if (employee && isSuperAdminRole(role)) {
    return <Navigate to="/superadmin/companies" replace />;
  }
  return <Navigate to="/admin" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <Router
      basename={import.meta.env.BASE_URL || '/'}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AutoLogout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/login/master" element={<Login portalType="master" />} />
          <Route path="/login/setup" element={<Login portalType="setup" />} />
          <Route path="/forgot-password" element={<ForgotPasswordEmail />} />
          <Route path="/forgot-password/verify" element={<VerifyEmailOtp />} />
          <Route path="/forgot-password/reset" element={<ResetPasswordEmail />} />
          <Route path="/company/login" element={<CompanyLogin />} />
          <Route path="/crm" element={<LandingPage />} />
          <Route path="/hrms" element={<LandingPage />} />
          <Route path="/subscribe" element={<Subscription />} />
          <Route path="/pay" element={<Payment />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/public/joining-form" element={<PublicJoiningForm />} />
          <Route path="/public/joining-form/:token" element={<PublicJoiningForm />} />

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

          {/* Super Admin Routes */}
          <Route
            path="/superadmin"
            element={
              <SuperAdminRoute>
                <SuperAdminLayout />
              </SuperAdminRoute>
            }
          >
            <Route index element={<SuperAdminHomeRoute />} />
            <Route path="master" element={<SuperAdminDashboard forcedView="master" />} />
            <Route path="setup" element={<SuperAdminDashboard forcedView="superadmin" />} />
            <Route path="companies" element={<SuperAdminCompanyManagement />} />
            <Route path="create-company" element={<CreateCompanyPage />} />
            <Route path="subscriptions" element={<SuperAdminSubscriptionPlans />} />
            <Route path="plans" element={<SuperAdminSubscriptionPlans />} />
            <Route path="plan-assign" element={<PlanAssignPage />} />
            <Route path="modules" element={<SuperAdminModuleManager />} />
            <Route path="module-assign" element={<ModuleAssignPage />} />
            <Route path="users" element={<SuperAdminGlobalUsers />} />
            <Route path="roles" element={<RolesAccessPage />} />
            <Route path="super-admins" element={<SuperAdminUsersPage />} />
            <Route path="admins-users" element={<AdminsAndUsersPage />} />
            <Route path="company-admins" element={<CompanyAdminsPage />} />
            <Route path="access-assign" element={<AccessAssignPage />} />
            <Route path="reports" element={<SetupReportsPage />} />
            <Route path="setup-reports" element={<SetupReportsPage />} />
            <Route path="my-activity" element={<MyActivityPage />} />
            <Route path="tickets" element={<SupportTicketsPage />} />
            <Route path="support-tickets" element={<SupportTicketsPage />} />
            <Route path="profile" element={<SuperAdminProfilePage />} />
            <Route path="audit-logs" element={<SuperAdminAuditLogs />} />
            <Route path="settings" element={<SuperAdminSettings />} />
            <Route path="security-center" element={<SecurityCenterPage />} />
            <Route path="system-monitor" element={<SystemMonitorPage />} />
            <Route path="white-label-settings" element={<WhiteLabelSettingsPage />} />
            <Route path="templates" element={<TemplateCenterPage type="email" />} />
            <Route path="templates/invoice" element={<TemplateCenterPage type="invoice" />} />
            <Route path="templates/quotation" element={<TemplateCenterPage type="quotation" />} />
            <Route path="templates/whatsapp" element={<TemplateCenterPage type="whatsapp" />} />
            <Route path="templates/employee" element={<TemplateCenterPage type="employee" />} />
            <Route path="crm" element={<SuperAdminCrmControl />} />
            <Route path="hrms-control" element={<SuperAdminHrmsControl />} />
            <Route path="billing/invoices" element={<SuperAdminBillingInvoices />} />
            <Route path="billing/transactions" element={<SuperAdminBillingTransactions />} />
            <Route path="billing/requests" element={<SuperAdminSubscriptionRequests />} />
            <Route path="feature-flags" element={<SuperAdminFeatureFlags />} />
            <Route path="analytics/revenue" element={<SuperAdminAnalyticsRevenue />} />
            <Route path="analytics/usage" element={<SuperAdminAnalyticsUsage />} />
            <Route path="integrations/api" element={<SuperAdminIntegrationsApi />} />
            <Route path="integrations/webhooks" element={<SuperAdminIntegrationsWebhooks />} />
            <Route path="notifications/email-templates" element={<SuperAdminNotificationsEmailTemplates />} />
            <Route path="security/login-sessions" element={<SuperAdminSecurityLoginSessions />} />
            <Route path="system/backups" element={<SuperAdminSystemBackups />} />
            <Route path="posh" element={<POSHPortal mode="superadmin" />} />
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
            <Route path="hrms/attendance" element={<HrmsRoute><Attendance /></HrmsRoute>} />
            <Route path="hrms/leaves" element={<HrmsRoute><Leaves /></HrmsRoute>} />
            <Route path="chat" element={<Chat />} />
            <Route path="calendar" element={<Calendar />} />
          </Route>

          {/* Designer Manager Routes */}
          <Route
            path="/designer-manager"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<DesignerManagerDashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="meetings" element={<Meetings />} />
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
            <Route path="meetings" element={<CrmRoute><Meetings /></CrmRoute>} />
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
            <Route path="hrms/joining-qr" element={<JoiningQRGenerator />} />
            <Route path="hrms/joining-submissions" element={<JoiningSubmissions />} />
            <Route path="posh" element={<PoshRoute><POSHPortal mode="hr" /></PoshRoute>} />
            <Route path="chat" element={<Chat />} />
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
            <Route index element={<EmployeeHomeRoute />} />
            <Route path="employee-dashboard" element={<CrmRoute><EmployeeDashboard /></CrmRoute>} />
            <Route path="leads" element={<CrmRoute><Leads /></CrmRoute>} />
            <Route path="meetings" element={<CrmRoute><Meetings /></CrmRoute>} />
            <Route path="tasks" element={<CrmRoute><Tasks /></CrmRoute>} />
            <Route path="followups" element={<CrmRoute><Followups /></CrmRoute>} />
            <Route path="quotations" element={<CrmRoute><Quotations /></CrmRoute>} />
            <Route path="invoices" element={<CrmRoute><Invoices /></CrmRoute>} />
            <Route path="sample-reports" element={<CrmRoute><SampleReports /></CrmRoute>} />
            <Route path="client-history" element={<CrmRoute><ClientHistory /></CrmRoute>} />
            <Route path="group-meetings" element={<CrmRoute><GroupMeetings /></CrmRoute>} />
            <Route path="history" element={<CrmRoute><History /></CrmRoute>} />
            <Route path="whatsapp-hits" element={<CrmRoute><WhatsAppHits /></CrmRoute>} />
            <Route path="reports" element={<CrmRoute><Reports /></CrmRoute>} />
            <Route path="company-management" element={<AdminCompaniesRedirect />} />

            {/* HRMS Routes */}
            <Route path="hrms/leaves" element={<HrmsRoute><Leaves /></HrmsRoute>} />
            <Route path="hrms/attendance" element={<HrmsRoute><Attendance /></HrmsRoute>} />
            <Route path="hrms/documents" element={<HrmsRoute><HRDocuments /></HrmsRoute>} />
            <Route path="hrms/salary-slips" element={<HrmsRoute><SalarySlips /></HrmsRoute>} />
            <Route path="posh" element={<PoshRoute><POSHPortal mode="employee" /></PoshRoute>} />

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
            <Route path="company-profile" element={<AdminCompanyProfile />} />
            <Route path="leads" element={<Leads />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="followups" element={<Followups />} />
            <Route path="deals-pipeline" element={<AdminDealsPipeline />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="quotation-templates" element={<AdminQuotationTemplates />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="chat" element={<Chat />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="documents" element={<HRDocuments />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="api-integration" element={<AdminApiIntegration />} />
            <Route
              path="integrations"
              element={<Navigate to="/admin/api-integration" replace />}
            />
            <Route path="revenue" element={<AdminRevenue />} />
            <Route path="insights" element={<AdminInsights />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="payroll" element={<SalarySlips />} />
            <Route path="ai-lead-score" element={<AdminAILeadScore />} />
            <Route path="task-assignment" element={<AdminTaskAssignment />} />
            <Route path="projects" element={<Tasks />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="task-board" element={<AdminTaskBoard />} />
            <Route path="timesheets" element={<Calendar />} />
            <Route path="departments" element={<AdminDepartments />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="products" element={<AdminInventory />} />
            <Route path="stock" element={<AdminInventory />} />
            <Route path="purchases" element={<AdminPurchases />} />
            <Route path="suppliers" element={<AdminSuppliers />} />
            <Route path="warehouses" element={<AdminWarehouses />} />
            <Route path="accounts" element={<AdminAccounts />} />
            <Route path="expenses" element={<AdminExpenses />} />
            <Route path="company-settings" element={<AdminCompanySettings />} />
            <Route path="rbac" element={<AdminRBAC />} />
            <Route path="reports" element={<Reports />} />
            <Route path="export-reports" element={<SampleReports />} />
            <Route path="support-tickets" element={<AdminSupportTickets />} />
            <Route path="posh" element={<PoshRoute><POSHPortal mode="admin" /></PoshRoute>} />
            <Route path="generate-document/:employeeId" element={<DocumentGenerator />} />
            <Route path="companies" element={<AdminCompaniesRedirect />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Routes>
      </AutoLogout>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
