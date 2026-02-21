-- Add generated_by to hr_documents (optional, for audit)
-- Run: cd database/migrations && mysql -u root -p marcom_street_crm < 006_add_hr_documents_generated_by.sql
-- Or from backend-node: npm run migrate
ALTER TABLE hr_documents
  ADD COLUMN generated_by INT NULL AFTER file_path;
