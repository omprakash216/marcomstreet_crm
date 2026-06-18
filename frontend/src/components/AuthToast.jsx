export default function AuthToast({ toast }) {
  if (!toast) return null;

  const type = String(toast.type || 'info').toLowerCase();
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-200/50',
    error: 'border-rose-200 bg-rose-50 text-rose-900 shadow-rose-200/50',
    info: 'border-sky-200 bg-sky-50 text-sky-900 shadow-sky-200/50',
  };

  return (
    <div className="fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${styles[type] || styles.info}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] opacity-70">
          {toast.title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice')}
        </p>
        <p className="mt-1 text-sm font-medium leading-6">{toast.message}</p>
      </div>
    </div>
  );
}
