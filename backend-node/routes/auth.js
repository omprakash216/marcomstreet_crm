const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

async function findEmployeeByEmail(email) {
  const normalizedEmail = String(email || '').trim();

  // Primary query for current schema (with status column).
  try {
    const rows = await query(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER(?) AND status = ?',
      [normalizedEmail, 'active']
    );
    return rows[0] || null;
  } catch (err) {
    // Backward compatibility for older schemas where `status` column may not exist.
    if (err && err.code === 'ER_BAD_FIELD_ERROR' && /status/i.test(err.message || '')) {
      const rows = await query(
        'SELECT * FROM employees WHERE LOWER(email) = LOWER(?)',
        [normalizedEmail]
      );
      const employee = rows[0] || null;
      if (!employee) return null;

      // If a status-like field exists in older schema, enforce active users only.
      if (employee.status && String(employee.status).toLowerCase() !== 'active') {
        return null;
      }
      return employee;
    }

    throw err;
  }
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const employee = await findEmployeeByEmail(email);
    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    let passwordMatch = false;
    // 1) Plain text match (for existing seed/demo data)
    if (password === employee.password) {
      passwordMatch = true;
    }
    // 2) Bcrypt hash match (PHP password_hash compatibility)
    if (!passwordMatch && typeof employee.password === 'string') {
      try {
        passwordMatch = await bcrypt.compare(password, employee.password);
      } catch (e) {
        // ignore, fall through to error
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const employeeData = {
      id: employee.id,
      employee_code: employee.employee_code || '',
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      role: employee.role || 'employee',
      department: employee.department || '',
      designation: employee.designation || '',
      status: employee.status || 'active',
      created_at: employee.created_at || '',
      updated_at: employee.updated_at || '',
    };

    const token = jwt.sign(
      {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        exp: Math.floor(Date.now() / 1000) + 7 * 86400,
      },
      JWT_SECRET
    );

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        employee: employeeData,
        token,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

router.post('/logout', verifyToken, (req, res) => {
  return res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
