import { getEmployee, normalizeRole } from '../utils/auth';
import EmployeeDashboard from './EmployeeDashboard';
import ManagerDashboard from './ManagerDashboard';
import HRDashboard from './HRDashboard';
import DesignerDashboard from './DesignerDashboard';
import DesignerManagerDashboard from './DesignerManagerDashboard';
import SuperAdminDashboard from './superadmin/SuperAdminDashboard';

export default function Dashboard() {
  const employee = getEmployee();
  const role = normalizeRole(employee?.role);

  // Route based on employee role
  if (!employee) {
    return <EmployeeDashboard />;
  }

  // Super Admin Hierarchy First
  if (role === 'superadmin' || role === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  // Manager Dashboard
  if (employee.role === 'manager') {
    return <ManagerDashboard />;
  }

  // HR Dashboard
  if (employee.role === 'human_resources') {
    return <HRDashboard />;
  }

  // Designer Dashboard
  if (employee.role === 'designer_manager' || (employee.designation && employee.designation.toLowerCase().includes('design manager'))) {
    return <DesignerManagerDashboard />;
  }

  if (employee.role === 'designer') {
    return <DesignerDashboard />;
  }

  // Default Employee Dashboard (for all other roles)
  return <EmployeeDashboard />;
}
