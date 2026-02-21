# Sales CRM - Employee Module

A complete, production-ready Employee Module for an Advanced Sales CRM System built with React + Vite (Frontend) and Core PHP (Backend).

## 🚀 Features

### ✅ Implemented Modules

1. **Authentication & Employee Login**
   - Secure login/logout
   - Role-based access control
   - Session & token handling

2. **Check-in Module**
   - Daily employee check-in
   - Date & time capture
   - Location tracking (optional)
   - Prevents multiple check-ins per day

3. **Smart Action Bar**
   - One-tap quick actions
   - Log client meetings
   - View today's tasks
   - Active deals overview

4. **Leads & Follow-ups**
   - View assigned leads
   - Update lead status
   - Call / WhatsApp integration (click-to-action)
   - Meeting logging

5. **Client Meeting Module**
   - Log meetings
   - Capture location
   - Add quick notes
   - Auto timestamp

6. **Performance Dashboard**
   - Leads count
   - Meetings done
   - Tasks completed
   - Deal progress
   - Charts & summary

7. **Tasks & Reminders**
   - Create and manage tasks
   - Auto task generation
   - Reminder system
   - Status updates

8. **AI Guidance (Logic-based)**
   - Lead score calculation
   - Best follow-up time suggestions
   - Best communication channel recommendations
   - Deal probability %

9. **Quotations & Invoices**
   - Create quotations (NO payment gateway)
   - Create invoices (NO checkout)
   - Item management
   - Tax & discount calculations

10. **History & Reports**
    - WhatsApp interaction logs
    - Activity logs
    - History data view

## 📋 Tech Stack

### Frontend
- React 18.2
- Vite 5.0
- Tailwind CSS 3.3
- Axios for API calls
- Recharts for data visualization
- React Router DOM for routing

### Backend
- Core PHP (No Framework)
- MySQL Database
- RESTful APIs
- PDO for secure database queries
- CORS enabled

## 🗄️ Database

MySQL database with the following tables:
- `employees` - Employee information
- `employee_checkins` - Daily check-ins
- `leads` - Lead management
- `meetings` - Client meetings
- `followups` - Follow-up tracking
- `tasks` - Task management
- `reminders` - Reminder system
- `quotations` - Quotation management
- `quotation_items` - Quotation line items
- `invoices` - Invoice management
- `invoice_items` - Invoice line items
- `whatsapp_logs` - WhatsApp interaction logs
- `activity_logs` - System activity logs

## 📦 Installation & Setup

### Prerequisites
- PHP 7.4+ (with PDO MySQL extension)
- MySQL 5.7+ or MariaDB 10.3+
- Node.js 16+ and npm
- XAMPP/WAMP/LAMP (or any PHP server)

### Step 1: Database Setup

1. Open phpMyAdmin or MySQL command line
2. Import the database schema:
   ```sql
   mysql -u root -p < database/schema.sql
   ```
   Or import `database/schema.sql` via phpMyAdmin

3. The database `sales_crm` will be created with all tables and demo data

### Step 2: Backend Configuration

1. Update database credentials in `backend/config/database.php`:
   ```php
   private $host = "localhost";
   private $db_name = "sales_crm";
   private $username = "root";
   private $password = "";
   ```

2. Ensure your PHP server (XAMPP/Apache) is running
3. Place the project in your web server directory:
   - XAMPP: `C:\XAMPP\htdocs\SALES-CRM`
   - WAMP: `C:\wamp64\www\SALES-CRM`
   - Linux: `/var/www/html/SALES-CRM`

### Step 3: Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Update API proxy in `frontend/vite.config.js` if needed:
   ```javascript
   proxy: {
     '/api': {
       target: 'http://localhost:80',  // Change port if different
       changeOrigin: true,
       rewrite: (path) => path.replace(/^\/api/, '/SALES-CRM/backend/api')
     }
   }
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. The frontend will be available at `http://localhost:5173`

### Step 4: Access the Application

1. Open your browser and navigate to `http://localhost:5173`
2. Login with demo credentials:
   - **Email:** `sarah.sales@crm.com`
   - **Password:** `password123`

   Or use:
   - **Email:** `mike.rep@crm.com`
   - **Password:** `password123`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Employee login
- `POST /api/auth/logout` - Employee logout

