# MARCOM STREET CRM - Database Setup

## 🚀 Quick Setup

**एक कमांड में सब कुछ Setup करने के लिए:**

```bash
cd database
php setup_database.php
```

ये command automatically:
- Database create करेगा
- सभी tables create करेगा
- Demo data insert करेगा
- सब कुछ ready करेगा

## 📁 Files

- `COMPLETE_DATABASE_SETUP.sql` - Complete database schema with all tables and demo data
- `setup_database.php` - PHP script to run the complete setup
- `README.md` - This file

## 👥 Demo Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@crm.com | password123 |
| Manager | john.manager@crm.com | password123 |
| Sales Rep | sarah.sales@crm.com | password123 |
| HR Manager | hr@crm.com | password123 |

## 📊 What Gets Created

### Core CRM Tables (11)
- companies, departments, employees
- leads, meetings, tasks, followups
- quotations, quotation_items
- invoices, invoice_items

### HRMS Tables (4)
- leaves, salary_slips, hr_documents

### Communication Tables (3)
- chat_messages, whatsapp_logs

### System Tables (4)
- activity_logs, api_audit_log, reports, reminders

### Demo Data
- 5 Employees (different roles)
- 10 Sample Leads
- 5 Meetings & Tasks
- Quotations & Invoices
- Chat messages & Activity logs

## 🔧 Manual Setup (Alternative)

अगर PHP script नहीं चलाना चाहते तो:

1. phpMyAdmin में जाएं
2. `COMPLETE_DATABASE_SETUP.sql` file को import करें
3. सब कुछ ready हो जाएगा

## 🌐 Usage

Setup के बाद:
1. XAMPP start करें
2. Browser में जाएं: `http://localhost/MARCOM-NEW-CRM`
3. ऊपर दिए गए credentials से login करें

## 📞 Support

कोई problem आए तो बताएं!
