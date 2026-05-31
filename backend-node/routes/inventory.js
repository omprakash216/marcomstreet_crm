const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

function buildItemCode(id) {
    return `ITM${String(id).padStart(5, '0')}`;
}

function normalizePayload(body = {}) {
    const cleanedName = String(body.name || '').trim();
    const cleanedItemCode = String(body.item_code || '').trim().toUpperCase();
    const cleanedBarcode = String(body.barcode || '').trim();
    const cleanedCategory = String(body.category || '').trim();
    const cleanedSubCategory = String(body.sub_category || '').trim();
    const cleanedLocation = String(body.location || '').trim();
    const cleanedSupplier = String(body.supplier || '').trim();
    const cleanedDescription = String(body.description || '').trim();

    return {
        name: cleanedName,
        item_code: cleanedItemCode,
        barcode: cleanedBarcode || null,
        category: cleanedCategory || null,
        sub_category: cleanedSubCategory || null,
        location: cleanedLocation || null,
        quantity: Number(body.quantity || 0),
        minimum_stock_level: Number(body.minimum_stock_level || 0),
        unit_price: Number(body.unit_price || 0),
        supplier: cleanedSupplier || null,
        purchase_date: body.purchase_date || null,
        description: cleanedDescription || null,
        status: body.status || 'available',
        assigned_to_id: body.assigned_to_id || null,
    };
}

function normalizeRow(row = {}) {
    return {
        ...row,
        item_code: row.item_code || (row.id ? buildItemCode(row.id) : null),
        supplier: row.supplier || '',
        location: row.location || '',
        minimum_stock_level:
            row.minimum_stock_level === null || row.minimum_stock_level === undefined
                ? 0
                : Number(row.minimum_stock_level),
        unit_price:
            row.unit_price === null || row.unit_price === undefined
                ? 0
                : Number(row.unit_price),
    };
}

// GET all inventory items
router.get('/', verifyToken, async (req, res) => {
    try {
        const rows = await query(
            `SELECT i.*, e.name as assigned_to_name 
       FROM inventory i 
       LEFT JOIN employees e ON i.assigned_to_id = e.id 
       ORDER BY i.created_at DESC`
        );
        res.json({ success: true, data: rows.map(normalizeRow) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET inventory item by barcode or item code
router.get('/lookup/:code', verifyToken, async (req, res) => {
    try {
        const code = String(req.params.code || '').trim();
        if (!code) return res.status(400).json({ success: false, message: 'Code is required' });
        const rows = await query(
            `SELECT i.*, e.name as assigned_to_name
             FROM inventory i
             LEFT JOIN employees e ON i.assigned_to_id = e.id
             WHERE i.barcode = ? OR i.item_code = ?
             ORDER BY i.created_at DESC LIMIT 1`,
            [code, code]
        );
        return res.json({ success: true, data: rows[0] ? normalizeRow(rows[0]) : null });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// POST new inventory item
router.post('/', verifyToken, async (req, res) => {
    try {
        const d = normalizePayload(req.body);
        if (!d.name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!d.category || !d.location) {
            return res.status(400).json({ success: false, message: 'Category and location are required' });
        }
        if (!Number.isFinite(d.unit_price) || d.unit_price < 0) {
            return res.status(400).json({ success: false, message: 'Unit price is invalid' });
        }

        const result = await query(
            `INSERT INTO inventory (company_id, 
                name, item_code, barcode, category, sub_category, location, quantity,
                minimum_stock_level, unit_price, supplier, purchase_date, description,
                status, assigned_to_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.employee.company_id, d.name, d.item_code || 'PENDING', d.barcode, d.category, d.sub_category, d.location, d.quantity,
                d.minimum_stock_level, d.unit_price, d.supplier, d.purchase_date, d.description,
                d.status, d.assigned_to_id
            ]
        );
        if (!d.item_code) {
            await query('UPDATE inventory SET item_code = ? WHERE id = ? AND company_id = ?', [buildItemCode(result.insertId), result.insertId, req.employee.company_id]);
        }
        res.json({ success: true, message: 'Inventory item added' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT update inventory item
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const d = normalizePayload(req.body);
        if (!d.name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!d.category || !d.location) {
            return res.status(400).json({ success: false, message: 'Category and location are required' });
        }
        await query(
            `UPDATE inventory SET
                name=?, item_code=?, barcode=?, category=?, sub_category=?, location=?, quantity=?,
                minimum_stock_level=?, unit_price=?, supplier=?, purchase_date=?, description=?,
                status=?, assigned_to_id=?, updated_at=NOW()
             WHERE id=?`,
            [
                d.name, d.item_code || buildItemCode(req.params.id), d.barcode, d.category, d.sub_category, d.location, d.quantity,
                d.minimum_stock_level, d.unit_price, d.supplier, d.purchase_date, d.description,
                d.status, d.assigned_to_id, req.params.id
            ]
        );
        res.json({ success: true, message: 'Inventory item updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE inventory item
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await query('DELETE FROM inventory WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Inventory item deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