### Check-in
- `POST /api/checkin/checkin` - Employee check-in
- `GET /api/checkin/status` - Check check-in status

### Leads
- `GET /api/leads` - Get all leads (with filters)
- `PUT /api/leads/update_status` - Update lead status

### Meetings
- `GET /api/meetings` - Get meetings
- `POST /api/meetings/create` - Create meeting

### Tasks
- `GET /api/tasks` - Get tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/update_status` - Update task status

### Dashboard
- `GET /api/dashboard` - Get dashboard metrics

### Follow-ups
- `GET /api/followups` - Get follow-ups
- `POST /api/followups/create` - Create follow-up

### AI Guidance
- `GET /api/ai/guidance?lead_id={id}` - Get AI recommendations

### Quotations
- `GET /api/quotations` - Get quotations
- `POST /api/quotations` - Create quotation

### Invoices
- `GET /api/invoices` - Get invoices
- `POST /api/invoices` - Create invoice

### WhatsApp Logs
- `GET /api/whatsapp` - Get WhatsApp logs
- `POST /api/whatsapp` - Log WhatsApp message

## 🔐 Authentication

All API endpoints (except login) require authentication via Bearer token:
```
Authorization: Bearer {employee_id}
```

The token is automatically included in requests after login.

## 📊 Demo Data

The database includes:
- 3 employees (admin, manager, sales rep)
- 10 leads with various statuses
- 5 meetings
- 5 tasks
- Sample quotations and invoices
- WhatsApp logs
- Activity logs

## 🎨 Features Overview

### Dashboard
- Real-time performance metrics
- Charts and visualizations
- Recent activities
- Quick stats overview

### Leads Management
- View all assigned leads
- Filter by status and priority
- Update lead status
- Quick actions (Call, WhatsApp, Log Meeting)
- Lead score visualization

### Meetings
- Log client meetings
- View scheduled meetings
- Meeting details and outcomes
- Location tracking

### Tasks
- Create and manage tasks
- Set priorities and due dates
- Update task status
- Link tasks to leads

### Quotations & Invoices
- Create quotations with multiple items
- Tax and discount calculations
- Create invoices
- View quotation/invoice history

### AI Guidance
- Automatic lead scoring
- Best follow-up time suggestions
- Communication channel recommendations
- Deal probability calculations

## 🛠️ Development

### Project Structure
```
SALES-CRM/
├── backend/
│   ├── api/
│   │   ├── auth/
│   │   ├── checkin/
│   │   ├── leads/
│   │   ├── meetings/
│   │   ├── tasks/
│   │   ├── dashboard/
│   │   ├── followups/
│   │   ├── ai/
│   │   ├── quotations/
│   │   ├── invoices/
│   │   └── whatsapp/
│   └── config/
│       ├── database.php
│       ├── cors.php
│       └── auth.php
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── database/
│   └── schema.sql
└── README.md
```

## 🔧 Troubleshooting

### CORS Issues
- Ensure CORS headers are set in `backend/config/cors.php`
- Check Apache `.htaccess` configuration

### Database Connection Issues
- Verify database credentials in `backend/config/database.php`
- Ensure MySQL service is running
- Check database name matches: `sales_crm`

### API Not Found
- Verify Apache rewrite module is enabled
- Check `.htaccess` file exists in backend directory
- Ensure correct path in `vite.config.js` proxy settings

### Frontend Build Issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 16+)

## 📝 Notes

- **NO Payment Gateway**: Quotations and Invoices are for documentation only
- **NO Checkout**: No payment processing implemented
- **Production Ready**: Code follows best practices with proper error handling
- **Scalable**: Database structure supports large datasets
- **Secure**: Uses PDO prepared statements to prevent SQL injection

## 👥 Demo Users

1. **John Manager** (Manager)
   - Email: `john.manager@crm.com`
   - Password: `password123`

2. **Sarah Sales** (Sales Rep)
   - Email: `sarah.sales@crm.com`
   - Password: `password123`

3. **Mike Rep** (Employee)
   - Email: `mike.rep@crm.com`
   - Password: `password123`

## 📄 License

This project is built for enterprise CRM use.

## 🤝 Support

For issues or questions, check the API documentation or review the code comments.

---

**Built with ❤️ for Advanced Sales CRM System**

