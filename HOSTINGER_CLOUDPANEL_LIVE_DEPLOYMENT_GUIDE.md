# MARCOM Street CRM + HRMS: Hostinger CloudPanel Live Deployment Guide

## 1. Is File Ka Purpose

Yeh guide is project ko production/live server par safely deploy karne ke liye hai.
Isme purchase decision, requirements, deployment steps, security, backup, testing,
update aur restore process sab ek jagah diya gaya hai.

Project ke current code ke hisaab se application:

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL, database name `marcom_street_crm`
- Persistent files: `uploads/` folder me HR documents, salary slips, chat files,
  task work files aur company logos
- Production serving: Node backend hi `frontend/dist` aur API dono serve karta hai

Related project workflow/features document:

- `COMPLETE_PROJECT_WORKFLOW.md`

## 2. Final Purchase Decision

### Kya Purchase/Select Karna Hai

| Item | Final Selection |
| --- | --- |
| Provider | Hostinger VPS |
| Starting VPS plan | `KVM 2` |
| Control panel | `CloudPanel` |
| OS/template | `Ubuntu 24.04 64-bit with CloudPanel`, agar selection me available ho |
| Backup add-on | `Daily Backups` enable karna hai |
| Domain | Ek domain ya subdomain, example `crm.yourdomain.com` |
| Server region | Jahan aapke maximum users hain, uske najdeek location |

### KVM 2 Kyon

Current Hostinger listing ke hisaab se KVM 2 me:

| Resource | Quantity |
| --- | --- |
| vCPU | 2 cores |
| RAM | 8 GB |
| Storage | 100 GB NVMe |
| Bandwidth | 8 TB |

Initial CRM/HRMS launch ke liye yeh reasonable starting plan hai. Is app me PDF
generation, file uploads, MySQL, reports aur multiple user portals hain, isliye
KVM 1 par production launch recommend nahi hai.

### Kab KVM 4 Lena Chahiye

Seedha `KVM 4` tab lein jab:

- ek saath bahut employees regularly attendance/CRM use karenge;
- HR documents, PDFs aur file uploads heavy honge;
- lead imports, reporting ya SaaS tenants jaldi add karne hain;
- launch ke din slow performance ka risk kam rakhna hai.

### CloudPanel Kyon, cPanel Kyon Nahi

| Need | CloudPanel | cPanel |
| --- | --- | --- |
| Is Node.js app ko deploy karna | Direct Node.js site support | Possible, lekin extra layers |
| Cost | Panel ke liye generally separate cPanel license nahi | Hostinger par separate cPanel license required |
| MySQL, domain, SSL | Available | Available |
| Traditional email/reseller hosting | Primary focus nahi | Zyada useful |
| Is project ke liye decision | Recommended | Abhi required nahi |

Yeh project custom Node.js application hai, shared hosting/email reseller setup
nahi. Isliye `CloudPanel` simple aur cost-effective choice hai.

## 3. Architecture: Live Server Par Request Kaise Chalegi

Production me frontend aur backend alag servers par deploy nahi karne hain.
Current code ka intended production flow yeh hai:

```text
User browser
  -> HTTPS domain: crm.yourdomain.com
  -> CloudPanel / NGINX SSL and reverse proxy
  -> Node.js process on port 3000 (PM2 managed)
  -> Express server.js
       -> frontend/dist static React application
       -> /api/* backend routes
       -> /serve-pdf PDF response
       -> /uploads/* file response
       -> MySQL database
```

Important code facts:

| Item | Current Project Value |
| --- | --- |
| Backend entry file | `backend-node/server.js` |
| Backend default port | `3000` |
| Health endpoint | `/api/check` |
| Frontend build output | `frontend/dist` |
| PM2 file already present | `ecosystem.config.js` |
| Backend env file | `backend-node/.env` |
| Database connection | `backend-node/config/database.js` |
| Upload root | `uploads/` |

## 4. Live Karne Se Pehle Required Items

