# MARCOM CRM - Sales & Employee Management System

A complete, production-ready Advanced CRM System built with **React + Vite (Frontend)** and **Node.js/Express (Backend)**.

> **Note:** This project runs strictly on **Node.js**. There is no PHP or Apache requirement.

## 🚀 Features
- **Authentication & Roles**: Secure login with roles (Super Admin, Admin, Manager, Employee, etc.).
- **HR & Employees**: Attendance, check-ins, salary slips, offer letters, and PDF downloads (fully supported by Node backend).
- **Leads & Meetings**: Assign leads, track status, auto-score, schedule and log meetings.
- **Tasks & Reminders**: Daily tasks, priority tracking, active deals.
- **Billing & Invoices**: Generate invoices, transaction history, SaaS plans.
- **SaaS Super Admin**: API keys, feature flags, global settings, audit logs, and more.

## 📋 Tech Stack
- **Frontend**: React 18, Vite 5, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: MySQL (`marcom_street_crm`)

---

## 🛠️ Quick Start & Setup

### 1. Database Setup
1. Create a MySQL database named `marcom_street_crm`.
2. Import your database SQL file into `marcom_street_crm` using phpMyAdmin or MySQL CLI.

### 2. Backend (Node.js) Setup
1. Navigate to the `backend-node` directory:
   ```bash
   cd backend-node
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables by copying `.env.example` to `.env` and setting your database credentials:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=marcom_street_crm
   PORT=3000
   ```

### 3. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the `.env` (or `.env.local`) to point to the backend:
   ```env
   VITE_API_PORT=3000
   ```

---

## 🏃 Running the Application

### Option A: Development Mode (Fast Reload)
Run both the frontend and backend in separate terminals:

**Terminal 1 (Backend):**
```bash
cd backend-node
npm start
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
Open your browser to: **http://localhost:5173** (API calls will be automatically proxied to Node on port 3000).

### Option B: Production Build (Single Server)
1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```
2. Start the backend server (which will also serve the frontend build):
   ```bash
   cd backend-node
   npm start
   ```
3. Open your browser to: **http://localhost:3000**

---

## 👥 Default Demo Credentials
- **Super Admin:** superadmin@crm.com / password123
- **Admin:** admin@crm.com / password123
- **Manager:** john.manager@crm.com / password123
- **Sales Rep:** sarah.sales@crm.com / password123

## 📝 Troubleshooting
- **PDF/Download issues?** Ensure the backend is fully running on Node.js.
- **Port already in use?** You can change the backend port in `backend-node/.env` and `frontend/.env.local`.
- **"Error in SQL syntax"?** Ensure you are passing correct parameter arrays to database query functions.

---
**Built with ❤️ for MARCOM CRM**
