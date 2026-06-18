import api from './api';

const PDF_MIME = 'application/pdf';

function toPdfBlob(value) {
  if (value instanceof Blob) return value;
  return new Blob([value], { type: PDF_MIME });
}

function buildPdfRequestUrl(url, params = {}) {
  const basePath = String(api.defaults.baseURL || '').replace(/\/$/, '');
  const rawPath = String(url || '').startsWith('/') ? String(url || '') : `/${String(url || '')}`;
  const resolved = new URL(`${basePath}${rawPath}`, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    resolved.searchParams.set(key, String(value));
  });
  return resolved.toString();
}

export function sanitizePdfFileName(value, fallback = 'document') {
  const safe = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || fallback;
}

export async function fetchPdfBlob(url, params = {}) {
  const response = await api.get(url, { responseType: 'blob', params });
  return toPdfBlob(response.data);
}

export async function openPdfFromApi(url, { params = {}, download = false, fileName = 'document.pdf' } = {}) {
  const popup = download ? null : window.open('', '_blank', 'noopener,noreferrer');
  try {
    const response = await api.get(url, {
      responseType: 'blob',
      params: download ? { ...params, download: 1 } : params,
    });
    const blob = toPdfBlob(response.data);
    const objectUrl = URL.createObjectURL(blob);

    if (download) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }

    if (!popup) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('Pop-up blocked. Please allow popups for this site.');
    }

    popup.location = objectUrl;
    if (typeof popup.focus === 'function') popup.focus();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  } catch (error) {
    if (popup && typeof popup.close === 'function') {
      popup.close();
    }
    throw error;
  }
}

export function openPdfUrlInNewTab(url, { params = {} } = {}) {
  const href = buildPdfRequestUrl(url, params);
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return href;
}

export function downloadPdfUrl(url, { params = {}, fileName = 'document.pdf' } = {}) {
  const href = buildPdfRequestUrl(url, { ...params, download: 1 });
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return href;
}

export async function printPdfFromApi(url, { params = {} } = {}) {
  const response = await api.get(url, {
    responseType: 'blob',
    params,
  });
  const blob = toPdfBlob(response.data);
  const objectUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.overflow = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');

  const host = document.body || document.documentElement;
  if (!host) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Unable to open print preview.');
  }

  return new Promise((resolve, reject) => {
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    };

    const finishPrint = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) throw new Error('Unable to open print preview.');
        if (typeof win.focus === 'function') win.focus();
        if (typeof win.print !== 'function') throw new Error('Printing is not supported in this browser.');
        // Give the built-in PDF viewer a moment to settle before printing.
        window.setTimeout(() => {
          try {
            win.print();
            resolve();
            window.setTimeout(cleanup, 10000);
          } catch (error) {
            cleanup();
            reject(error);
          }
        }, 250);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    iframe.onload = finishPrint;
    iframe.onerror = () => {
      cleanup();
      reject(new Error('Failed to load PDF for printing.'));
    };

    host.appendChild(iframe);
    iframe.src = objectUrl;
  });
}
