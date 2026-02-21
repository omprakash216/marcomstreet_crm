const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/guidance', verifyToken, async (req, res) => {
  try {
    const leadId = req.query.lead_id || null;
    let guidance = { tips: [], next_steps: [] };
    if (leadId) {
      const rows = await query('SELECT * FROM leads WHERE id = ?', [leadId]);
      const lead = rows[0];
      if (lead) {
        if (lead.status === 'new') guidance.next_steps.push('Schedule a discovery call', 'Send introductory email');
        else if (lead.status === 'contacted') guidance.next_steps.push('Send proposal', 'Schedule meeting');
        else if (lead.status === 'proposal') guidance.next_steps.push('Follow up on proposal', 'Address objections');
        guidance.tips.push('Maintain regular follow-ups', 'Document all interactions');
      }
    }
    return res.json({ success: true, data: guidance });
  } catch (err) {
    return res.json({ success: true, data: { tips: [], next_steps: [] } });
  }
});

module.exports = router;
