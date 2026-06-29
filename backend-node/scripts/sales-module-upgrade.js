#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getConnection } = require('../config/database');

async function safe(conn, sql) {
  try {
    await conn.execute(sql);
    console.log('OK:', sql.split('\n')[0].slice(0, 120));
  } catch (err) {
    const msg = String(err.message || '');
    if (
      err.code === 'ER_DUP_FIELDNAME' ||
      err.code === 'ER_DUP_KEYNAME' ||
      err.code === 'ER_TABLE_EXISTS_ERROR' ||
      msg.includes('Duplicate column') ||
      msg.includes('Duplicate key name') ||
      msg.includes('already exists')
    ) {
      console.log('SKIP:', sql.split('\n')[0].slice(0, 120));
      return;
    }
    throw err;
  }
}

async function run() {
  let conn;
  try {
    conn = await getConnection();

    // Shared document logging / upload metadata.
    await safe(conn, `
      CREATE TABLE IF NOT EXISTS attachments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        module_type VARCHAR(80) NOT NULL,
        entity_type VARCHAR(80) NOT NULL,
        entity_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NULL,
        file_size BIGINT NULL DEFAULT 0,
        uploaded_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_attachments_company (company_id),
        INDEX idx_attachments_entity (entity_type, entity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS email_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        module_type VARCHAR(80) NOT NULL,
        entity_type VARCHAR(80) NOT NULL,
        entity_id INT NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'sent',
        provider_message_id VARCHAR(255) NULL,
        error_message TEXT NULL,
        sent_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_logs_company (company_id),
        INDEX idx_email_logs_entity (entity_type, entity_id),
        INDEX idx_email_logs_recipient (recipient_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS numbering_settings (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        doc_type VARCHAR(40) NOT NULL,
        prefix VARCHAR(20) NOT NULL DEFAULT 'VG',
        pad_length INT NOT NULL DEFAULT 4,
        use_financial_year TINYINT(1) NOT NULL DEFAULT 1,
        last_number INT NOT NULL DEFAULT 0,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_numbering_company_doc (company_id, doc_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Quotation support columns.
    await safe(conn, 'ALTER TABLE quotations MODIFY COLUMN lead_id INT(11) NULL DEFAULT NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN client_id INT NULL AFTER lead_id');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN billing_address TEXT NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN shipping_address TEXT NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN gst_number VARCHAR(32) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN place_of_supply VARCHAR(120) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN reference_number VARCHAR(80) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN project_name VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN subject VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN salesperson_id INT NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN tds_percentage DECIMAL(5,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN tds_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN round_off_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN sent_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN viewed_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN converted_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN attachment_path VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN attachment_name VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN attachment_type VARCHAR(100) NULL');
    await safe(conn, 'ALTER TABLE quotations ADD COLUMN attachment_size BIGINT NULL');
    await safe(conn, "ALTER TABLE quotations MODIFY COLUMN status ENUM('draft','sent','viewed','accepted','declined','rejected','expired','converted') DEFAULT 'draft'");

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS quote_revisions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        quotation_id INT NOT NULL,
        revision_number INT NOT NULL DEFAULT 1,
        snapshot JSON NULL,
        reason VARCHAR(255) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quote_revisions_company (company_id),
        INDEX idx_quote_revisions_quote (quotation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS quote_activities (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        quotation_id INT NOT NULL,
        action VARCHAR(120) NOT NULL,
        description TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_quote_activities_company (company_id),
        INDEX idx_quote_activities_quote (quotation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Invoice support columns.
    await safe(conn, 'ALTER TABLE invoices MODIFY COLUMN lead_id INT(11) NULL DEFAULT NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN client_id INT NULL AFTER quotation_id');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN billing_address TEXT NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN shipping_address TEXT NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN gst_number VARCHAR(32) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN place_of_supply VARCHAR(120) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN order_number VARCHAR(80) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN subject VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN salesperson_id INT NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN round_off_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN payment_terms VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN sent_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN viewed_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN converted_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN attachment_path VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN attachment_name VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN attachment_type VARCHAR(100) NULL');
    await safe(conn, 'ALTER TABLE invoices ADD COLUMN attachment_size BIGINT NULL');
    await safe(conn, "ALTER TABLE invoices MODIFY COLUMN status ENUM('draft','sent','viewed','partially_paid','paid','overdue','cancelled','void') DEFAULT 'draft'");

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS invoice_activities (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        invoice_id INT NOT NULL,
        action VARCHAR(120) NOT NULL,
        description TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_invoice_activities_company (company_id),
        INDEX idx_invoice_activities_invoice (invoice_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Sales orders support columns.
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN reference_number VARCHAR(80) NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN subject VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN billing_address TEXT NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN shipping_address TEXT NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN gst_number VARCHAR(32) NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN place_of_supply VARCHAR(120) NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN salesperson_id INT NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN subtotal DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN tds_percentage DECIMAL(5,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN tds_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN round_off_amount DECIMAL(15,2) NOT NULL DEFAULT 0');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN converted_invoice_id INT NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN sent_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN viewed_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN converted_at DATETIME NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN attachment_path VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN attachment_name VARCHAR(255) NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN attachment_type VARCHAR(100) NULL');
    await safe(conn, 'ALTER TABLE sales_orders ADD COLUMN attachment_size BIGINT NULL');
    await safe(conn, "ALTER TABLE sales_orders MODIFY COLUMN order_status ENUM('draft','sent','confirmed','fulfilled','converted','cancelled') DEFAULT 'draft'");
    await safe(conn, 'ALTER TABLE sales_order_items ADD COLUMN description TEXT NULL');
    await safe(conn, 'ALTER TABLE sales_order_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1');

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS sales_order_activities (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        sales_order_id INT NOT NULL,
        action VARCHAR(120) NOT NULL,
        description TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sales_order_activities_company (company_id),
        INDEX idx_sales_order_activities_order (sales_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Customer address helper table used by document workflows.
    await safe(conn, `
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        client_id INT NOT NULL,
        address_type ENUM('billing','shipping','other') NOT NULL DEFAULT 'billing',
        address TEXT NOT NULL,
        city VARCHAR(120) NULL,
        state VARCHAR(120) NULL,
        postal_code VARCHAR(20) NULL,
        gst_number VARCHAR(32) NULL,
        place_of_supply VARCHAR(120) NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_addresses_company (company_id),
        INDEX idx_customer_addresses_client (client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Future-ready document modules.
    await safe(conn, `
      CREATE TABLE IF NOT EXISTS delivery_challans (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        challan_number VARCHAR(50) NOT NULL,
        client_id INT NOT NULL,
        order_id INT NULL,
        invoice_id INT NULL,
        delivery_date DATE NULL,
        vehicle_number VARCHAR(50) NULL,
        transport_name VARCHAR(255) NULL,
        billing_address TEXT NULL,
        shipping_address TEXT NULL,
        gst_number VARCHAR(32) NULL,
        place_of_supply VARCHAR(120) NULL,
        subject VARCHAR(255) NULL,
        subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
        adjustment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        round_off_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        notes TEXT NULL,
        created_by INT NULL,
        attachment_path VARCHAR(255) NULL,
        attachment_name VARCHAR(255) NULL,
        attachment_type VARCHAR(100) NULL,
        attachment_size BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_delivery_challan_number (challan_number),
        INDEX idx_delivery_challans_company (company_id),
        INDEX idx_delivery_challans_client (client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS delivery_challan_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        challan_id BIGINT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_delivery_challan_items_challan (challan_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS credit_notes (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        credit_note_number VARCHAR(50) NOT NULL,
        client_id INT NOT NULL,
        invoice_id INT NULL,
        note_date DATE NULL,
        reason VARCHAR(255) NULL,
        subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        notes TEXT NULL,
        created_by INT NULL,
        attachment_path VARCHAR(255) NULL,
        attachment_name VARCHAR(255) NULL,
        attachment_type VARCHAR(100) NULL,
        attachment_size BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_credit_note_number (credit_note_number),
        INDEX idx_credit_notes_company (company_id),
        INDEX idx_credit_notes_client (client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS credit_note_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        credit_note_id BIGINT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_credit_note_items_note (credit_note_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS recurring_invoices (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        recurring_number VARCHAR(50) NOT NULL,
        client_id INT NOT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        repeat_frequency ENUM('daily','weekly','monthly','yearly') NOT NULL DEFAULT 'monthly',
        next_run_date DATE NULL,
        auto_email TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        subject VARCHAR(255) NULL,
        billing_address TEXT NULL,
        shipping_address TEXT NULL,
        gst_number VARCHAR(32) NULL,
        place_of_supply VARCHAR(120) NULL,
        subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        notes TEXT NULL,
        created_by INT NULL,
        attachment_path VARCHAR(255) NULL,
        attachment_name VARCHAR(255) NULL,
        attachment_type VARCHAR(100) NULL,
        attachment_size BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_recurring_invoice_number (recurring_number),
        INDEX idx_recurring_invoices_company (company_id),
        INDEX idx_recurring_invoices_client (client_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS recurring_invoice_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        recurring_invoice_id BIGINT NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recurring_invoice_items_invoice (recurring_invoice_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      CREATE TABLE IF NOT EXISTS employee_module_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NULL,
        employee_id INT NOT NULL,
        module_key VARCHAR(80) NOT NULL,
        allowed TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_employee_module (employee_id, module_key),
        INDEX idx_employee (employee_id),
        INDEX idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe(conn, `
      INSERT IGNORE INTO employee_module_access (company_id, employee_id, module_key, allowed)
      SELECT DISTINCT company_id, employee_id, 'sales_orders', 1
      FROM employee_module_access
      WHERE allowed = 1 AND module_key IN ('quotations', 'invoices', 'sales')
    `);

    console.log('Sales module schema upgrade complete.');
  } catch (err) {
    console.error('Sales module schema upgrade failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
  }
}

run();