### 4.1 Accounts Aur Services

| Requirement | Mandatory? | Use |
| --- | --- | --- |
| Hostinger account and VPS | Yes | Server run karne ke liye |
| Domain name | Yes for live | Users ko secure URL dene ke liye |
| DNS access | Yes | Domain ko VPS IP par point karne ke liye |
| CloudPanel admin access | Yes | Site, DB, SSL aur backup settings |
| Git private repository access ya ZIP package | Yes | Code upload karne ke liye |
| SMTP email service | Email reset use karna hai to Yes | Forgot password email OTP |
| MSG91/2Factor SMS account | SMS OTP use karna hai to Yes | Forgot password mobile OTP |
| Off-site backup storage | Strongly required | Disaster recovery; example Wasabi/S3/SFTP |

### 4.2 Server Software

CloudPanel template ke baad in values ko use karna hai:

| Software | Required Choice |
| --- | --- |
| Operating System | Ubuntu 24.04 LTS |
| Panel | CloudPanel |
| Web proxy / SSL | NGINX and Let's Encrypt through CloudPanel |
| Node.js | Node.js 22 LTS |
| Process manager | PM2 |
| Database | MySQL 8 compatible database from CloudPanel |
| Git | Code deployment/update ke liye |

Why Node.js 22 LTS: backend `node >=18` allow karta hai, lekin frontend me
modern Vite build dependency hai. Node.js 22 LTS dono layers ke liye safe common
choice rakhta hai.

### 4.3 Data/Configuration Jo Pehle Ready Rakhna Hai

Purchase ke baad deployment ke waqt in values ki zarurat hogi. Inhe password
manager me rakhein, WhatsApp/chat message me nahi.

| Name | Example/Meaning |
| --- | --- |
| Live domain | `crm.yourdomain.com` |
| VPS public IP | Hostinger se milega |
| CloudPanel admin password | Unique strong password |
| SSH key | Recommended; laptop se server access |
| Database name | `marcom_street_crm` |
| Database user | Example `marcom_app` |
| Database password | Random strong password |
| JWT secret | Minimum 64 random characters |
| Super Admin email | Aapka controlled email |
| Super Admin password | Random strong password |
| SMTP credentials | Brevo/Gmail/custom SMTP |
| SMS API credentials | Optional MSG91/2Factor |
| Backup destination credentials | S3/Wasabi/SFTP credentials |

## 5. Production Readiness Gate: Live Data Se Pehle Fix/Verify Karna Zaroori Hai

Deployment technically possible hai, lekin actual employee/client data upload
karne se pehle neeche ke points close karne honge. Yeh optional cosmetic points
nahi hain.

### 5.1 Database Schema Abhi Direct Production Import Ke Liye Ready Nahi Mana Jayega

Current file `database/COMPLETE_DATABASE_SETUP.sql`:

- existing database ko `DROP DATABASE IF EXISTS` se delete karta hai;
- demo employees aur predictable demo passwords insert karta hai;
- base `employees.role` enum me `superadmin` nahi hai;
- current Super Admin/multi-company migration `employees.company_id` aur
  `superadmin` role expect karta hai.

Isliye production database par current complete setup SQL ko blindly import
nahi karna hai. Production ke liye ek safe schema/migration script tayyar aur
staging database par tested hona required hai, jisme:

- koi `DROP DATABASE` na ho;
- demo user/demo business data na ho;
- current tables aur migrations aligned hon;
- Super Admin role aur company mapping verified ho;
- import ke baad login, CRM, HRMS, billing aur backup screens test ho jayen.

### 5.2 Payment Confirmation Abhi Real Gateway Nahi Hai

Current billing flow mock payment reference create karta hai. Real customers ko
subscription sell/charge karne se pehle real payment gateway integration aur
payment webhook verification required hai.

### 5.3 HR Documents/Salary Files Ke Access Ko Harden Karna Hai

