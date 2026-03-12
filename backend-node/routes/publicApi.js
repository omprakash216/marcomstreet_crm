const express = require('express');
const { query } = require('../config/database');
const { verifyApiKey } = require('../middleware/auth');
const {
  logApiRequest,
  logWebhookRequest,
  insertLeadForCompany,
  insertLeadsBatch,
  allowedWebhookSources,
  safeStringify,
} = require('../services/apiIntegration');

const router = express.Router();

// Helper to trigger webhooks
async function triggerWebhook(companyId, event, data) {
    try {
        const rows = await query('SELECT webhook_url FROM api_keys WHERE company_id = ? AND webhook_url IS NOT NULL', [companyId]);
        if (rows[0] && rows[0].webhook_url) {
            console.log(`[Webhook] Triggering ${event} for company ${companyId} at ${rows[0].webhook_url}`);
            await fetch(rows[0].webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    timestamp: new Date().toISOString(),
                    data
                })
            }).catch(err => console.error(`[Webhook Error] ${err.message}`));
        }
    } catch (err) {
        console.error(`[Webhook System Error] ${err.message}`);
    }
}

// Public Lead Creation Endpoint
router.post('/leads', verifyApiKey, async (req, res) => {
    const payload = req.body || {};
    const endpoint = req.originalUrl;
    try {
        const lead = await insertLeadForCompany(req.company_id, payload);
        await logApiRequest({
            company_id: req.company_id,
            endpoint,
            method: req.method,
            request_body: safeStringify(payload),
            response_status: 200,
            success: 1,
        });
        triggerWebhook(req.company_id, 'lead.created', lead);
        return res.json({
            success: true,
            message: 'Lead created successfully via API',
            data: lead,
        });
    } catch (err) {
        await logApiRequest({
            company_id: req.company_id,
            endpoint,
            method: req.method,
            request_body: safeStringify(payload),
            response_status: err.statusCode || 400,
            success: 0,
        });
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
});

router.post('/leads/batch', verifyApiKey, async (req, res) => {
    const leads = Array.isArray(req.body.leads) ? req.body.leads : [];
    const endpoint = req.originalUrl;
    try {
        if (!leads.length) {
            throw Object.assign(new Error('Leads payload is empty'), { statusCode: 400 });
        }
        const result = await insertLeadsBatch(req.company_id, leads);
        await logApiRequest({
            company_id: req.company_id,
            endpoint,
            method: req.method,
            request_body: safeStringify({ leads: leads.length }),
            response_status: 200,
            success: 1,
        });
        return res.json({ success: true, message: 'Batch import complete', data: result });
    } catch (err) {
        await logApiRequest({
            company_id: req.company_id,
            endpoint,
            method: req.method,
            request_body: safeStringify({ leads: leads.length }),
            response_status: err.statusCode || 400,
            success: 0,
        });
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
});

router.post('/webhook/leads', verifyApiKey, async (req, res) => {
    const payload = req.body || {};
    const source = String(req.headers['x-webhook-source'] || '').toLowerCase();
    const endpoint = req.originalUrl;
    if (!allowedWebhookSources.includes(source)) {
        await logWebhookRequest({
            company_id: req.company_id,
            source,
            payload: safeStringify(payload),
            response_status: 403,
            success: 0,
        });
        return res.status(400).json({ success: false, message: 'Unsupported webhook source' });
    }
    const leadPayload = payload.lead || payload;
    try {
        const lead = await insertLeadForCompany(req.company_id, leadPayload);
        await logWebhookRequest({
            company_id: req.company_id,
            source,
            payload: safeStringify(leadPayload),
            response_status: 200,
            success: 1,
        });
        return res.json({ success: true, message: 'Webhook processed', data: lead });
    } catch (err) {
        await logWebhookRequest({
            company_id: req.company_id,
            source,
            payload: safeStringify(leadPayload),
            response_status: err.statusCode || 400,
            success: 0,
        });
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
});

module.exports = router;
