# MARCOM STREET CRM - Database Guide

This folder contains two different database paths:

- `COMPLETE_DATABASE_SETUP.sql` is a demo/staging import. It drops and recreates the target database, then inserts sample rows.
- Live production databases should be upgraded with the backend bootstrap scripts after you take a backup.

## Recommended Live Path

1. Take a full MySQL backup.
2. Import the base schema only if you are starting from an empty database.
3. From `backend-node`, run:

```bash
npm run db:bootstrap
```

4. Verify the connection and schema:

```bash
npm run db:test
npm run db:doctor
```

## What `db:bootstrap` Adds Or Fixes

- `companies.company_code`
- `employees.company_id`, `designation_id`, `joining_date`, and the bank/profile fields used by HR/Admin screens
- `departments.company_id`, `department_code`
- `designations` table and standard designations
- `leads.company_id`
- `meetings.company_id`
- `tasks.company_id`
- `quotations.company_id`
- `followups.followup_type`, `followups.completed_date`
- `company_settings.company_id` plus GST/PAN, invoice, bank, signature, and stamp fields
- `bank_accounts`, `api_keys`, `employee_module_access`
- password reset tables for email/SMS OTP flows
- HRMS tables used by the current code
- SaaS/control tables used by the super admin screens, including `modules`, `company_modules`, `subscriptions`, `audit_logs`, `login_sessions`, and `backups`

## Fresh Demo Or Staging Import

If you only need a local demo database, import `COMPLETE_DATABASE_SETUP.sql` into an empty MySQL database.

Warning: that file drops the target database and seeds demo users/data, so do not use it directly on production.