Backend currently `uploads/` folder static serve karta hai aur PDF serving route
present hai. Salary slips, offer letters ya HR documents real user data hain.
Production HR data rakhne se pehle file authorization/privacy testing aur,
zarurat padne par, access-control code change required hai.

### 5.4 Functional Checks Pending

Current project workflow review me kuch flows verification/fix demand karte hain:

- Company portal routing/login wiring
- Public joining form route wiring
- Designer/dashboard queries ka runtime database validation
- Role-wise API authorization testing

### Go-Live Rule

Pehle server setup + staging deployment karein. Real employee/client data tabhi
add karein jab upar ke production readiness issues test karke close ho jayen.

## 6. Purchase Aur Initial VPS Setup: Click-By-Click

### Step 1: Hostinger VPS Plan Select Karein

1. Hostinger VPS purchase page par `KVM 2` select karein.
2. Subscription duration aur final renewal price checkout par dhyan se padhein.
3. Server location apne primary users ke najdeek choose karein.
4. Checkout complete karein.

### Step 2: Template Select Karein

VPS setup ke `Choose what to install` screen par:

1. `Control panel` tab select karein.
2. `CloudPanel` card select karein.
3. Agar OS/version ka option aaye to `Ubuntu 24.04 64-bit with CloudPanel`
   choose karein.
4. `cPanel`, `Plesk`, `MERN Stack`, `Docker application` aur `Plain OS` select
   nahi karna hai is first production setup ke liye.

### Step 3: Password Aur SSH Access

1. Root password ek unique random value rakhein.
2. CloudPanel admin password alag unique random value rakhein.
3. Agar Hostinger SSH public key add karne ka option de to SSH key add karein.
4. Server IP, root access details aur CloudPanel URL securely note karein.

### Step 4: Daily Backup Purchase/Enable Karein

Hostinger hPanel me:

1. `VPS` section open karein.
2. Apna server select karein.
3. `Backups & Monitoring` -> `Snapshots & Backups` open karein.
4. `Daily Backups` ko upgrade/enable karein.

Free weekly backup helpful hai, lekin business CRM database ke liye daily
backup add-on required maana gaya hai.

## 7. CloudPanel Aur Domain Setup

### Step 5: CloudPanel Login

Browser me open karein:

```text
https://YOUR_VPS_IP:8443
```

CloudPanel admin credentials se login karein.

Initial security actions:

1. CloudPanel admin password verify/change karein agar temporary credential mila ho.
2. Correct server timezone set karein. Attendance application ke liye timezone
   business timezone se match hona chahiye, example `Asia/Kolkata`.
3. Unknown admin users/SSH keys na chhodein.
4. Panel port `8443` ko public sharing me na bhejein.

### Step 6: Domain DNS VPS IP Par Point Karein

Domain provider ke DNS panel me record add karein:

| Type | Name | Value |
| --- | --- | --- |
| A | `crm` | `YOUR_VPS_IP` |

Isse URL hoga:

```text
crm.yourdomain.com
```

Agar root domain par application chalani hai, to `@` aur optionally `www`
records configure karein. CRM ke liye dedicated subdomain `crm` cleaner option
hai.

DNS propagate hone me kuch samay lag sakta hai.

### Step 7: CloudPanel Me Node.js Site Create Karein

CloudPanel me:

1. `Sites` -> `Add Site` open karein.
2. `Create a Node.js Site` select karein.
3. Domain me `crm.yourdomain.com` fill karein.
4. Node.js version me `Node.js 22 LTS` select karein.
5. App port me `3000` fill karein.
6. Site create karein.
7. CloudPanel ne jo `site user` banaya hai uska name note karein.

Site home usually is pattern me hoga:

```bash
/home/SITE_USER/htdocs/crm.yourdomain.com/
```

Actual path CloudPanel site page se confirm karein.

### Step 8: SSL Install Karein

DNS domain ko server IP par resolve karne lage tab:

1. CloudPanel -> Site -> SSL/TLS ya Certificates section open karein.
2. Let's Encrypt certificate issue/install karein.
3. Browser me `https://crm.yourdomain.com` open karke SSL lock verify karein.

