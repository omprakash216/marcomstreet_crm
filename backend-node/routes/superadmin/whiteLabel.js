const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

const WHITE_LABEL_KEYS = [
  'brand_name',
  'product_name',
  'primary_color',
  'accent_color',
  'support_email',
  'support_phone',
  'login_title',
  'login_subtitle',
  'custom_domain',
  'footer_text',
];

const defaults = {
  brand_name: 'Vanya Group',
  product_name: 'MARCOM Street CRM',
  primary_color: '#2c86ab',
  accent_color: '#4f46e5',
  support_email: '',
  support_phone: '',
  login_title: 'Welcome Back',
  login_subtitle: 'Sign in to continue to your CRM workspace',
  custom_domain: '',
  footer_text: 'Powered by MARCOM Street CRM',
};

async function ensureGlobalSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS global_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(120) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

router.get('/', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    await ensureGlobalSettingsTable();
    const rows = await query(
      `SELECT setting_key, setting_value
       FROM global_settings
       WHERE setting_key IN (${WHITE_LABEL_KEYS.map(() => '?').join(',')})`,
      WHITE_LABEL_KEYS.map((key) => `white_label_${key}`)
    );

    const data = { ...defaults };
    for (const row of rows) {
      const key = String(row.setting_key || '').replace(/^white_label_/, '');
      if (WHITE_LABEL_KEYS.includes(key)) data[key] = row.setting_value || '';
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await ensureGlobalSettingsTable();
    const body = req.body || {};
    for (const key of WHITE_LABEL_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const settingKey = `white_label_${key}`;
      const value = String(body[key] ?? '').trim();
      await query(
        'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [settingKey, value, value]
      );
    }
    res.json({ success: true, message: 'White label settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
