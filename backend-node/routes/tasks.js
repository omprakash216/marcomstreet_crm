const express = require('express');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const { logActivity } = require('../middleware/activityLog');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/task_work');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '_' + (file.originalname || 'file')),
});
const upload = multer({ storage });

router.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await query(
      `SELECT t.id, t.employee_id, t.lead_id, t.title, t.description, t.task_type, t.priority, t.due_date, t.status, t.completed_at, t.created_at, l.company_name
       FROM tasks t LEFT JOIN leads l ON t.lead_id = l.id
       WHERE t.employee_id = ? ORDER BY t.due_date ASC, t.created_at DESC`,
      [req.employee.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      'INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.employee.id, b.lead_id || null, b.title, b.description || '', b.task_type || 'general', b.priority || 'medium', b.due_date || null, b.status || 'pending']
    );
    return res.json({ success: true, message: 'Task created' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    await query(
      'UPDATE tasks SET title=?, description=?, priority=?, due_date=?, status=?, updated_at=NOW() WHERE id=? AND employee_id=?',
      [b.title, b.description, b.priority, b.due_date, b.status, req.params.id, req.employee.id]
    );
    return res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update_status', verifyToken, async (req, res) => {
  try {
    const b = req.body || {};
    const taskId = b.task_id || b.id;
    const status = b.status;
    if (!taskId || !status) return res.status(400).json({ success: false, message: 'Task ID and status are required' });
    const rows = await query('SELECT * FROM tasks WHERE id = ? AND employee_id = ?', [taskId, req.employee.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    await query('UPDATE tasks SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [status, completedAt, taskId, req.employee.id]);
    await logActivity(req.employee.id, 'task_updated', 'task', taskId, 'Task status updated to ' + status, req);
    return res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/update_status', verifyToken, upload.single('work_file'), async (req, res) => {
  try {
    const taskId = (req.body && req.body.task_id) || (req.body && req.body.id);
    const status = req.body && req.body.status;
    if (!taskId || !status) return res.status(400).json({ success: false, message: 'Task ID and status are required' });
    const rows = await query('SELECT * FROM tasks WHERE id = ? AND employee_id = ?', [taskId, req.employee.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    let filePath = null;
    if (req.file) filePath = 'uploads/task_work/' + req.file.filename;
    const completedAt = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    if (filePath) {
      await query('UPDATE tasks SET status = ?, completed_at = ?, work_file_path = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [status, completedAt, filePath, taskId, req.employee.id]);
    } else {
      await query('UPDATE tasks SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ? AND employee_id = ?', [status, completedAt, taskId, req.employee.id]);
    }
    await logActivity(req.employee.id, 'task_updated', 'task', taskId, 'Task status updated to ' + status + (filePath ? ' with work file' : ''), req);
    return res.json({ success: true, message: 'Task updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