Application live karne se pehle HTTPS mandatory hai, kyunki login tokens aur HR
data use honge.

## 8. Code Server Par Deploy Karna

### Step 9: Site User Se SSH Login

Apne computer se:

```bash
ssh SITE_USER@YOUR_VPS_IP
cd ~/htdocs/crm.yourdomain.com
```

`SITE_USER`, IP aur domain apne values se replace karein.

### Step 10: Code Upload Karein

Preferred method: private Git repository.

Fresh empty application directory me:

```bash
cd ~/htdocs/crm.yourdomain.com
git clone YOUR_PRIVATE_REPO_URL .
```

Rules:

- Repository private rakhein.
- `backend-node/.env` Git me commit nahi karna hai.
- Existing live `uploads/` ko Git update ke time overwrite/delete nahi karna hai.
- Production source ke saath demo credentials publicly publish nahi karne hain.

ZIP upload bhi possible hai, lekin reliable updates/rollback ke liye private Git
recommended hai.

### Step 11: Node Dependencies Install Karein

Project root par:

```bash
cd ~/htdocs/crm.yourdomain.com
npm --prefix backend-node ci --omit=dev
npm --prefix frontend ci
```

Notes:

- Backend production runtime dependencies only install karta hai.
- Frontend dependencies build banane ke liye server par temporarily required hain.
- Agar clean lockfile/install error aaye to deployment rok kar dependency issue
  solve karein; `--force` blindly use na karein.

### Step 12: Frontend Production Build Banayein

```bash
npm --prefix frontend run build
test -f frontend/dist/index.html && echo "Frontend build OK"
```

Production me frontend ke liye `VITE_API_PORT` set karne ki zarurat nahi hai,
kyunki frontend `/api` relative URL use karta hai aur Node server same domain
se API serve karta hai.

## 9. Database Setup

### Step 13: CloudPanel Me Database Aur User Create Karein

CloudPanel -> `Databases` section me:

1. Database create karein: `marcom_street_crm`
2. Database user create karein: example `marcom_app`
3. Strong generated password use karein.
4. Is password ko password manager me save karein.
5. Application ke liye `root` MySQL user use nahi karna hai.

Expected app connection:

```text
Host: 127.0.0.1
Port: 3306
Database: marcom_street_crm
User: marcom_app
```

### Step 14: Schema Deployment - Staging First

**Important:** Current repository ka `database/COMPLETE_DATABASE_SETUP.sql`
direct production import ke liye approved nahi hai, because it drops the
database and loads demo data. Is step par:

1. Pehle staging/test database banaya jayega.
2. Current schema aur required migrations staging par run/test ki jayengi.
3. Project ke current code ke liye ek non-destructive production schema file
   finalize ki jayegi.
4. Sirf tested production schema ko empty live database me import kiya jayega.

Expected production schema file ka naam, jab prepare ho:

```text
database/PRODUCTION_SCHEMA.sql
```

Us file ke tested hone ke baad import command:

```bash
mysql -h 127.0.0.1 -u marcom_app -p marcom_street_crm < database/PRODUCTION_SCHEMA.sql
```

Current functionality me schema ko at least in areas ke liye cover karna hoga:

| Area | Required Data |
| --- | --- |
| Authentication | employees, token/version and OTP fields |
| CRM | leads, meetings, tasks, followups, quotations, invoices |
| HRMS | attendance, leaves, salary slips, documents, shifts, holidays |
| Admin/RBAC | roles, permissions, company settings |
| Super Admin/SaaS | plans, subscriptions, modules, flags, settings, sessions |
| Integrations | API keys, webhooks, audit/API logs |
| Backup UI | backup log records |

### Step 15: Database Connectivity Test

Schema import aur `.env` setup ke baad:

```bash
npm --prefix backend-node run db:test
npm --prefix backend-node run db:doctor
```

Jab tak DB check successfully pass nahi hota, application ko real users ke
liye open nahi karna hai.

