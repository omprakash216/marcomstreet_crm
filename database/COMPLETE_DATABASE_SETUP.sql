-- ============================================
-- MARCOM STREET CRM - COMPLETE DATABASE SETUP
-- ============================================
-- ONE FILE TO RULE THEM ALL
-- Run this file in phpMyAdmin or MySQL to get complete working CRM
-- Database: marcom_street_crm
-- Includes: CRM + HRMS + Chat + All Demo Data

-- Drop existing database if exists
DROP DATABASE IF EXISTS marcom_street_crm;

-- Create Database
CREATE DATABASE marcom_street_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use Database
USE marcom_street_crm;

-- ============================================
-- CORE CRM TABLES
-- ============================================

-- Companies Table
CREATE TABLE companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    zip_code VARCHAR(20),
    website VARCHAR(255),
    tax_id VARCHAR(100),
    registration_number VARCHAR(100),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Company Settings (Admin)
CREATE TABLE company_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    time_zone VARCHAR(80),
    currency VARCHAR(20),
    date_format VARCHAR(40),
    logo_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Departments Table
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employees Table
CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'employee', 'sales_rep', 'human_resources', 'designer') DEFAULT 'employee',
    department_id INT,
    designation VARCHAR(100),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RBAC Tables
CREATE TABLE rbac_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_key VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL,
    description TEXT,
    is_system TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rbac_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module VARCHAR(80) NOT NULL,
    action VARCHAR(80) NOT NULL,
    label VARCHAR(160),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_rbac_perm (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rbac_role_permissions (
    role_key VARCHAR(50) NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_key, permission_id),
    FOREIGN KEY (permission_id) REFERENCES rbac_permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee Checkins Table
CREATE TABLE employee_checkins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status ENUM('checked_in', 'checked_out') DEFAULT 'checked_in',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_checkin (employee_id, date, status),
    INDEX idx_employee_date (employee_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leads Table
CREATE TABLE leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    assigned_to INT NOT NULL,
    source VARCHAR(100),
    status ENUM('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost') DEFAULT 'new',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    estimated_value DECIMAL(15, 2),
    lead_score INT DEFAULT 0,
    notes TEXT,
    next_followup_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_assigned (assigned_to),
    INDEX idx_status (status),
    INDEX idx_next_followup (next_followup_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meetings Table
CREATE TABLE meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT,
    employee_id INT NOT NULL,
    meeting_type ENUM('client_meeting', 'follow_up', 'presentation', 'other') DEFAULT 'client_meeting',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    meeting_date DATETIME NOT NULL,
    duration_minutes INT DEFAULT 60,
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status ENUM('scheduled', 'completed', 'cancelled', 'rescheduled') DEFAULT 'scheduled',
    outcome TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee (employee_id),
    INDEX idx_meeting_date (meeting_date),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tasks Table
CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    lead_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type ENUM('follow_up', 'meeting', 'call', 'email', 'document', 'other') DEFAULT 'other',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    due_date DATETIME,
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    completed_at DATETIME,
    work_file_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    INDEX idx_employee (employee_id),
    INDEX idx_due_date (due_date),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Followups Table
CREATE TABLE followups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    employee_id INT NOT NULL,
    followup_type ENUM('call', 'email', 'whatsapp', 'meeting', 'other') DEFAULT 'call',
    scheduled_date DATETIME NOT NULL,
    completed_date DATETIME,
    status ENUM('pending', 'completed', 'missed', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    outcome TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee (employee_id),
    INDEX idx_scheduled (scheduled_date),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quotations Table
CREATE TABLE quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    lead_id INT NOT NULL,
    employee_id INT NOT NULL,
    issue_date DATE NOT NULL,
    valid_until DATE,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
    notes TEXT,
    terms_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_lead (lead_id),
    INDEX idx_employee (employee_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quotation Items Table
CREATE TABLE quotation_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    INDEX idx_quotation (quotation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices Table
CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    quotation_id INT,
    lead_id INT NOT NULL,
    employee_id INT NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
    notes TEXT,
    payment_terms TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_lead (lead_id),
    INDEX idx_employee (employee_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice Items Table
CREATE TABLE invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- HRMS MODULE TABLES
-- ============================================

-- Leaves Table
CREATE TABLE leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    type ENUM('sick', 'casual', 'annual', 'other') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_employee (employee_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Salary Slips Table
CREATE TABLE salary_slips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    
    -- Pay Period
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    month VARCHAR(20) NOT NULL,
    
    -- Earnings
    basic_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    hra DECIMAL(15, 2) NOT NULL DEFAULT 0,
    conveyance_allowance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    medical_allowance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    special_allowance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    other_allowances DECIMAL(15, 2) NOT NULL DEFAULT 0,
    gross_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Deductions
    pf_deduction DECIMAL(15, 2) NOT NULL DEFAULT 0,
    esi_deduction DECIMAL(15, 2) NOT NULL DEFAULT 0,
    tax_deduction DECIMAL(15, 2) NOT NULL DEFAULT 0,
    professional_tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
    other_deductions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Net Salary
    net_salary DECIMAL(15, 2) NOT NULL DEFAULT 0,
    amount DECIMAL(15, 2) NOT NULL, -- For backward compatibility (stores gross_salary)
    
    -- File and Status
    file_path VARCHAR(255) NOT NULL,
    status ENUM('generated', 'paid') DEFAULT 'generated',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_month (employee_id, month),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HR Documents Table
CREATE TABLE hr_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    type ENUM('offer_letter', 'experience_letter', 'policy', 'other') NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee (employee_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHAT & COMMUNICATION TABLES
-- ============================================

-- Chat Messages Table
CREATE TABLE chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_employee_id INT NOT NULL,
    to_employee_id INT NOT NULL,
    message TEXT NOT NULL,
    file_path VARCHAR(255),
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (to_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_chat_participants (from_employee_id, to_employee_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WhatsApp Logs Table
CREATE TABLE whatsapp_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    lead_id INT,
    phone_number VARCHAR(20) NOT NULL,
    message_type ENUM('sent', 'received') DEFAULT 'sent',
    message TEXT NOT NULL,
    status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    INDEX idx_employee (employee_id),
    INDEX idx_lead (lead_id),
    INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SYSTEM & LOGGING TABLES
-- ============================================

-- Activity Logs Table
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee (employee_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Audit Log Table
CREATE TABLE api_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSON,
    response_code INT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_employee_access (employee_id, accessed_at),
    INDEX idx_endpoint (endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reports Table
CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    date_from DATE,
    date_to DATE,
    report_data TEXT,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee (employee_id),
    INDEX idx_report_type (report_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reminders Table
CREATE TABLE reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    lead_id INT,
    task_id INT,
    reminder_type ENUM('follow_up', 'meeting', 'task', 'custom') DEFAULT 'custom',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    reminder_date DATETIME NOT NULL,
    status ENUM('pending', 'sent', 'dismissed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    INDEX idx_employee (employee_id),
    INDEX idx_reminder_date (reminder_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT DEMO DATA
-- ============================================

-- Insert Departments
INSERT IGNORE INTO departments (name, description) VALUES
('Sales', 'Sales and Business Development'),
('HR', 'Human Resources and Recruitment'),
('IT', 'Information Technology and Support'),
('Design', 'Creative and UI/UX Design'),
('Management', 'Upper Management and Operations');

-- Insert Demo Companies
INSERT INTO companies (company_name, email, phone, password, address, city, state, country, zip_code, website, tax_id, registration_number, status) VALUES
('Marcom Street CRM', 'admin@marcomstreet.com', '+91-9876543210', 'password123', '123 Business Street', 'Mumbai', 'Maharashtra', 'India', '400001', 'https://marcomstreet.com', 'TAX-12345', 'REG-67890', 'active'),
('Tech Solutions Inc', 'info@techsolutions.com', '+1987654321', 'password123', '123 Tech Street', 'San Francisco', 'CA', 'USA', '94102', 'https://techsolutions.com', 'TAX-12346', 'REG-67891', 'active');

-- Insert Company Settings (single row)
INSERT INTO company_settings (company_name, email, phone, address, time_zone, currency, date_format) VALUES
('Marcom Street CRM', 'admin@marcomstreet.com', '+91-9876543210', '123 Business Street, Mumbai', 'Asia/Kolkata', 'INR', 'DD/MM/YYYY');

-- Insert RBAC Roles
INSERT INTO rbac_roles (role_key, label, description, is_system) VALUES
('admin','Admin','Full system access',1),
('human_resources','HR Manager','HR module access',1),
('manager','Sales Manager','Sales management access',1),
('sales_rep','Sales Agent','Sales execution access',1),
('employee','Employee','Basic employee access',1);

-- Insert RBAC Permissions
INSERT INTO rbac_permissions (module, action, label) VALUES
('dashboard','view','View Dashboard'),
('leads','view','View Leads'),
('leads','create','Create Leads'),
('leads','edit','Edit Leads'),
('leads','delete','Delete Leads'),
('meetings','view','View Meetings'),
('meetings','create','Create Meetings'),
('meetings','edit','Edit Meetings'),
('meetings','delete','Delete Meetings'),
('tasks','view','View Tasks'),
('tasks','create','Create Tasks'),
('tasks','edit','Edit Tasks'),
('tasks','delete','Delete Tasks'),
('followups','view','View Follow Ups'),
('followups','create','Create Follow Ups'),
('followups','edit','Edit Follow Ups'),
('followups','delete','Delete Follow Ups'),
('invoices','view','View Invoices'),
('invoices','create','Create Invoices'),
('invoices','edit','Edit Invoices'),
('invoices','delete','Delete Invoices'),
('quotations','view','View Quotations'),
('quotations','create','Create Quotations'),
('quotations','edit','Edit Quotations'),
('quotations','delete','Delete Quotations'),
('hrms','view','View HRMS'),
('hrms','manage','Manage HRMS'),
('admin','view','Access Admin Module'),
('admin','manage','Admin Manage'),
('reports','view','View Reports'),
('settings','manage','Manage Settings');

-- Grant all permissions to Admin by default
INSERT INTO rbac_role_permissions (role_key, permission_id)
SELECT 'admin', id FROM rbac_permissions;

-- Insert Employees with Departments
INSERT INTO employees (employee_code, name, email, phone, password, role, department_id, designation, status) VALUES
('EMP001', 'John Manager', 'john.manager@crm.com', '+1234567890', 'password123', 'manager', (SELECT id FROM departments WHERE name = 'Management' LIMIT 1), 'Sales Manager', 'active'),
('EMP002', 'Sarah Sales', 'sarah.sales@crm.com', '+1234567891', 'password123', 'sales_rep', (SELECT id FROM departments WHERE name = 'Sales' LIMIT 1), 'Sales Representative', 'active'),
('EMP003', 'Mike Rep', 'mike.rep@crm.com', '+1234567892', 'password123', 'employee', (SELECT id FROM departments WHERE name = 'Sales' LIMIT 1), 'Sales Executive', 'active'),
('EMP004', 'Admin User', 'admin@crm.com', '+1234567893', 'password123', 'admin', (SELECT id FROM departments WHERE name = 'Management' LIMIT 1), 'System Administrator', 'active'),
('EMP005', 'HR Manager', 'hr@crm.com', '+1234567894', 'password123', 'human_resources', (SELECT id FROM departments WHERE name = 'HR' LIMIT 1), 'HR Manager', 'active'),
('EMP006', 'Alex Designer', 'alex.designer@crm.com', '+1234567895', 'password123', 'designer', (SELECT id FROM departments WHERE name = 'Marketing' LIMIT 1), 'UI/UX Designer', 'active');


-- Insert Sample Leads
INSERT INTO leads (lead_code, company_name, contact_person, email, phone, assigned_to, source, status, priority, estimated_value, lead_score, notes, next_followup_date) VALUES
('LEAD001', 'Tech Solutions Inc', 'David Johnson', 'david@techsolutions.com', '+1987654321', 2, 'Website', 'qualified', 'high', 50000.00, 75, 'Interested in enterprise package', DATE_ADD(NOW(), INTERVAL 2 DAY)),
('LEAD002', 'Global Enterprises', 'Emma Wilson', 'emma@globalent.com', '+1987654322', 2, 'Referral', 'contacted', 'medium', 30000.00, 60, 'Initial contact made', DATE_ADD(NOW(), INTERVAL 1 DAY)),
('LEAD003', 'Startup Hub', 'Robert Brown', 'robert@startuphub.com', '+1987654323', 3, 'Social Media', 'new', 'low', 15000.00, 40, 'New inquiry', DATE_ADD(NOW(), INTERVAL 3 DAY)),
('LEAD004', 'Mega Corp Ltd', 'Lisa Anderson', 'lisa@megacorp.com', '+1987654324', 2, 'Cold Call', 'proposal', 'high', 75000.00, 85, 'Proposal sent, awaiting response', DATE_ADD(NOW(), INTERVAL 1 DAY)),
('LEAD005', 'Innovation Labs', 'James Taylor', 'james@innolabs.com', '+1987654325', 3, 'Website', 'negotiation', 'urgent', 60000.00, 90, 'Final negotiation stage', DATE_ADD(NOW(), INTERVAL 1 DAY)),
('LEAD006', 'Digital Agency', 'Maria Garcia', 'maria@digitalagency.com', '+1987654326', 2, 'Email Campaign', 'contacted', 'medium', 25000.00, 55, 'Follow-up scheduled', DATE_ADD(NOW(), INTERVAL 2 DAY)),
('LEAD007', 'Cloud Services Co', 'William Martinez', 'william@cloudservices.com', '+1987654327', 3, 'Trade Show', 'qualified', 'high', 45000.00, 70, 'Qualified lead', DATE_ADD(NOW(), INTERVAL 3 DAY)),
('LEAD008', 'Finance Group', 'Jennifer Lee', 'jennifer@financegroup.com', '+1987654328', 2, 'Referral', 'new', 'medium', 35000.00, 50, 'New referral', DATE_ADD(NOW(), INTERVAL 2 DAY)),
('LEAD009', 'Retail Chain', 'Michael White', 'michael@retailchain.com', '+1987654329', 3, 'Cold Call', 'contacted', 'low', 20000.00, 45, 'Initial conversation', DATE_ADD(NOW(), INTERVAL 4 DAY)),
('LEAD010', 'Manufacturing Co', 'Patricia Harris', 'patricia@manufacturing.com', '+1987654330', 2, 'Website', 'qualified', 'high', 55000.00, 80, 'Strong interest shown', DATE_ADD(NOW(), INTERVAL 1 DAY));

-- Insert Check-ins
INSERT INTO employee_checkins (employee_id, date, time, location, status) VALUES
(2, CURDATE(), '09:00:00', 'Office - Main Building', 'checked_in'),
(3, CURDATE(), '09:15:00', 'Office - Main Building', 'checked_in'),
(4, CURDATE(), '08:45:00', 'Office - Main Building', 'checked_in'),
(5, CURDATE(), '09:30:00', 'Office - Main Building', 'checked_in');

-- Insert Meetings
INSERT INTO meetings (lead_id, employee_id, meeting_type, title, description, meeting_date, duration_minutes, location, status, outcome, notes) VALUES
(1, 2, 'client_meeting', 'Product Demo - Tech Solutions', 'Demonstrating enterprise features', DATE_SUB(NOW(), INTERVAL 1 DAY), 90, 'Client Office', 'completed', 'Positive feedback, proposal requested', 'Client showed strong interest'),
(4, 2, 'presentation', 'Proposal Presentation - Mega Corp', 'Presenting solution proposal', DATE_ADD(NOW(), INTERVAL 1 DAY), 120, 'Conference Room', 'scheduled', NULL, 'Prepared presentation deck'),
(5, 3, 'client_meeting', 'Final Discussion - Innovation Labs', 'Finalizing contract terms', DATE_ADD(NOW(), INTERVAL 1 DAY), 60, 'Client Office', 'scheduled', NULL, 'Bring contract documents'),
(2, 2, 'follow_up', 'Follow-up Call - Global Enterprises', 'Discussing requirements', DATE_ADD(NOW(), INTERVAL 1 DAY), 30, 'Phone Call', 'scheduled', NULL, 'Prepare pricing sheet'),
(7, 3, 'client_meeting', 'Initial Meeting - Cloud Services', 'First face-to-face meeting', DATE_ADD(NOW(), INTERVAL 2 DAY), 60, 'Coffee Shop', 'scheduled', NULL, 'Bring company brochure');

-- Insert Tasks
INSERT INTO tasks (employee_id, lead_id, title, description, task_type, priority, due_date, status) VALUES
(2, 1, 'Prepare proposal for Tech Solutions', 'Create detailed proposal document', 'document', 'high', DATE_ADD(NOW(), INTERVAL 1 DAY), 'in_progress'),
(2, 4, 'Review contract terms', 'Review and finalize contract', 'document', 'urgent', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
(3, 5, 'Send final quote', 'Prepare and send final quotation', 'email', 'urgent', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
(2, 2, 'Call Global Enterprises', 'Follow-up call to discuss requirements', 'call', 'medium', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
(3, 7, 'Prepare demo presentation', 'Create demo slides for Cloud Services', 'document', 'medium', DATE_ADD(NOW(), INTERVAL 2 DAY), 'pending');

-- Insert Follow-ups
INSERT INTO followups (lead_id, employee_id, followup_type, scheduled_date, status, notes) VALUES
(1, 2, 'call', DATE_ADD(NOW(), INTERVAL 2 DAY), 'pending', 'Follow up on proposal'),
(2, 2, 'email', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending', 'Send product brochure'),
(3, 3, 'whatsapp', DATE_ADD(NOW(), INTERVAL 3 DAY), 'pending', 'Share pricing information'),
(4, 2, 'meeting', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending', 'Proposal presentation'),
(5, 3, 'call', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending', 'Final negotiation call');

-- Insert Quotations
INSERT INTO quotations (quotation_number, lead_id, employee_id, issue_date, valid_until, subtotal, tax_percentage, tax_amount, total_amount, status, notes) VALUES
('QUO-2024-001', 1, 2, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 25 DAY), 50000.00, 10.00, 5000.00, 55000.00, 'sent', 'Enterprise package quotation'),
('QUO-2024-002', 4, 2, DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 27 DAY), 75000.00, 10.00, 7500.00, 82500.00, 'sent', 'Premium package quotation'),
('QUO-2024-003', 5, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 28 DAY), 60000.00, 10.00, 6000.00, 66000.00, 'accepted', 'Accepted quotation');

-- Insert Quotation Items
INSERT INTO quotation_items (quotation_id, item_name, description, quantity, unit_price, total_price) VALUES
(1, 'Enterprise License', 'Annual enterprise license', 1, 45000.00, 45000.00),
(1, 'Support Package', 'Premium support for 1 year', 1, 5000.00, 5000.00),
(2, 'Premium License', 'Annual premium license', 1, 70000.00, 70000.00),
(2, 'Training Sessions', 'On-site training (5 sessions)', 5, 1000.00, 5000.00),
(3, 'Standard License', 'Annual standard license', 1, 55000.00, 55000.00),
(3, 'Support Package', 'Standard support for 1 year', 1, 5000.00, 5000.00);

-- Insert Invoices
INSERT INTO invoices (invoice_number, quotation_id, lead_id, employee_id, issue_date, due_date, subtotal, tax_percentage, tax_amount, total_amount, status, notes) VALUES
('INV-2024-001', 3, 5, 3, DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 29 DAY), 60000.00, 10.00, 6000.00, 66000.00, 'sent', 'Invoice for accepted quotation');

-- Insert Invoice Items
INSERT INTO invoice_items (invoice_id, item_name, description, quantity, unit_price, total_price) VALUES
(1, 'Standard License', 'Annual standard license', 1, 55000.00, 55000.00),
(1, 'Support Package', 'Standard support for 1 year', 1, 5000.00, 5000.00);

-- Insert HRMS Data
INSERT INTO leaves (employee_id, type, start_date, end_date, reason, status, approved_by) VALUES
(2, 'annual', DATE_ADD(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'Family vacation', 'approved', 4),
(3, 'sick', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'Medical appointment', 'pending', NULL),
(5, 'casual', DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'Personal work', 'pending', NULL);

INSERT INTO salary_slips (
    employee_id, pay_period_start, pay_period_end, month,
    basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance, other_allowances, gross_salary,
    pf_deduction, esi_deduction, tax_deduction, professional_tax, other_deductions, total_deductions,
    net_salary, amount, file_path, status
) VALUES
-- Sarah Sales - Sales Representative
(2, DATE_FORMAT(CURDATE(), '%Y-%m-01'), LAST_DAY(CURDATE()), DATE_FORMAT(CURDATE(), '%Y-%m'),
 45000.00, 18000.00, 3000.00, 2500.00, 5000.00, 1500.00, 75000.00,
 5400.00, 562.50, 3750.00, 200.00, 0.00, 9912.50,
 65087.50, 75000.00, 'uploads/salary_slips/EMP002_2026-01.pdf', 'generated'),

-- Mike Rep - Sales Executive  
(3, DATE_FORMAT(CURDATE(), '%Y-%m-01'), LAST_DAY(CURDATE()), DATE_FORMAT(CURDATE(), '%Y-%m'),
 40000.00, 16000.00, 2500.00, 2000.00, 3500.00, 1000.00, 65000.00,
 4800.00, 487.50, 3250.00, 200.00, 0.00, 8737.50,
 56262.50, 65000.00, 'uploads/salary_slips/EMP003_2026-01.pdf', 'paid'),

-- Admin User - System Administrator
(4, DATE_FORMAT(CURDATE(), '%Y-%m-01'), LAST_DAY(CURDATE()), DATE_FORMAT(CURDATE(), '%Y-%m'),
 55000.00, 22000.00, 3500.00, 3000.00, 5000.00, 1500.00, 90000.00,
 6600.00, 675.00, 4500.00, 200.00, 0.00, 11975.00,
 78025.00, 90000.00, 'uploads/salary_slips/EMP004_2026-01.pdf', 'paid'),

-- HR Manager
(5, DATE_FORMAT(CURDATE(), '%Y-%m-01'), LAST_DAY(CURDATE()), DATE_FORMAT(CURDATE(), '%Y-%m'),
 42000.00, 16800.00, 3000.00, 2500.00, 4500.00, 1200.00, 70000.00,
 5040.00, 525.00, 3500.00, 200.00, 0.00, 9265.00,
 60735.00, 70000.00, 'uploads/salary_slips/EMP005_2026-01.pdf', 'generated');

INSERT INTO hr_documents (employee_id, title, type, file_path) VALUES
(2, 'Offer Letter - Sarah Sales', 'offer_letter', '/uploads/hr_docs/offer_letter_sarah.pdf'),
(3, 'Experience Letter - Mike Rep', 'experience_letter', '/uploads/hr_docs/experience_letter_mike.pdf'),
(4, 'Company Policy Manual', 'policy', '/uploads/hr_docs/company_policy.pdf'),
(5, 'HR Guidelines 2024', 'policy', '/uploads/hr_docs/hr_guidelines.pdf');

-- Insert Chat Messages
INSERT INTO chat_messages (from_employee_id, to_employee_id, message, is_read) VALUES
(2, 3, 'Hi Mike, can you share the latest lead details?', FALSE),
(3, 2, 'Sure Sarah, I will send them right away.', TRUE),
(4, 2, 'Sarah, please update the Tech Solutions lead status.', TRUE),
(2, 4, 'Done, updated to qualified status.', TRUE),
(5, 4, 'Admin, need approval for leave request.', FALSE);

-- Insert WhatsApp Logs
INSERT INTO whatsapp_logs (employee_id, lead_id, phone_number, message_type, message, status) VALUES
(2, 1, '+1987654321', 'sent', 'Hi David, thank you for your interest. I will send the proposal shortly.', 'delivered'),
(2, 2, '+1987654322', 'sent', 'Hello Emma, I have attached the product brochure as requested.', 'read'),
(3, 3, '+1987654323', 'sent', 'Hi Robert, let me know a convenient time for a call.', 'sent'),
(2, 4, '+1987654324', 'sent', 'Hi Lisa, the proposal has been sent. Please review and let me know.', 'delivered');

-- Insert Activity Logs
INSERT INTO activity_logs (employee_id, activity_type, entity_type, entity_id, description, ip_address) VALUES
(2, 'login', 'employee', 2, 'Employee logged in', '192.168.1.100'),
(2, 'checkin', 'checkin', 1, 'Employee checked in', '192.168.1.100'),
(2, 'lead_created', 'lead', 1, 'New lead created: Tech Solutions Inc', '192.168.1.100'),
(3, 'login', 'employee', 3, 'Employee logged in', '192.168.1.101'),
(4, 'login', 'employee', 4, 'Admin logged in', '192.168.1.102');

-- Insert Reports
INSERT INTO reports (employee_id, report_name, report_type, date_from, date_to, report_data, status) VALUES
(2, 'Monthly Sales Report', 'sales', DATE_SUB(CURDATE(), INTERVAL 30 DAY), CURDATE(), '{"leads": 10, "meetings": 5, "invoices": 3}', 'completed'),
(2, 'Performance Report Q1', 'performance', DATE_SUB(CURDATE(), INTERVAL 90 DAY), CURDATE(), '{"tasks_completed": 25, "leads_converted": 8}', 'completed'),
(3, 'Weekly Activity Report', 'activity', DATE_SUB(CURDATE(), INTERVAL 7 DAY), CURDATE(), '{"activities": 15, "followups": 12}', 'completed');

-- Insert Reminders
INSERT INTO reminders (employee_id, lead_id, task_id, reminder_type, title, message, reminder_date, status) VALUES
(2, 1, 1, 'task', 'Proposal Deadline', 'Proposal for Tech Solutions due tomorrow', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
(2, 4, 2, 'task', 'Contract Review', 'Review contract terms for Mega Corp', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
(3, 5, 3, 'task', 'Send Quote', 'Send final quote to Innovation Labs', DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
(2, NULL, NULL, 'follow_up', 'Daily Follow-up Check', 'Check pending follow-ups for today', NOW(), 'pending');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries to verify everything is working:
--
-- SELECT 'Database Created Successfully!' as status;
-- SELECT COUNT(*) as total_employees FROM employees;
-- SELECT COUNT(*) as total_leads FROM leads;
-- SELECT COUNT(*) as total_departments FROM departments;
-- SELECT COUNT(*) as total_chat_messages FROM chat_messages;
-- SELECT COUNT(*) as total_companies FROM companies;
-- SELECT COUNT(*) as total_reports FROM reports;
-- SELECT email, password FROM employees;
-- SHOW TABLES;
--
-- Expected Results:
-- total_employees: 5
-- total_leads: 10
-- total_departments: 5
-- total_chat_messages: 5
-- total_companies: 2
-- total_reports: 3

-- ============================================
-- END OF COMPLETE DATABASE SETUP
-- ============================================
