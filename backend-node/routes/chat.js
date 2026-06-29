const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/database');
const { verifyToken, verifyTokenNoTouch } = require('../middleware/auth');
const { isSuperRole } = require('../middleware/hideSuperAdminData');

const router = express.Router();
const UPLOADS_CHAT = path.join(__dirname, '../../uploads/chat/messages');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_CHAT)) fs.mkdirSync(UPLOADS_CHAT, { recursive: true });
    cb(null, UPLOADS_CHAT);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + '_' + (file.originalname || 'attachment');
    cb(null, safeName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

router.get('/', verifyTokenNoTouch, async (req, res) => {
  try {
    const action = req.query.action || 'messages';
    const employeeId = req.employee.id;
    const requesterIsSuper = isSuperRole(req.employee.role);
    const requesterCompanyId = req.employee.company_id;

    if (action === 'users') {
      let users = [];
      try {
        if (requesterIsSuper) {
          users = await query(
            `SELECT e.id, e.name, e.email, e.role, d.name as department,
                    (
                      SELECT MAX(cm.created_at)
                      FROM chat_messages cm
                      WHERE (cm.from_employee_id = e.id AND cm.to_employee_id = ?)
                         OR (cm.from_employee_id = ? AND cm.to_employee_id = e.id)
                    ) AS last_message_time,
                    (
                      SELECT COUNT(*)
                      FROM chat_messages um
                      WHERE um.from_employee_id = e.id
                        AND um.to_employee_id = ?
                        AND um.is_read = 0
                    ) AS unread_count
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE e.id != ? AND e.status = 'active'
             ORDER BY COALESCE(last_message_time, e.created_at) DESC, unread_count DESC, e.name ASC`,
            [employeeId, employeeId, employeeId, employeeId]
          );
        } else {
          users = await query(
            `SELECT e.id, e.name, e.email, e.role, d.name as department,
                    (
                      SELECT MAX(cm.created_at)
                      FROM chat_messages cm
                      WHERE (cm.from_employee_id = e.id AND cm.to_employee_id = ?)
                         OR (cm.from_employee_id = ? AND cm.to_employee_id = e.id)
                    ) AS last_message_time,
                    (
                      SELECT COUNT(*)
                      FROM chat_messages um
                      WHERE um.from_employee_id = e.id
                        AND um.to_employee_id = ?
                        AND um.is_read = 0
                    ) AS unread_count
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE e.id != ?
               AND e.status = 'active'
               AND e.company_id = ?
               AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(e.role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')
             ORDER BY COALESCE(last_message_time, e.created_at) DESC, unread_count DESC, e.name ASC`,
            [employeeId, employeeId, employeeId, employeeId, requesterCompanyId]
          );
        }
      } catch (qErr) {
        const msg = (qErr && qErr.message) ? String(qErr.message) : '';
        if (!(msg.includes("doesn't exist") || msg.includes('Unknown column'))) throw qErr;
        // Fallback for older schema without departments/role columns
        if (requesterIsSuper) {
          users = await query(
            `SELECT id, name, email, 'employee' as role, 'General' as department
             FROM employees
             WHERE id != ?
             ORDER BY name ASC`,
            [employeeId]
          ).catch(() => []);
        } else if (requesterCompanyId) {
          users = await query(
            `SELECT id, name, email, 'employee' as role, 'General' as department
             FROM employees
             WHERE id != ? AND company_id = ?
             ORDER BY name ASC`,
            [employeeId, requesterCompanyId]
          ).catch(() => []);
        } else {
          users = [];
        }
      }
      return res.json({ success: true, data: users });
    }

    if (action === 'unread_count') {
      try {
        const rows = await query(
          'SELECT COUNT(*) as count FROM chat_messages WHERE to_employee_id = ? AND is_read = 0',
          [employeeId]
        );
        return res.json({ success: true, count: Number(rows[0]?.count || 0) });
      } catch (qErr) {
        // Never hard-fail the UI for chat badge; return 0 on any schema/DB issue.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[chat] unread_count fallback:', qErr?.message || qErr);
        }
        return res.json({ success: true, count: 0 });
      }
    }

    if (action === 'mark_all_read') {
      try {
        await query(
          'UPDATE chat_messages SET is_read = 1 WHERE to_employee_id = ? AND is_read = 0',
          [employeeId]
        );
        return res.json({ success: true, message: 'All messages marked as read' });
      } catch (err) {
        console.error('Chat mark_all_read:', err);
        return res.status(500).json({ success: false, message: err.message });
      }
    }

    if (action === 'notifications') {
      try {
        const includeRead = req.query.include_read === 'true';
        const limitVal = includeRead ? 50 : 20;
        let notifications = [];
        if (requesterIsSuper) {
          notifications = await query(
            `SELECT cm.*, e.name as from_name 
             FROM chat_messages cm
             JOIN employees e ON e.id = cm.from_employee_id
             WHERE cm.to_employee_id = ? ${includeRead ? '' : 'AND cm.is_read = 0'}
             ORDER BY cm.created_at DESC LIMIT ${limitVal}`,
            [employeeId]
          );
        } else {
          notifications = await query(
            `SELECT cm.*, e.name as from_name 
             FROM chat_messages cm
             JOIN employees e ON e.id = cm.from_employee_id
             WHERE cm.to_employee_id = ?
               ${includeRead ? '' : 'AND cm.is_read = 0'}
               AND e.company_id = ?
               AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(e.role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')
             ORDER BY cm.created_at DESC LIMIT ${limitVal}`,
            [employeeId, requesterCompanyId]
          );
        }
        return res.json({ success: true, data: notifications });
      } catch (qErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[chat] notifications fallback:', qErr?.message || qErr);
        }
        return res.json({ success: true, data: [] });
      }
    }

    const targetUserId = req.query.user_id;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }

    if (!requesterIsSuper) {
      const targetRows = await query(
        `SELECT id
         FROM employees
         WHERE id = ?
           AND company_id = ?
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')
         LIMIT 1`,
        [targetUserId, requesterCompanyId]
      ).catch(() => []);
      if (!Array.isArray(targetRows) || !targetRows[0]) {
        return res.status(403).json({ success: false, message: 'You cannot access this chat user' });
      }
    }

    const messages = await query(
      `SELECT * FROM chat_messages 
       WHERE (from_employee_id = ? AND to_employee_id = ?) OR (from_employee_id = ? AND to_employee_id = ?) 
       ORDER BY created_at ASC`,
      [employeeId, targetUserId, targetUserId, employeeId]
    );

    await query(
      'UPDATE chat_messages SET is_read = 1 WHERE from_employee_id = ? AND to_employee_id = ?',
      [targetUserId, employeeId]
    );

    return res.json({ success: true, data: messages });
  } catch (err) {
    console.error('Chat GET:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const isLimit = err.code === 'LIMIT_FILE_SIZE';
      return res.status(isLimit ? 413 : 400).json({
        success: false,
        message: isLimit ? 'File too large (max 50MB)' : 'File upload failed',
      });
    }

    try {
      const { to_employee_id, message } = req.body || {};
      if (!to_employee_id) {
        return res.status(400).json({ success: false, message: 'to_employee_id is required' });
      }
      const requesterIsSuper = isSuperRole(req.employee.role);
      const requesterCompanyId = req.employee.company_id;
      if (!requesterIsSuper) {
        const recipientRows = await query(
          `SELECT id
           FROM employees
           WHERE id = ?
             AND company_id = ?
             AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(role,'')), ' ', '_'), '-', '_')) NOT IN ('superadmin', 'super_admin')
           LIMIT 1`,
          [to_employee_id, requesterCompanyId]
        ).catch(() => []);
        if (!Array.isArray(recipientRows) || !recipientRows[0]) {
          return res.status(403).json({ success: false, message: 'You cannot message this user' });
        }
      }
      let finalMessage = (message || '').trim();
      if (req.file && !finalMessage) {
        finalMessage = `Sent a file: ${req.file.originalname}`;
      }
      const fileInfo = req.file
        ? {
            file_path: `uploads/chat/messages/${req.file.filename}`,
            file_name: req.file.originalname || req.file.filename,
            file_type: req.file.mimetype,
          }
        : { file_path: null, file_name: null, file_type: null };

      try {
        await query(
          'INSERT INTO chat_messages (from_employee_id, to_employee_id, message, file_path, file_name, file_type, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
          [req.employee.id, to_employee_id, finalMessage || null, fileInfo.file_path, fileInfo.file_name, fileInfo.file_type]
        );
      } catch (insertErr) {
        const msg = (insertErr && insertErr.message) ? String(insertErr.message) : '';
        if (msg.includes('Unknown column') || msg.includes("doesn't exist")) {
          await query(
            'INSERT INTO chat_messages (from_employee_id, to_employee_id, message, file_path, is_read) VALUES (?, ?, ?, ?, 0)',
            [req.employee.id, to_employee_id, finalMessage || null, fileInfo.file_path]
          );
        } else {
          throw insertErr;
        }
      }
      return res.json({ success: true, message: 'Message sent' });
    } catch (uploadErr) {
      console.error('Chat POST:', uploadErr);
      return res.status(500).json({ success: false, message: uploadErr.message });
    }
  });
});

module.exports = router;