## 10. Production Environment Variables

### Step 16: Backend Environment File Banayein

Project root se:

```bash
cd ~/htdocs/crm.yourdomain.com
cp backend-node/.env.example backend-node/.env
nano backend-node/.env
```

Production template:

```env
NODE_ENV=production
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=marcom_app
DB_PASSWORD=PASTE_STRONG_DATABASE_PASSWORD_HERE
DB_NAME=marcom_street_crm

JWT_SECRET=PASTE_A_LONG_RANDOM_SECRET_HERE
APP_NAME=MARCOM STREET CRM
BASE_URL=https://crm.yourdomain.com

SUPERADMIN_EMAIL=owner@yourdomain.com
SUPERADMIN_PASSWORD=PASTE_STRONG_FIRST_TIME_ADMIN_PASSWORD_HERE

# Email OTP: choose configured SMTP provider
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
MAIL_FROM="MARCOM STREET CRM <no-reply@yourdomain.com>"
PASSWORD_RESET_MAX_OTP_ATTEMPTS=5
DISABLE_EMAIL_SENDING=false

# SMS OTP: optional until SMS provider is purchased/configured
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=
MSG91_SENDER_ID=VG
MSG91_ROUTE=4
OTP_PREFIX=VG
DEFAULT_PHONE_COUNTRY_CODE=91
```

Generate strong JWT secret:

```bash
openssl rand -hex 64
```

Protect environment file:

```bash
chmod 600 backend-node/.env
```

Security rules:

- Default `JWT_SECRET=marcom_crm_secret_key_2024` production me kabhi use na karein.
- Demo password `password123` production me kabhi use na karein.
- `.env` file GitHub ya screenshots me upload/share na karein.
- `ALLOW_OTP_DEBUG` production me enable na karein.

### Step 17: Email Aur SMS Configuration

Email password reset use karna hai to SMTP mandatory hai. Recommended workflow:

1. Brevo/custom SMTP account create karein.
2. SMTP values `.env` me set karein.
3. App live hone ke baad forgot-password email OTP test karein.

SMS OTP use karna hai to:

1. MSG91 ya 2Factor account aur template/sender approval complete karein.
2. API key `.env` me set karein ya Super Admin settings se securely configure karein.
3. Production test mobile par OTP test karein.

SMS provider abhi nahi liya hai to SMS forgot-password feature users ko promise
na karein; email OTP configure karke launch karna easier rahega.

## 11. Upload Directories Aur File Permissions

### Step 18: Persistent Upload Folders Create Karein

Backend in directories me files rakh sakta hai:

```bash
cd ~/htdocs/crm.yourdomain.com
mkdir -p uploads/hr_documents uploads/hr_docs uploads/salary_slips
mkdir -p uploads/task_work uploads/chat/messages uploads/company_logos
chmod -R u+rwX,go-rwx uploads
```

Important:

- `uploads/` Git ignored/runtime data hai.
- App update ke time uploads folder delete nahi karna hai.
- Database backup ke saath `uploads/` backup bhi required hai; sirf SQL dump se
  PDF/documents restore nahi honge.

## 12. Application Ko PM2 Se Start Karna

### Step 19: PM2 Install Aur Start

Site user se:

```bash
npm install -g pm2
cd ~/htdocs/crm.yourdomain.com
pm2 start ecosystem.config.js
pm2 status
pm2 logs marcom-backend --lines 50
```

Repository me existing `ecosystem.config.js`:

- process name `marcom-backend` use karta hai;
- `backend-node/server.js` run karta hai;
- port `3000` set karta hai;
- crash par automatic restart karta hai;
- `1G` memory threshold par restart configure karta hai.

### Step 20: Reboot Ke Baad Auto Start Enable Karein

```bash
pm2 save
pm2 startup
```

`pm2 startup` ek command output karega jise elevated/root permission se ek baar
run karna hoga. CloudPanel/server instructions ke hisaab se woh generated
command execute karein, phir:

