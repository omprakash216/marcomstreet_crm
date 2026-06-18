const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { isSuperRole } = require('../middleware/hideSuperAdminData');
const { ensureEmployeeCodeSchema } = require('../utils/employeeCodeSchema');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    await ensureEmployeeCodeSchema();

    let rows = [];
    try {
      const isSuper = isSuperRole(req.employee.role);
      const companyId = req.employee.company_id;
      
      const salarySelectFields = [
        'ABS(COALESCE(e.basic_salary, 0)) as basic_salary',
        'ABS(COALESCE(e.hra, 0)) as hra',
        'ABS(COALESCE(e.conveyance, 0)) as conveyance',
        'ABS(COALESCE(e.medical_allowance, 0)) as medical_allowance',
        'ABS(COALESCE(e.special_allowance, 0)) as special_allowance',
        'ABS(COALESCE(e.other_allowances, 0)) as other_allowances',
        'ABS(COALESCE(e.pf_contribution, 0)) as pf_contribution',
        'ABS(COALESCE(e.gratuity, 0)) as gratuity',
        'e.bank_account',
        'e.bank_name',
        'e.ifsc_code',
        'e.branch_name',
        'e.account_holder_name',
      ].join(', ');

      const queryStr = isSuper
        ? `SELECT e.id, e.employee_code, e.name, e.email, e.phone, e.role, e.department_id, e.designation_id, e.designation, e.status, ${salarySelectFields}, d.name as department_name, dg.name as designation_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN designations dg ON e.designation_id = dg.id WHERE e.status = ? ORDER BY e.name`
        : `SELECT e.id, e.employee_code, e.name, e.email, e.phone, e.role, e.department_id, e.designation_id, e.designation, e.status, ${salarySelectFields}, d.name as department_name, dg.name as designation_name FROM employees e LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN designations dg ON e.designation_id = dg.id WHERE e.status = ? AND e.company_id = ? AND LOWER(REPLACE(REPLACE(TRIM(e.role), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin') ORDER BY e.name`;
        
      const queryParams = isSuper ? ['active'] : ['active', companyId];
      
      rows = await query(queryStr, queryParams);
    } catch (qErr) {
      const msg = (qErr && qErr.message) ? String(qErr.message) : '';
      if (!(msg.includes("doesn't exist") || msg.includes('Unknown column'))) throw qErr;
      
      // Fallback for older schema without company_id or department_id
      const isSuper = isSuperRole(req.employee.role);
      const companyId = req.employee.company_id;
      
      let fallbackQuery = `
         SELECT id, NULL as employee_code, name, email, NULL as phone,
                'employee' as role, NULL as department_id, NULL as designation,
                'active' as status,
                NULL as basic_salary, NULL as hra, NULL as conveyance, NULL as medical_allowance,
                NULL as special_allowance, NULL as other_allowances, NULL as pf_contribution, NULL as gratuity,
                NULL as bank_account, NULL as bank_name, NULL as ifsc_code, NULL as branch_name, NULL as account_holder_name,
                'General' as department_name, NULL as designation_name
         FROM employees
      `;
      let fallbackParams = [];
      
      if (!isSuper && companyId) {
          fallbackQuery += " WHERE company_id = ? AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')";
          fallbackParams.push(companyId);
      } else if (!isSuper) {
          // If company_id is missing for non-super user, return empty instead of leaking data.
          return res.json({ success: true, data: [] });
      }
      fallbackQuery += ' ORDER BY name';
      
      try {
          rows = await query(fallbackQuery, fallbackParams);
      } catch (e2) {
          // Absolute worst case fallback: avoid returning cross-company data to non-super users.
          if (!isSuper) return res.json({ success: true, data: [] });
          rows = await query(
            `SELECT id, NULL as employee_code, name, email, NULL as phone,
                    'employee' as role, NULL as department_id, NULL as designation,
                    'active' as status, 'General' as department_name, NULL as designation_name
             FROM employees ORDER BY name`
          );
      }
    }
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
