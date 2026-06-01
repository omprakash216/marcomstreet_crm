import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmployee, isSuperAdminRole, normalizeRole } from '../../utils/auth';

export default function AdminCompanies() {
  const navigate = useNavigate();

  useEffect(() => {
    const employee = getEmployee();
    const role = normalizeRole(employee?.role);

    if (employee && isSuperAdminRole(role)) {
      navigate('/superadmin/companies', { replace: true });
      return;
    }

    navigate('/admin', { replace: true });
  }, [navigate]);

  return null;
}
