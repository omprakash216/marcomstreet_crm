require('./config/env');
const { refreshSmsConfig, getPublicSmsStatus } = require('./config/smsConfig');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { QUERY_MODE } = require('./config/database');

function logErrorToFile(err, context = '') {
  try {
    const logPath = path.join(__dirname, 'scripts/error_debug.log');
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] ${context}\n${err.stack || err}\n\n`;
    fs.appendFileSync(logPath, msg);
  } catch (e) {
    console.error('Failed to write to log file:', e.message);
  }
}

const authRoutes = require('./routes/auth');
const hrmsRoutes = require('./routes/hrms');
const chatRoutes = require('./routes/chat');
const dashboardRoutes = require('./routes/dashboard');
const leadsRoutes = require('./routes/leads');
const servePdfRoutes = require('./routes/servePdf');
const tasksRoutes = require('./routes/tasks');
const followupsRoutes = require('./routes/followups');
const meetingsRoutes = require('./routes/meetings');
const departmentsRoutes = require('./routes/departments');
const reportsRoutes = require('./routes/reports');
const quotationsRoutes = require('./routes/quotations');
const invoicesRoutes = require('./routes/invoices');
const adminRoutes = require('./routes/admin');
const checkinRoutes = require('./routes/checkin');
const activitiesRoutes = require('./routes/activities');
const companiesRoutes = require('./routes/companies');
const managerRoutes = require('./routes/manager');
const whatsappRoutes = require('./routes/whatsapp');
const aiRoutes = require('./routes/ai');
const designerRoutes = require('./routes/designer');
const designerManagerRoutes = require('./routes/designerManager');
const hrDocumentsRoutes = require('./routes/hrDocuments');
const groupMeetingsRoutes = require('./routes/groupMeetings');
const employeesRoutes = require('./routes/employees');
const inventoryRoutes = require('./routes/inventory');
const accountsRoutes = require('./routes/accounts');
const publicApiRoutes = require('./routes/publicApi');
const billingRoutes = require('./routes/billing');
const expensesRoutes = require('./routes/expenses');
const ajaxRoutes = require('./routes/ajax');
const purchasesRoutes = require('./routes/purchases');
const suppliersRoutes = require('./routes/suppliers');
const warehousesRoutes = require('./routes/warehouses');
const supportTicketsRoutes = require('./routes/supportTickets');
const paymentsRoutes = require('./routes/payments');

// Super Admin Routes
const superAdminCompanies = require('./routes/superadmin/companies');
const superAdminSubscriptions = require('./routes/superadmin/subscriptions');
const superAdminUsers = require('./routes/superadmin/users');
const superAdminLogs = require('./routes/superadmin/logs');
const superAdminSettings = require('./routes/superadmin/settings');
const superAdminMetrics = require('./routes/superadmin/metrics');
const superAdminModules = require('./routes/superadmin/modules');
const superAdminCrm = require('./routes/superadmin/crm');
const superAdminHrmsConfig = require('./routes/superadmin/hrms-config');
const superAdminBilling = require('./routes/superadmin/billing');
const superAdminFeatureFlags = require('./routes/superadmin/featureFlags');
const superAdminAnalytics = require('./routes/superadmin/analytics');
const superAdminIntegrations = require('./routes/superadmin/integrations');
const superAdminNotifications = require('./routes/superadmin/notifications');
const superAdminSecurity = require('./routes/superadmin/security');
const superAdminSystem = require('./routes/superadmin/system');
const superAdminSupport = require('./routes/superadmin/support');
const superAdminWhiteLabel = require('./routes/superadmin/whiteLabel');
const { apiAuditLogger } = require('./middleware/apiAuditLogger');
const { hideSuperAdminData } = require('./middleware/hideSuperAdminData');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// PDF serve - MUST be before /api so path /serve-pdf works (fixes PDF open/download + MIME)
app.use('/serve-pdf', servePdfRoutes);

// API audit logging (non-blocking). Must be before mounting /api routes.
app.use(apiAuditLogger);
app.use(hideSuperAdminData);

// API routes - full Node backend (no PHP)
app.use('/api/auth', authRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/hrms', hrmsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/followups', followupsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/designer', designerRoutes);
app.use('/api/designer-manager', designerManagerRoutes);
app.use('/api/hr-documents', hrDocumentsRoutes);
app.use('/api/group-meetings', groupMeetingsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/external', publicApiRoutes);
app.use('/api/webhook', publicApiRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/ajax', ajaxRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/support-tickets', supportTicketsRoutes);
app.use('/api/payments', paymentsRoutes);

// Fallback: some deployments still hit /api/billing/plans but miss the router mount
app.get('/api/billing/plans', (req, res, next) => {
  req.url = '/plans';
  billingRoutes.handle(req, res, next);
});

// Mount Super Admin
app.use('/api/superadmin/companies', superAdminCompanies);
app.use('/api/superadmin/subscriptions', superAdminSubscriptions);
app.use('/api/superadmin/users', superAdminUsers);
app.use('/api/superadmin/logs', superAdminLogs);
app.use('/api/superadmin/settings', superAdminSettings);
app.use('/api/superadmin/metrics', superAdminMetrics);
app.use('/api/superadmin/modules', superAdminModules);
app.use('/api/superadmin/crm', superAdminCrm);
app.use('/api/superadmin/hrms-config', superAdminHrmsConfig);
app.use('/api/superadmin/billing', superAdminBilling);
app.use('/api/superadmin/feature-flags', superAdminFeatureFlags);
app.use('/api/superadmin/analytics', superAdminAnalytics);
app.use('/api/superadmin/integrations', superAdminIntegrations);
app.use('/api/superadmin/notifications', superAdminNotifications);
app.use('/api/superadmin/security', superAdminSecurity);
app.use('/api/superadmin/system', superAdminSystem);
app.use('/api/superadmin/support', superAdminSupport);
app.use('/api/superadmin/white-label', superAdminWhiteLabel);

app.get('/api/check', (req, res) => {
  res.json({ success: true, message: 'Node backend is running', build: '2026-03-15', db_query_mode: QUERY_MODE });
});

// Serve backend assets (logos, watermark) from Node app - no PHP backend folder
const backendAssets = path.join(__dirname, 'backend-assets');
app.use('/backend/assets', express.static(backendAssets));

// Serve uploads (HR docs, salary slips) from project root
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Serve React frontend (built) - single app, no PHP/Apache
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback: non-API, non-file requests -> index.html (no PHP)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/serve-pdf') || req.path.startsWith('/backend/') || req.path.startsWith('/uploads/')) return next();
  const file = path.join(frontendDist, req.path);
  const indexFile = path.join(frontendDist, 'index.html');
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return next();
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send('Frontend not built. Run: cd frontend && npm run build');
  }
});

app.use((err, req, res, next) => {
  logErrorToFile(err, `Global Error: ${req.method} ${req.url}`);
  console.error(err);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log('');
    console.log('MARCOM CRM (Node only - no PHP)');
    console.log('  App:  http://localhost:' + port);
    console.log('  API:  http://localhost:' + port + '/api/check');
    console.log('  Build frontend first: cd frontend && npm run build');
    if (port !== 3000) {
      console.log('  Note: Port ' + port + '. In frontend/.env set VITE_API_PORT=' + port + ' for dev.');
    }
    console.log('');
    refreshSmsConfig()
      .then(() => {
        const s = getPublicSmsStatus();
        if (s.smsConfigured) {
          console.log(`  SMS OTP: active (${s.provider}, sender ${s.senderId})`);
        } else {
          console.log('  SMS OTP: NOT configured — Super Admin → System Settings → SMS OTP');
        }
      })
      .catch((e) => console.warn('  SMS config load:', e.message));
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('');
      console.error('Port ' + port + ' is already in use.');
      console.error('  - Stop the process using this port, or');
      console.error('  - Set a free PORT in backend-node/.env, and');
      console.error('  - Set same value in frontend/.env.local as VITE_API_PORT.');
      console.error('');
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

// Auto punch out at 12 AM: anyone still checked_in for yesterday gets check_out_time 23:59:59 and status completed
let lastAutoPunchOutDate = null;
function runAutoPunchOutAtMidnight() {
  const now = new Date();
  if (now.getHours() !== 0 || now.getMinutes() > 1) return;
  const today = now.toISOString().slice(0, 10);
  if (lastAutoPunchOutDate === today) return;
  lastAutoPunchOutDate = today;
  const { closeOpenAttendanceRecords } = require('./services/workTimer');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  Promise.resolve(closeOpenAttendanceRecords(dateStr))
    .then(() => {
      console.log('[Attendance] Auto close executed for ' + dateStr);
    })
    .catch((err) => console.error('[Attendance] Auto punch out error:', err.message));
}
setInterval(runAutoPunchOutAtMidnight, 60 * 1000);
runAutoPunchOutAtMidnight();

const port = Number(process.env.PORT) || 3000;
startServer(port);

// --- Stability & Crash Prevention ---

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const msg = `Unhandled Rejection at: ${promise} reason: ${reason}`;
  console.error(msg);
  logErrorToFile(new Error(msg), 'Unhandled Rejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  const msg = `Uncaught Exception: ${err.message}`;
  console.error(msg);
  logErrorToFile(err, 'Uncaught Exception');
  // Exit the process and let PM2 restart it
  process.exit(1);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
