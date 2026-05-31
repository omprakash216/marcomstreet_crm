import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

async function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
  const pending = images
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })
    );

  if (pending.length > 0) {
    await Promise.all(pending);
  }
}

function getPages(root, pageSelector) {
  if (pageSelector) {
    const matched = Array.from(root.querySelectorAll(pageSelector));
    if (matched.length > 0) return matched;
  }
  return [root];
}

function extractBackgroundUrl(bgValue) {
  const raw = String(bgValue || '').trim();
  if (!raw || raw === 'none') return '';
  const m = raw.match(/url\((['"]?)(.*?)\1\)/i);
  return m && m[2] ? m[2] : '';
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function buildPdfBlobFromPreview({ root, pageSelector }) {
  if (!root) {
    throw new Error('Preview container not found.');
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  await waitForImages(root);

  const pages = getPages(root, pageSelector);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const renderScale = Math.max(2, Math.min(2.5, window.devicePixelRatio || 1));
  const backgroundCache = new Map();

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const markerId = `pdf-export-${Date.now()}-${index}`;
    page.setAttribute('data-pdf-export-id', markerId);

    const computedBg = window.getComputedStyle(page).backgroundImage || page.style.backgroundImage;
    const backgroundUrl = extractBackgroundUrl(computedBg);
    let backgroundImage = null;
    if (backgroundUrl) {
      if (!backgroundCache.has(backgroundUrl)) {
        backgroundCache.set(backgroundUrl, loadImage(backgroundUrl));
      }
      backgroundImage = await backgroundCache.get(backgroundUrl);
    }
    const hasBackgroundBase = Boolean(backgroundImage);

    let canvas;
    try {
      canvas = await html2canvas(page, {
        scale: renderScale,
        useCORS: true,
        backgroundColor: hasBackgroundBase ? null : '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const clonedPage = clonedDoc.querySelector(`[data-pdf-export-id="${markerId}"]`);
          if (clonedPage) {
            // Lock to exact A4 page box and remove preview-only decoration.
            clonedPage.style.margin = '0';
            clonedPage.style.border = '0';
            clonedPage.style.boxShadow = 'none';
            clonedPage.style.maxWidth = '210mm';
            clonedPage.style.width = '210mm';
            clonedPage.style.height = '297mm';
            clonedPage.style.minHeight = '297mm';
            clonedPage.style.maxHeight = '297mm';
            clonedPage.style.overflow = 'hidden';
            if (hasBackgroundBase) {
              // We'll draw letterhead separately as exact base layer in PDF.
              clonedPage.style.backgroundImage = 'none';
              clonedPage.style.backgroundColor = 'transparent';
            }
          }
        },
      });
    } finally {
      page.removeAttribute('data-pdf-export-id');
    }

    const imageData = canvas.toDataURL('image/png');

    if (index > 0) pdf.addPage('a4', 'portrait');
    if (backgroundImage) {
      pdf.addImage(backgroundImage, 'PNG', 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, undefined, 'FAST');
    }
    // Full-page A4 render keeps content alignment fixed with base letterhead.
    pdf.addImage(imageData, 'PNG', 0, 0, A4_WIDTH_PT, A4_HEIGHT_PT, undefined, 'FAST');
  }

  return pdf.output('blob');
}
