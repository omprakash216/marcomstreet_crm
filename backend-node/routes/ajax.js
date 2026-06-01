const express = require('express');
const { verifyToken } = require('../middleware/auth');
const {
  generateEmployeeCode,
  isEmployeeCodeValidationError,
} = require('../utils/employeeCode');
const { ensureEmployeeCodeSchema } = require('../utils/employeeCodeSchema');

const router = express.Router();

function isSuperAdmin(employee) {
  const role = String(employee?.role || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return role === 'superadmin' || role === 'super_admin';
}

async function generateEmployeeCodePreview(req, res) {
  try {
    await ensureEmployeeCodeSchema();

    const b = { ...(req.query || {}), ...(req.body || {}) };
    const companyId = isSuperAdmin(req.employee) && b.company_id
      ? b.company_id
      : req.employee?.company_id;

    const employeeCode = await generateEmployeeCode(
      companyId,
      b.department_id,
      b.designation_id,
      b.joining_date,
      {
        excludeEmployeeId: b.exclude_employee_id || b.employee_id || null,
        lock: false,
      }
    );

    return res.json({ success: true, employee_code: employeeCode });
  } catch (err) {
    const status = isEmployeeCodeValidationError(err) ? err.statusCode || 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

router.get('/generate-employee-code.php', verifyToken, generateEmployeeCodePreview);
router.post('/generate-employee-code.php', verifyToken, generateEmployeeCodePreview);

module.exports = router;
