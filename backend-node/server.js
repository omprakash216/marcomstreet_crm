const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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
const hrDocumentsRoutes = require('./routes/hrDocuments');
const groupMeetingsRoutes = require('./routes/groupMeetings');
const employeesRoutes = require('./routes/employees');

const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// PDF serve - MUST be before /api so path /serve-pdf works (fixes PDF open/download + MIME)
app.use('/serve-pdf', servePdfRoutes);

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
app.use('/api/hr-documents', hrDocumentsRoutes);
app.use('/api/group-meetings', groupMeetingsRoutes);
app.use('/api/employees', employeesRoutes);

app.get('/api/check', (req, res) => {
  res.json({ success: true, message: 'Node backend is running' });
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
  const { query, getConnection } = require('./config/database');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  getConnection()
    .then((conn) => {
      return conn.execute(
        "UPDATE employee_checkins SET check_out_time = '23:59:59', check_out_location = 'Auto (12 AM)', status = 'completed' WHERE date = ? AND status = 'checked_in'",
        [dateStr]
      ).then(() => { conn.release(); });
    })
    .then((result) => {
      if (result && result[0] && result[0].affectedRows > 0) {
        console.log('[Attendance] Auto punch out at 12 AM: ' + result[0].affectedRows + ' record(s) updated for ' + dateStr);
      }
    })
    .catch((err) => console.error('[Attendance] Auto punch out error:', err.message));
}
setInterval(runAutoPunchOutAtMidnight, 60 * 1000);
runAutoPunchOutAtMidnight();

const port = Number(process.env.PORT) || 3000;
startServer(port);
