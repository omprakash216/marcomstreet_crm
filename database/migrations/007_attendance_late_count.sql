-- Attendance rules: late punch-in tracking and 4th-late = half day
-- Punch-in 09:30–10:00 = on time; after 10:00 = late; 4th late in period = half day.
-- Late count resets per company policy (e.g. monthly); this column stores per-record is_late.

USE marcom_street_crm;

ALTER TABLE employee_checkins
ADD COLUMN is_late TINYINT(1) NOT NULL DEFAULT 0
COMMENT '1 if punch-in was after 10:00 AM, else 0'
AFTER attendance_type;

SELECT 'Migration 007: is_late column added to employee_checkins.' AS status;
