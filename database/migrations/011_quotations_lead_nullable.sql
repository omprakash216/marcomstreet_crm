-- Migration 011: allow quotations without a lead selection.
USE marcom_street_crm;

ALTER TABLE quotations
MODIFY COLUMN lead_id INT(11) NULL DEFAULT NULL;

SELECT 'Migration 011: quotations.lead_id is now nullable.' AS status;
