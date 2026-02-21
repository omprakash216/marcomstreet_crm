-- HR must provide reason when editing attendance (why edit / why late).
USE marcom_street_crm;

ALTER TABLE employee_checkins
ADD COLUMN edit_reason TEXT NULL
COMMENT 'Reason for HR edit: why attendance was edited or why employee was late'
AFTER is_late;

SELECT 'Migration 008: edit_reason column added to employee_checkins.' AS status;
