-- Migration Script: Update Salary Slips Table
-- Run this script to update existing salary_slips table with new columns

USE marcom_street_crm;

-- Add new columns to salary_slips table
ALTER TABLE salary_slips
ADD COLUMN pay_period_start DATE NOT NULL DEFAULT '2026-01-01' AFTER employee_id,
ADD COLUMN pay_period_end DATE NOT NULL DEFAULT '2026-01-31' AFTER pay_period_start,
ADD COLUMN basic_salary DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER month,
ADD COLUMN hra DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER basic_salary,
ADD COLUMN conveyance_allowance DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER hra,
ADD COLUMN medical_allowance DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER conveyance_allowance,
ADD COLUMN special_allowance DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER medical_allowance,
ADD COLUMN other_allowances DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER special_allowance,
ADD COLUMN gross_salary DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER other_allowances,
ADD COLUMN pf_deduction DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER gross_salary,
ADD COLUMN esi_deduction DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER pf_deduction,
ADD COLUMN tax_deduction DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER esi_deduction,
ADD COLUMN professional_tax DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER tax_deduction,
ADD COLUMN other_deductions DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER professional_tax,
ADD COLUMN total_deductions DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER other_deductions,
ADD COLUMN net_salary DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER total_deductions,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Update existing records with calculated values based on amount field
UPDATE salary_slips 
SET 
    gross_salary = amount,
    net_salary = amount,
    basic_salary = amount * 0.60,  -- 60% of total as basic
    hra = amount * 0.24,            -- 24% as HRA
    conveyance_allowance = amount * 0.04,  -- 4% as conveyance
    medical_allowance = amount * 0.03,     -- 3% as medical
    special_allowance = amount * 0.07,     -- 7% as special
    other_allowances = amount * 0.02,      -- 2% as other
    pf_deduction = amount * 0.12 * 0.60,   -- 12% of basic as PF
    esi_deduction = amount * 0.0075,       -- 0.75% as ESI
    tax_deduction = amount * 0.05,         -- 5% as tax
    professional_tax = 200,                 -- Fixed professional tax
    total_deductions = (amount * 0.12 * 0.60) + (amount * 0.0075) + (amount * 0.05) + 200
WHERE basic_salary = 0;

-- Recalculate net salary
UPDATE salary_slips 
SET net_salary = gross_salary - total_deductions
WHERE net_salary = 0 OR net_salary = amount;

-- Update pay periods based on month
UPDATE salary_slips
SET 
    pay_period_start = STR_TO_DATE(CONCAT(month, '-01'), '%Y-%m-%d'),
    pay_period_end = LAST_DAY(STR_TO_DATE(CONCAT(month, '-01'), '%Y-%m-%d'))
WHERE pay_period_start = '2026-01-01';

SELECT 'Migration completed successfully!' as status;
SELECT * FROM salary_slips LIMIT 5;
