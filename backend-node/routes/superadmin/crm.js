const express = require('express');
const { query } = require('../../config/database');
const { verifyToken, verifySuperAdmin } = require('../../middleware/auth');

const router = express.Router();

// Overview metrics for CRM
router.get('/overview', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const [leads] = await query('SELECT COUNT(*) as c FROM leads');
    const [deals] = await query('SELECT COUNT(*) as c FROM deals');
    const [wonDeals] = await query('SELECT COUNT(*) as c FROM deals WHERE status="won"');
    const [pipelines] = await query('SELECT COUNT(*) as c FROM crm_pipelines');
    const [stages] = await query('SELECT COUNT(*) as c FROM crm_stages');
    const [sources] = await query('SELECT COUNT(*) as c FROM crm_sources');

    const conversion = leads?.c ? Math.round((wonDeals?.c || 0) * 100 / leads.c) : 0;

    res.json({
      success: true,
      data: {
        total_leads: leads?.c || 0,
        total_deals: deals?.c || 0,
        won_deals: wonDeals?.c || 0,
        conversion_rate: conversion,
        pipelines: pipelines?.c || 0,
        stages: stages?.c || 0,
        sources: sources?.c || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Pipelines CRUD
router.get('/pipelines', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM crm_pipelines ORDER BY id DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/pipelines', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const result = await query('INSERT INTO crm_pipelines (name, description) VALUES (?, ?)', [name, description || null]);
    res.json({ success: true, pipeline_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/pipelines/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    await query('UPDATE crm_pipelines SET name=?, description=? WHERE id=?', [name, description || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/pipelines/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM crm_stages WHERE pipeline_id=?', [req.params.id]);
    await query('DELETE FROM crm_pipelines WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stages CRUD
router.get('/stages', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query(`
      SELECT s.*, p.name as pipeline_name
      FROM crm_stages s
      LEFT JOIN crm_pipelines p ON p.id = s.pipeline_id
      ORDER BY p.id, s.position ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/stages', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { pipeline_id, name, position = 0 } = req.body;
    if (!pipeline_id || !name) return res.status(400).json({ success: false, message: 'pipeline_id and name required' });
    const result = await query('INSERT INTO crm_stages (pipeline_id, name, position) VALUES (?, ?, ?)', [pipeline_id, name, position]);
    res.json({ success: true, stage_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/stages/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { name, position } = req.body;
    await query('UPDATE crm_stages SET name=?, position=? WHERE id=?', [name, position ?? 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/stages/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM crm_stages WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Sources CRUD
router.get('/sources', verifyToken, verifySuperAdmin, async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM crm_sources ORDER BY id DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sources', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { name, active = 1 } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    const result = await query('INSERT INTO crm_sources (name, active) VALUES (?, ?)', [name, active ? 1 : 0]);
    res.json({ success: true, source_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sources/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { name, active = 1 } = req.body;
    await query('UPDATE crm_sources SET name=?, active=? WHERE id=?', [name, active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/sources/:id', verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM crm_sources WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
