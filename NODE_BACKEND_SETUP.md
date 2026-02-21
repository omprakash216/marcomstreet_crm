# Node.js Backend – Setup (PDF open/download fix)

Backend ab **Node.js** mein bhi available hai. Isse PDF open/download aur MIME type issues fix ho jaate hain.

## 1. Node backend chalaana

```bash
cd backend-node
npm install
npm start
```

Server `http://localhost:3000` par chalega.

## 2. Frontend se Node backend use karna

Frontend folder mein **`.env`** file banao (ya update karo):

```
VITE_USE_NODE_BACKEND=true
```

Phir frontend dev server:

```bash
cd frontend
npm run dev
```

Ab saari API calls aur **PDF View/Download** Node backend (port 3000) par jayengi. PDF sahi MIME type (`application/pdf`) ke sath open/download hoga.

## 3. Database

Node backend wahi MySQL database use karta hai: **marcom_street_crm**.  
PHP backend ke liye jo DB use kar rahe ho, wahi credentials `backend-node/.env` mein daal sakte ho (optional):

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## 4. PHP backend wapas use karna

Frontend `.env` se `VITE_USE_NODE_BACKEND=true` hata do (ya comment karo).  
Phir frontend Apache/PHP backend use karega (pehle jaisa).

---

**Summary:** Node backend = `backend-node/` folder, `npm start`.  
Frontend = `.env` mein `VITE_USE_NODE_BACKEND=true` → PDF + saari API Node se.
