# MARCOM STREET CRM – Node.js Backend (Complete)

**Ab pura backend Node.js mein hai.** PHP backend ki jagah yehi use karein. Same database `marcom_street_crm` use hota hai.

## Setup

1. **Dependencies**
   ```bash
   cd backend-node
   npm install
   ```

2. **Database** – MySQL chala hona chahiye, same DB: `marcom_street_crm`.  
   Optional: `.env` banao (`.env.example` copy karke) aur `DB_*` set karein.

   Quick check:
   ```bash
   npm run db:doctor
   ```

3. **Start**
   ```bash
   npm start
   ```
   - Backend pehle **port 3000** par start hota hai.
   - Agar 3000 pehle se use ho raha ho to **3001, 3002, ...** try karta hai; jis port par start ho, woh console par dikhega.
   - **Port fix karna ho** to `backend-node/.env` mein `PORT=3000` (ya koi free port) set karein.

4. **Agar backend 3001 (ya koi aur port) par chale**  
   Frontend se connect karne ke liye `frontend/.env` mein ye add karein:
   ```
   VITE_API_PORT=3001
   ```
   (3001 ki jagah woh port likhein jis par backend chal raha hai.)

## Frontend

- **Node backend ab default hai.** Kuch extra env nahi chahiye.
- Frontend dev: `cd frontend && npm run dev`  
  Vite `/api` aur `/serve-pdf` ko Node (3000) par proxy karega.
- **PHP use karna ho** to frontend `.env` mein `VITE_USE_PHP_BACKEND=true` set karein.

## API Routes (sab Node par, bina .php)

- **Auth:** `POST /api/auth/login`, `POST /api/auth/logout`, forgot password: `POST /api/auth/forgot-password/request-otp`, `POST /api/auth/forgot-password/verify-otp`, `POST /api/auth/forgot-password/reset` (SMS via Twilio when `TWILIO_*` env vars are set; otherwise OTP is logged on the server—see `.env.example`)
- **Checkin:** `GET /api/checkin/status`, `POST /api/checkin/checkin`
- **Activities:** `GET /api/activities`, `POST /api/activities/create`
- **Companies:** `GET/POST/PUT /api/companies`, `GET /api/companies/history`, `GET /api/companies/:id`, `GET /api/companies/:id/leads`, etc.
- **Manager:** `GET/POST /api/manager/targets`
- **Leads:** `GET/POST/PUT/DELETE /api/leads`, `POST /api/leads/crud`, `PUT /api/leads/update_status`, `GET /api/leads/export`
- **Tasks:** `GET/POST/PUT /api/tasks`, `PUT/POST /api/tasks/update_status`
- **Meetings:** `GET/POST /api/meetings`, `GET /api/meetings/summary`, `POST /api/meetings/create`, `POST /api/meetings/update_outcome`
- **Followups:** `GET/POST /api/followups`, `POST /api/followups/create`, `PUT /api/followups/update_status`
- **Chat:** `GET/POST /api/chat?action=users|unread_count|notifications|user_id=...`
- **Dashboard:** `GET /api/dashboard`
- **HRMS:** `GET/POST /api/hrms/documents`, `POST /api/hrms/generate_document`, `GET/POST /api/hrms/salary`, `GET/POST/PUT /api/hrms/leaves`, `GET/POST /api/hrms/attendance`, `GET /api/hrms/stats`, `GET /api/hrms/joining_submissions`, `POST /api/hrms/verify_joining`, `POST /api/hrms/generate_qr`
- **Reports:** `GET/POST /api/reports`, `GET /api/reports/sample`, `POST /api/reports/create`, `GET /api/reports/download`
- **Quotations / Invoices:** `GET/POST/DELETE /api/quotations`, `GET/POST /api/invoices`
- **Admin:** `GET /api/admin/dashboard`, `GET /api/admin/attendance`, `GET /api/admin/insights`, `GET /api/admin/revenue`, `GET/POST/PUT/DELETE /api/admin/tasks`, `GET/POST/PUT/DELETE /api/admin/employees`, `GET/POST/PUT /api/admin/api-keys`, `GET /api/admin/audit-logs`, `GET/PUT/POST/DELETE /api/admin/companies`, `GET /api/admin/ai-lead-score`, `POST /api/admin/generate_offer_letter`
- **Departments:** `GET/POST /api/departments`
- **Employees (list):** `GET /api/employees`
- **HR Documents (other page):** `GET/POST /api/hr-documents`, `GET /api/hr-documents/:id/download`, `DELETE /api/hr-documents/:id`
- **Group Meetings:** `GET/POST/PUT/DELETE /api/group-meetings`
- **WhatsApp / AI / Designer:** `GET /api/whatsapp`, `GET /api/ai/guidance`, `GET /api/designer/dashboard`
- **PDF:** `GET /serve-pdf?file=uploads/hr_documents/...` ya `uploads/salary_slips/...` (correct MIME, no PHP error)