```bash
pm2 save
```

### Step 21: Local Health Check

Server SSH terminal me:

```bash
curl http://127.0.0.1:3000/api/check
```

Expected response me:

```json
{"success":true,"message":"Node backend is running"}
```

## 13. CloudPanel Reverse Proxy Aur Public Test

Node.js site create karte waqt app port `3000` diya gaya hai, isliye CloudPanel
domain HTTPS traffic ko backend process tak forward karega.

### Step 22: Browser Checks

Browser me:

```text
https://crm.yourdomain.com
https://crm.yourdomain.com/api/check
```

Check list:

| Check | Expected |
| --- | --- |
| Main URL opens | React landing/login UI dikhe |
| `/api/check` | JSON success response |
| HTTPS | Browser SSL lock, no warning |
| Login | Production admin credential se login |
| Page refresh | React route par 404 na aaye |
| API | Dashboard data without network error |

## 14. Mandatory Functional Testing Before Real Users

### Step 23: Role-Based Smoke Testing

Test data se har role ka basic test karein:

| Role | Must Test |
| --- | --- |
| Super Admin | Login, companies, modules, settings, backup screen |
| Admin | Dashboard, employee creation, role permissions, reports |
| Manager | Lead/task assignment and meeting handling |
| HR | Attendance, leave approval, salary slip, HR document |
| Employee | Attendance punch in/out, own task, leave, salary view |

### Step 24: Module Testing

| Module | Test |
| --- | --- |
| CRM | Lead create/edit/status, meeting, follow-up, quotation, invoice |
| Tasks | Assignment and work-file upload |
| HRMS | Attendance, leave, documents, salary PDF |
| Chat | Text and attachment upload |
| Branding | Company logo upload |
| Reports | CSV/PDF/download response |
| Password reset | Email OTP, and SMS only if configured |

### Step 25: Security/Privacy Testing

Before storing real HR documents:

1. Logout user ke browser se document URLs access karke test karein.
2. Dusre employee ka salary/HR file access possible to nahi, test karein.
3. Unauthorized API requests `401/403` return kar rahi hain, verify karein.
4. Any exposed document access ko fix kiye bina real HR files upload na karein.

## 15. Backup Plan: Proper Recovery Ke Liye

Is project me backup ka matlab sirf application UI ka export nahi hai. Full
recovery ke liye teen cheezein backup honi chahiye:

| Data | Kyon Zaroori |
| --- | --- |
| MySQL database | Users, leads, attendance, salary records, settings |
| `uploads/` directory | HR PDFs, salary slips, attachments, logos |
| Application config/secrets record | Server recreate karne ke liye `.env` values securely stored |

### 15.1 Hostinger Backups

Required setup:

1. Hostinger `Daily Backups` enable rakhein.
2. Har major deployment/database migration se pehle manual `Snapshot` create karein.
3. Snapshot ko permanent backup na samjhein; Hostinger snapshot retention limited hai.

Hostinger documentation ke mutabik VPS daily backup add-on recent daily aur
weekly copies retain karta hai; full long-term recovery ke liye off-site copy
alag se rakhni hai.

### 15.2 CloudPanel Off-Site Backup

CloudPanel -> Admin Area -> Backups me remote backup configure karein.

Recommended destination:

| Option | Recommendation |
| --- | --- |
| Wasabi S3 | Simple low-cost off-site storage option |
| Amazon S3 | Strong standard option |
| SFTP storage | Agar already separate backup server hai |

CloudPanel remote backups S3, Wasabi, DigitalOcean Spaces, Dropbox, Google
Drive/SFTP aur compatible Rclone storage support karte hain.

Recommended policy:

| Backup | Frequency | Retention |
| --- | --- | --- |
| Database dump | Daily | Minimum 30 days off-site |
| Upload files | Daily | Minimum 30 days off-site |
| Full pre-release snapshot | Har release se pehle | Release successfully verify hone tak |
| Monthly archive | Monthly | Minimum 6-12 months business need ke hisaab se |

