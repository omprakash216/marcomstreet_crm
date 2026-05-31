const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

router.get('/revenue', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const monthlyRevenue = await query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as revenue
      FROM transactions
      WHERE status='succeeded'
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY month DESC
      LIMIT 12
    `);
    const activeSubs = await query("SELECT COUNT(*) as c FROM subscriptions WHERE status='active' OR status='trial'");
    const subsGrowth = await query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as value
      FROM subscriptions
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY month DESC
      LIMIT 12
    `);
    res.json({
      success: true,
      data: {
        monthlyRevenue: (monthlyRevenue || []).reverse(),
        activeSubscriptions: Number(activeSubs?.[0]?.c || 0),
        subscriptionGrowth: (subsGrowth || []).reverse(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/usage', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const usage = await query(`
      SELECT cu.*, c.company_name
      FROM company_usage cu
      LEFT JOIN companies c ON c.id = cu.company_id
      ORDER BY cu.updated_at DESC
      LIMIT 500
    `);
    const apiUsage = await query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as day, COUNT(*) as requests
      FROM api_logs
      GROUP BY DATE(created_at)
      ORDER BY day DESC
      LIMIT 14
    `).catch(() => []);
    res.json({
      success: true,
      data: {
        companyUsage: usage || [],
        apiUsage: (apiUsage || []).reverse(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

