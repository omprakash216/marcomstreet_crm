# MARCOM CRM – Sirf Node se chalao

**Apache / PHP mat use karo.** App sirf Node.js se chalegi.

---

## Pehli baar (ek baar)

```bash
# 1. Frontend build
cd frontend
npm install
npm run build

# 2. Backend dependencies
cd ../backend-node
npm install
```

---

## Har baar app chalane ke liye

```bash
cd backend-node
npm start
```

Browser mein kholo: **http://localhost:3000**

---

## Development (code change pe fast reload)

**Terminal 1 – Backend:**
```bash
cd backend-node
npm start
```

**Terminal 2 – Frontend:**
```bash
cd frontend
npm run dev
```

Browser: **http://localhost:5173**

---

- **Database:** MySQL, same DB `marcom_street_crm` (backend-node/.env mein DB_* set karo)
- **Port:** 3000 (ya .env mein PORT=3001)
- **Apache:** Zaroorat nahi
