const {
  canAccessComplaint,
  getComplaintById,
  getIccMember,
  hasCompanyPoshAccess,
  isHrAdmin,
  isSuperAdmin,
  normalizeRole,
} = require('../services/poshService');

function requireCompanyModuleAccess(moduleKey) {
  return async (req, res, next) => {
    try {
      if (moduleKey !== 'posh') return next();
      if (isSuperAdmin(req.employee)) return next();
      const companyId = req.employee?.company_id;
      if (!companyId || !(await hasCompanyPoshAccess(companyId))) {
        return res.status(403).json({
          success: false,
          message: 'POSH module is not enabled for this company.',
        });
      }
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
}

function requirePoshManager() {
  return async (req, res, next) => {
    try {
      if (isSuperAdmin(req.employee) || isHrAdmin(req.employee)) return next();
      const icc = await getIccMember(req.employee?.id, req.employee?.company_id);
      if (icc) {
        req.poshIccMember = icc;
        return next();
      }
      return res.status(403).json({ success: false, message: 'POSH manager/ICC access required.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
}

function requireHrAdmin() {
  return (req, res, next) => {
    if (isSuperAdmin(req.employee) || isHrAdmin(req.employee)) return next();
    return res.status(403).json({ success: false, message: 'HR/Admin POSH access required.' });
  };
}

function requireEmployeePortalUser() {
  return (req, res, next) => {
    const role = normalizeRole(req.employee?.role);
    if (isSuperAdmin(req.employee) || role === 'admin') {
      return res.status(403).json({ success: false, message: 'Use Admin/HR POSH portal for this account.' });
    }
    return next();
  };
}

function loadComplaintForAccess() {
  return async (req, res, next) => {
    try {
      const id = req.params.id || req.params.complaintId;
      const complaint = await getComplaintById(id);
      if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
      if (!(await canAccessComplaint(req.employee, complaint))) {
        return res.status(403).json({ success: false, message: 'You cannot access this POSH complaint.' });
      }
      req.poshComplaint = complaint;
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
}

module.exports = {
  requireCompanyModuleAccess,
  requirePoshManager,
  requireHrAdmin,
  requireEmployeePortalUser,
  loadComplaintForAccess,
};
