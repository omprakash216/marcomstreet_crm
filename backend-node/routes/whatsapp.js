const express = require('express');
const multer = require('multer');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

function getWhatsappCloudConfig() {
  return {
    accessToken:
      process.env.WHATSAPP_ACCESS_TOKEN
      || process.env.META_AUTH_TOKEN
      || process.env.META_WHATSAPP_ACCESS_TOKEN
      || '',
    phoneNumberId:
      process.env.WHATSAPP_PHONE_NUMBER_ID
      || process.env.META_WHATSAPP_PHONE_NUMBER_ID
      || process.env.WHATSAPP_PHONE_ID
      || process.env.META_PHONE_NUMBER_ID
      || '',
    graphVersion:
      process.env.WHATSAPP_GRAPH_VERSION
      || process.env.META_GRAPH_VERSION
      || 'v20.0',
  };
}

function sanitizePhoneNumber(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function parseJsonSafe(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

async function readResponsePayload(response) {
  const text = await response.text();
  return parseJsonSafe(text) || { raw: text };
}

async function uploadWhatsappMedia({ accessToken, phoneNumberId, graphVersion, buffer, fileName, mimeType }) {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, fileName);
  formData.append('type', mimeType);
  formData.append('messaging_product', 'whatsapp');

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Media upload failed (${response.status})`);
  }

  if (!payload?.id) {
    throw new Error('Media upload succeeded but no media id was returned');
  }

  return payload.id;
}

async function sendWhatsappDocument({ accessToken, phoneNumberId, graphVersion, to, mediaId, fileName, caption }) {
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      id: mediaId,
      filename: fileName,
    },
  };

  if (caption) {
    body.document.caption = caption;
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `WhatsApp send failed (${response.status})`);
  }

  return payload;
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const search = req.query.search || null;
    const dateFrom = req.query.date_from || null;
    const dateTo = req.query.date_to || null;
    let sql = 'SELECT * FROM whatsapp_hits WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (phone LIKE ? OR message LIKE ?)'; const t = '%' + search + '%'; params.push(t, t); }
    if (dateFrom) { sql += ' AND DATE(created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND DATE(created_at) <= ?'; params.push(dateTo); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = await query(sql, params).catch(() => []);
    return res.json({ success: true, data: rows || [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.post('/send-document', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { accessToken, phoneNumberId, graphVersion } = getWhatsappCloudConfig();
    if (!accessToken || !phoneNumberId) {
      return res.status(501).json({
        success: false,
        message: 'WhatsApp Cloud API is not configured on this server.',
      });
    }

    const to = sanitizePhoneNumber(req.body?.phone || req.body?.to);
    const message = String(req.body?.message || '').trim();
    const fileName = String(req.body?.filename || req.file?.originalname || 'quotation.pdf').trim();
    const mimeType = String(req.file?.mimetype || 'application/pdf').trim() || 'application/pdf';

    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient phone number is required.' });
    }

    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({ success: false, message: 'PDF file is required.' });
    }

    const mediaId = await uploadWhatsappMedia({
      accessToken,
      phoneNumberId,
      graphVersion,
      buffer: req.file.buffer,
      fileName,
      mimeType,
    });

    const sendResult = await sendWhatsappDocument({
      accessToken,
      phoneNumberId,
      graphVersion,
      to,
      mediaId,
      fileName,
      caption: message,
    });

    return res.json({
      success: true,
      message: 'Quotation PDF sent to WhatsApp.',
      data: {
        media_id: mediaId,
        whatsapp_message: sendResult,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to send WhatsApp document.',
    });
  }
});

module.exports = router;
