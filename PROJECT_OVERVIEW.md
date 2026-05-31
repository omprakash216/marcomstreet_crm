# MARCOM Street CRM & HRMS - Detailed Module Guide

This document provides a granular breakdown of every module and feature included in the system. Use this to understand the full capabilities being handled by each section.

---

## 1. Super Admin Module (The SaaS Brain)
*Handles the global ecosystem, tenants, and monetization.*

- **Tenant Provisioning:** Instant creation of new company accounts with unique database isolation logic.
- **Subscription Engine:** 
  - Manage Plans (Starter, Pro, Enterprise).
  - Control pricing, user limits, and storage quotas.
  - Approve/Reject new registration requests.
- **Global Module Manager:** Turn features (like HRMS or AI) ON/OFF for specific companies globally.
- **System Maintenance:**
  - **Full System Backups:** One-click export of the entire database.
  - **Audit Logs:** Monitor every Super Admin action across the platform.
  - **Analytics:** View revenue charts, active user growth, and system usage heatmaps.

## 2. Manager Module (Team & Operations Oversight)
*Handles department-level management and team performance.*

- **Team Management:**
  - View real-time attendance status of all team members.
  - Track individual performance metrics and KPIs.
- **Approval Workflows:**
  - **Leave Approvals:** Review and approve/reject leave requests from reportees.
  - **Expense Verification:** Verify team expenses before final admin approval.
- **Task & Project Control:**
  - Assign tasks to team members with priority and deadlines.
  - Monitor task completion rates and bottlenecks.
- **Sales Oversight (CRM):**
  - View all leads and deals handled by the team.
  - Reassign leads between team members for better conversion.
- **Reporting:** Generate department-specific reports for sales, attendance, and activity.

## 3. Employee Module (Self-Service & Productivity)
*Handles individual tasks, attendance, and HR requests.*

- **Personal Dashboard:**
  - View personal sales stats, pending tasks, and attendance summary.
  - Stay updated with company announcements.
- **Attendance & HR:**
  - **Punch-In/Out:** Easy daily attendance with history tracking.
  - **Leave Portal:** Apply for leaves and track approval status.
  - **Payroll:** View and download monthly salary slips (PDF).
- **Sales Execution (CRM):**
  - Manage assigned leads (Update status, add notes, set follow-ups).
  - View client history and meeting schedules.
- **Task Management:**
  - View and update assigned tasks (Pending, In Progress, Completed).
- **Communication:**
  - Access internal chat for instant collaboration with colleagues.

## 4. CRM Module (Sales & Client Success)
*Handles the complete customer lifecycle from Lead to Payment.*

- **Lead Management:**
  - Lead capture with source tracking (Website, WhatsApp, Manual).
  - **AI Lead Scoring:** Automatically categorize leads into Hot, Warm, or Cold.
- **Sales Pipeline:**
  - Status tracking (New, Contacted, Proposal, Negotiation, Won/Lost).
  - Activity logs for every interaction.
- **Communication Tools:**
  - **WhatsApp API:** Send messages directly from lead profiles.
  - **Meetings & Follow-ups:** Automated reminders and calendar scheduling.
- **Financial Documents:**
  - **Quotations:** Professional PDF generation for price proposals.
  - **Invoices:** GST-ready PDF generation with Edit/Download/WhatsApp features.

## 5. HRMS Module (Employee & Operations)
*Handles everything from Attendance to Payroll.*

- **Attendance System:**
  - Daily Punch-In/Out with location/IP tracking.
  - **Auto-Punch-Out:** Midnight cleanup for employees who forget to clock out.
- **Payroll & Compensation:**
  - **Auto-Calculation:** Base salary, HRA, Allowances, PF, TDS, and Deductions.
  - **Salary Slips:** Professional PDF payslips generated monthly.
- **Employee Management:**
  - Document storage (Aadhar, PAN, Joining letters).
  - Designation and Department hierarchies.
  - Performance tracking and appraisals.
- **Operational Tools:**
  - **Leave Management:** Multi-level approval workflow for leaves.
  - **Holidays & Announcements:** Company-wide calendar and notice board.

## 6. Admin & Finance Module (Company Control)
*Handles company-specific configurations and backend operations.*

- **Inventory Management:** Track stock levels, warehouse items, and usage.
- **Accounts & Expenses:** 
  - Manage company ledgers and day-to-day spending.
  - Expense approval workflow.
- **RBAC (Role Based Access Control):** 
  - Define custom permissions for different employee roles.
- **Settings:** Customize company logo, watermarks, and system-wide configurations.

---

## 7. Security & Data Protection (Anti-Hack Measures)
*Technically engineered to prevent unauthorized access and data breaches.*

- **SQL Injection Prevention:** All database queries are sanitized using prepared statements and `mysqlFormat` to block malicious inputs.
- **Secure Authentication:**
  - **JWT (JSON Web Tokens):** Encrypted session management for all API requests.
  - **Bcrypt Hashing:** Passwords are never saved in plain text; they are hashed with a one-way salt.
- **Cross-Site Protection (CORS):** Only authorized domains can interact with the API.
- **Role-Based Access Control (RBAC):** Strict middleware checks ensure users cannot access data or features outside their designated role.
- **Audit Logging:** Every critical action is recorded with timestamp and IP address for forensic tracking.

---

## 8. AWS Infrastructure & Deployment Guide
*Recommended setup for a smooth Multi-Tenant SaaS experience.*

### Recommended Server (EC2 Instance)
- **Model:** **t3.large** (Best for 100+ simultaneous company users).
- **RAM:** **8 GB** (Required to handle Node.js backend + MySQL DB + PDF Generation).
- **CPU:** **2 vCPU** (Handles intensive AI and PDF tasks).

### Storage Strategy (EBS & S3)
- **Primary Disk:** **100 GB gp3 SSD** (General purpose storage for OS, Database, and Active Apps).
- **Disk Type gp3:** Selected for consistent high-IOPS (Input/Output operations) to ensure no lag in database queries.
- **S3 Bucket (Optional):** Highly recommended for long-term storage of invoices and employee documents to keep the main server light.

### Deployment Prerequisites:
1. **SSL Certificate (HTTPS):** Mandatory for secure data transmission between browser and AWS.
2. **PM2 (Process Manager):** Must be used to keep the Node.js application running 24/7. It handles auto-restarts in case of server reboots or crashes.
3. **Security Groups:** Configure AWS Firewall to only allow Port 80, 443, and 22 (SSH).

---
**Summary:** This project is engineered with high-security standards and optimized for AWS hosting, providing a professional, scalable, and safe environment for multiple companies.
