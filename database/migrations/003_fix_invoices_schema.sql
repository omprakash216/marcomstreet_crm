-- Migration: Add missing columns to invoices
-- Description: Adds company_id which is required for Admin Dashboard analytics

USE marcom_street_crm;

ALTER TABLE invoices 
ADD COLUMN company_id INT(11) DEFAULT NULL AFTER quotation_id;
