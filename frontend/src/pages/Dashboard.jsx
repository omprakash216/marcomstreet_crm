import { getEmployee } from '../utils/auth';
import EmployeeDashboard from './EmployeeDashboard';
import ManagerDashboard from './ManagerDashboard';
import HRDashboard from './HRDashboard';
import DesignerDashboard from './DesignerDashboard';

export default function Dashboard() {
  const employee = getEmployee();

  // Route based on employee role
  if (!employee) {
    return <EmployeeDashboard />;
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
  if (employee.role === 'designer') {
    return <DesignerDashboard />;
  }

  // Default Employee Dashboard (for all other roles)
  return <EmployeeDashboard />;
}
