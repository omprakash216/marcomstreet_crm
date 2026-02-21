# Error List – Frontend & backend-node (no PHP)

**Last checked:** Based on linter, build, and code review.

---

## ✅ Fixed in this pass

| File | Issue | Fix |
|------|--------|-----|
| **frontend/src/pages/CompanyLogin.jsx** | Wrong API path: `/company/login` → 404 (backend has `/api/companies`) | Changed to `companyApi.post('/companies/login', formData)` |
| **frontend/src/styles/experience-letter.css** | Build warning: deprecated `color-adjust` | Replaced with `print-color-adjust: exact` |
| **backend-node/routes/companies.js** | No company login/register route → Company Login & Company Management 404 | Added `POST /login` (supports `company_id` and register/login by email) |

---

## ✅ No errors (verified)

- **Linter:** No errors in `frontend/src` or `backend-node`.
- **Frontend build:** `npm run build` succeeds (only chunk-size warning, not error).
- **Login:** `Login.jsx` uses `api.post('/auth/login', formData)` – no `.php`, correct.
- **api.js:** No `.php` append; baseURL `/api`; URLs start with `/`.
- **Chat:** Uses `api.post('/chat', …)` – no `.php`.

---

## ⚠️ Warnings (non-blocking)

| File | Warning | Action |
|------|---------|--------|
| **frontend (Vite build)** | Some chunks > 500 kB | Optional: code-split / dynamic import for Reports, Admin, etc. |
| **frontend/src/utils/api.js** | Console logs on every request | Optional: remove or guard with `import.meta.env.DEV` |

---

## Summary

- **Frontend:** 1 path fix (CompanyLogin), 1 CSS fix (experience-letter). No remaining known errors.
- **backend-node:** 1 missing route added (companies login). No remaining known errors.
- **PHP:** Not used; no PHP files in frontend or backend-node.

Agar koi naya error dikhe (browser console, build, ya backend start) to bata dena – us hisaab se list update kar sakte hain.
