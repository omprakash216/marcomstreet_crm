-- Attendance rules: 9:30-9:40 punch in = full_day, after 9:40 = half_day. Punch out 6:30 PM or auto at 12 AM.
-- Run this migration once before using the new punch in/out rules (Node backend).

ALTER TABLE employee_checkins
ADD COLUMN attendance_type ENUM('full_day', 'half_day') DEFAULT NULL
COMMENT 'full_day if punch in 9:30-9:40, else half_day';
