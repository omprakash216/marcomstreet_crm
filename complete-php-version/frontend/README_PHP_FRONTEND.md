# MARCOM React -> PHP Frontend Shell

This folder now runs the React frontend through PHP entry points while preserving React behavior.

## What was done
- React production bundle is served by `index.php` via `includes/react_spa.php`
- Route fallback is handled by `.htaccess` (React Router works on refresh/deep links)
- Legacy and route-style `.php` pages map to React routes
- `/api/*` is bridged to `../backend/index.php`
- `/serve-pdf` and `/uploads/*` are served with PHP handlers

## Update flow after React changes
1. Build React:
```powershell
cd frontend
npm run build
```
2. Sync assets:
```powershell
powershell -ExecutionPolicy Bypass -File complete-php-version/frontend/sync-react-build.ps1
```

## Deploy note
Serve `complete-php-version/frontend` as document root for absolute `/assets` and `/api` paths.
