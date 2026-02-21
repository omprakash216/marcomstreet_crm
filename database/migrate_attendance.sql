-- Migration Script: Align Attendance Schema
-- Adds check_in_time, check_out_time and other required columns to employee_checkins
-- Ensures compatibility with HRMS attendance module

USE marcom_street_crm;

-- Add new columns if they don't exist
ALTER TABLE employee_checkins
ADD COLUMN check_in_time TIME AFTER date,
ADD COLUMN check_out_time TIME AFTER check_in_time,
ADD COLUMN check_in_location VARCHAR(255) AFTER check_out_time,
ADD COLUMN check_out_location VARCHAR(255) AFTER check_in_location,
ADD COLUMN total_hours DECIMAL(5, 2) DEFAULT 0 AFTER check_out_location;

-- Migrate existing data
-- Map existing 'time' and 'location' to 'check_in_time' and 'check_in_location' for existing 'checked_in' status records
UPDATE employee_checkins 
SET check_in_time = time, 
    check_in_location = location 
WHERE status = 'checked_in' AND check_in_time IS NULL;

-- If there are 'checked_out' records that should be merged with check_in records (advanced, but for now we just fix the schema)
-- Most legacy records are single-entry 'checked_in' or 'checked_out'

-- Update status to be more robust (though we'll keep the column for backward compatibility)
ALTER TABLE employee_checkins MODIFY COLUMN status ENUM('checked_in', 'checked_out', 'completed') DEFAULT 'checked_in';

-- Add unique index for (employee_id, date) to enforce one record per day if not already handled by logic
-- Note: existing unique key unique_checkin (employee_id, date, status) might allow two records per day. 
-- We'll keep it as is for now but the PHP logic will handle UPSERT.

SELECT 'Attendance migration completed successfully!' as status;
