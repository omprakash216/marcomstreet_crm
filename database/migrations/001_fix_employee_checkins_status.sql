-- Migration: Fix employee_checkins status column ENUM values
-- Date: 2026-01-07
-- Description: Update status column to support all necessary states including 'completed'

USE marcom_street_crm;

-- Update the status column to include all necessary ENUM values
ALTER TABLE employee_checkins 
MODIFY COLUMN status ENUM('pending', 'checked_in', 'checked_out', 'completed') 
DEFAULT 'pending';

-- Update any existing 'checked_out' records to 'completed' if they have check_out_time
UPDATE employee_checkins 
SET status = 'completed' 
WHERE check_out_time IS NOT NULL AND status = 'checked_out';

-- Verify the change
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'marcom_street_crm' 
  AND TABLE_NAME = 'employee_checkins' 
  AND COLUMN_NAME = 'status';
