# Quick Start – Sirf Node (No PHP, No Apache)

**Is project ko sirf Node.js se chalao.** Apache ya PHP use mat karo.

---

## Normal use (ek hi server – app + API)

### 1. Frontend build (pehli baar ya frontend change ke baad)

```bash
cd frontend
npm install
npm run build
```

### 2. Node server start

```bash
cd backend-node
npm install
npm start
```

### 3. Browser

```
http://localhost:3000
```

Login, dashboard, sab kuch yahi se chalega.

---

## Development (fast reload)

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

Browser: **http://localhost:5173** (API requests Node 3000 par proxy hongi)

Agar backend 3001 par chale to `frontend/.env` mein: `VITE_API_PORT=3001`

---

## Summary

- **Sirf Node** – Apache / PHP ki zaroorat nahi
- **App URL:** http://localhost:3000 (build ke baad) ya http://localhost:5173 (dev)
- **Database:** MySQL, `marcom_street_crm` (backend-node/.env)