### 15.3 MySQL Manual Backup Command

Emergency/manual DB export:

```bash
mkdir -p ~/backups
mysqldump -h 127.0.0.1 -u marcom_app -p --single-transaction \
  marcom_street_crm | gzip > ~/backups/marcom_street_crm_$(date +%F).sql.gz
```

Is generated file ko same VPS par sirf chhodna sufficient nahi hai. Use configured
off-site storage me transfer/backup hona chahiye.

### 15.4 Uploads Manual Backup Command

```bash
tar -czf ~/backups/marcom_uploads_$(date +%F).tar.gz \
  -C ~/htdocs/crm.yourdomain.com uploads
```

Is file ko bhi off-site destination par copy karna hai.

### 15.5 In-App Super Admin Backup Ka Limitation

Project me Super Admin backup/export screen database records ka JSON export/log
banata hai. Yeh useful application export hai, lekin:

- complete MySQL disaster recovery replacement nahi;
- `uploads/` actual files ka replacement nahi;
- VPS restore ka replacement nahi.

Production backup policy me Hostinger backup + off-site SQL/files backup mandatory
hai.

## 16. Normal Update/Release Process

Application live ho jane ke baad har code update ke liye:

### Step 26: Update Se Pehle

1. Users ko maintenance time batayein agar database changes hain.
2. Hostinger manual snapshot create karein.
3. Latest MySQL dump aur uploads backup off-site confirm karein.

### Step 27: Code Update

```bash
ssh SITE_USER@YOUR_VPS_IP
cd ~/htdocs/crm.yourdomain.com
git status
git pull origin main
npm --prefix backend-node ci --omit=dev
npm --prefix frontend ci
npm --prefix frontend run build
pm2 restart marcom-backend --update-env
pm2 logs marcom-backend --lines 50
curl http://127.0.0.1:3000/api/check
```

Database migration tabhi run karein jab release ke saath reviewed migration file
ho aur pre-migration backup available ho.

### Step 28: Post-Update Test

Minimum checks:

- login
- dashboard
- lead list/create
- attendance action
- HR document/salary access if affected
- `/api/check`
- PM2 status

## 17. Restore Aur Emergency Process

### App Down Hai Lekin Server Chal Raha Hai

```bash
pm2 status
pm2 logs marcom-backend --lines 100
pm2 restart marcom-backend
curl http://127.0.0.1:3000/api/check
```

### Latest Deployment Me Problem Hai

1. Users ko system temporarily unavailable batayein.
2. Database migration hua ho to restore decision carefully lein.
3. Previous known-good Git release checkout karein.
4. Frontend rebuild aur PM2 restart karein.
5. Data corrupt hua ho to verified DB/files backup restore karein.

### Server/Data Loss Hai

Recovery sequence:

1. Hostinger VPS backup/snapshot restore karein, ya fresh CloudPanel VPS create karein.
2. Same domain/SSL/reverse proxy setup restore karein.
3. Application code deploy karein.
4. Secure `.env` recreate karein.
5. MySQL backup import karein.
6. `uploads/` archive restore karein.
7. PM2 start aur tests complete karein.

### Restore Drill

Backup tabhi trustworthy maana jayega jab ek test restore staging environment
par successfully run kiya gaya ho. Launch ke baad monthly restore drill schedule
karna recommended hai.

## 18. Troubleshooting Quick Table

| Problem | Pehla Check | Common Fix |
| --- | --- | --- |
| Domain open nahi ho raha | DNS A record and propagation | Domain ko correct VPS IP par point karein |
| SSL issue | Domain DNS resolve ho raha hai? | DNS complete hone ke baad Let's Encrypt retry |
| 502 Bad Gateway | `pm2 status`, port 3000 | Backend start/restart, CloudPanel app port verify |
| UI me blank/error | `frontend/dist/index.html` | `npm --prefix frontend run build` |
| API failure | `/api/check`, PM2 logs | DB/env/router error resolve |
| Database denied | `.env` DB credentials | CloudPanel DB user/password reset and update |
| Login invalid | Production users/schema | Seed/demo use na karein; approved admin create karein |
| PDF/upload failure | `uploads/` permissions and directory | Required directories create, ownership verify |
| Email OTP not sent | SMTP credentials | SMTP provider/test and env values verify |
| SMS OTP not sent | MSG91/2Factor setup | API key, sender/template approval, balance verify |

