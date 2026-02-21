-- Fix Roles and Data Migration Script (Corrected)

-- 1. Ensure 'designer' and 'human_resources' are in the ENUM
ALTER TABLE `employees` MODIFY COLUMN `role` ENUM('admin', 'manager', 'employee', 'sales_rep', 'human_resources', 'designer') NOT NULL DEFAULT 'employee';

-- 2. Update/Create Designer User (alex.designer@crm.com)
INSERT INTO `employees` (`employee_code`, `name`, `email`, `password`, `role`, `designation`, `department_id`, `phone`, `status`, `created_at`)
VALUES 
('DES-001', 'Alex Designer', 'alex.designer@crm.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'designer', 'Senior UI/UX Designer', 1, '9876543212', 'active', NOW())
ON DUPLICATE KEY UPDATE 
    `role` = 'designer',
    `password` = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    `designation` = 'Senior UI/UX Designer';

-- 3. Update/Create Sales User (sarah.sales@marcomstreet.com)
INSERT INTO `employees` (`employee_code`, `name`, `email`, `password`, `role`, `designation`, `department_id`, `phone`, `status`, `created_at`)
VALUES 
('SLS-001', 'Sarah Sales', 'sarah.sales@marcomstreet.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', 'Sales Executive', 1, '9876543211', 'active', NOW())
ON DUPLICATE KEY UPDATE 
    `role` = 'employee',
    `password` = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

-- 4. General Cleanup based on email patterns
UPDATE `employees` SET `role` = 'designer' WHERE `email` LIKE '%.designer%';
UPDATE `employees` SET `role` = 'employee' WHERE `email` LIKE '%sales%' AND `role` NOT IN ('admin', 'manager', 'human_resources');

SELECT "Migration Completed Successfully" as status;