## 19. Go-Live Checklist

### Purchase/Server

- [ ] Hostinger VPS `KVM 2` or higher purchased
- [ ] `CloudPanel` selected
- [ ] `Ubuntu 24.04 64-bit with CloudPanel` selected where available
- [ ] Hostinger Daily Backups enabled
- [ ] Server location and renewal cost recorded

### Security

- [ ] Unique root and CloudPanel passwords stored securely
- [ ] SSH key configured
- [ ] HTTPS certificate active
- [ ] `JWT_SECRET` replaced with random secret
- [ ] Demo/default passwords removed
- [ ] `.env` permissions secured and not committed
- [ ] HR/PDF file access authorization tested/fixed

### Application

- [ ] Node.js 22 LTS site on app port 3000 created
- [ ] Code deployed through private repository/package
- [ ] Backend dependencies installed
- [ ] Frontend built to `frontend/dist`
- [ ] Required upload folders created
- [ ] PM2 process active and reboot startup saved
- [ ] `/api/check` success through HTTPS domain

### Database

- [ ] Production-safe non-destructive schema finalized
- [ ] Schema tested in staging before live database
- [ ] Dedicated non-root DB user configured
- [ ] Database connectivity tests pass
- [ ] Super Admin and role access tests pass

### Functional

- [ ] Login/password reset test pass
- [ ] CRM lead/task/meeting flow test pass
- [ ] HR attendance/leave/document/salary flow test pass
- [ ] Reports/invoice/PDF test pass
- [ ] Company portal/joining form advertised only after flow verification
- [ ] Real payment not offered until gateway is integrated

### Backup

- [ ] Hostinger daily backups verified
- [ ] Pre-launch snapshot created
- [ ] CloudPanel remote/off-site backup configured
- [ ] MySQL daily backup scheduled and checked
- [ ] `uploads/` backup scheduled and checked
- [ ] Test restore completed before relying on backups

## 20. Official Provider References

These links should be rechecked on purchase day because provider plans, prices
and available templates can change:

- Hostinger VPS templates and control panels:
  https://www.hostinger.com/support/1583571-what-are-the-available-operating-systems-for-vps-at-hostinger/
- Hostinger CloudPanel template setup:
  https://support.hostinger.com/en/articles/8794480-how-to-use-the-cloudpanel-vps-template
- Hostinger Node.js deployment with CloudPanel:
  https://www.hostinger.com/support/9553137-how-to-set-up-a-node-js-application-using-hostinger-cloudpanel
- Hostinger VPS plans:
  https://www.hostinger.com/vps-hosting
- Hostinger daily backup activation:
  https://www.hostinger.com/support/1665153-how-to-activate-daily-backups-in-hostinger/
- CloudPanel remote backup documentation:
  https://www.cloudpanel.io/docs/v2/admin-area/backups/
- CloudPanel technology stack:
  https://www.cloudpanel.io/docs/v2/technology-stack/

## 21. Final Short Decision

Purchase aur selection screen par final choice:

```text
Hostinger VPS: KVM 2
Control panel: CloudPanel
Template: Ubuntu 24.04 64-bit with CloudPanel
Backup: Daily Backups enabled + off-site remote backup
Runtime: Node.js 22 LTS, MySQL, PM2, HTTPS domain
```

Server milne ke baad first action code ko live customer data ke saath open karna
nahi hoga. Pehle production schema alignment, document privacy, SSL, backups aur
role-based testing complete honge; uske baad hi proper live launch hoga.
