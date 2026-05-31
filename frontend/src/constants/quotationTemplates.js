export const QUOTATION_TEMPLATES = [
  {
    key: 'standard',
    code: '01',
    name: 'Standard',
    label: '01 | Standard (No Logo)',
    shortLabel: 'Standard',
    accent: '#0f2f6e',
    description: 'Simple blue quotation without logo.',
  },
  {
    key: 'logo_left_details',
    code: '02',
    name: 'Logo Left + Details',
    label: '02 | Logo Left + Details',
    shortLabel: 'Logo Left',
    accent: '#123fba',
    description: 'Logo on left with company details beside it.',
  },
  {
    key: 'logo_center_details',
    code: '03',
    name: 'Logo Center + Details Below',
    label: '03 | Logo Center + Details Below',
    shortLabel: 'Logo Center',
    accent: '#087a2f',
    description: 'Centered logo and company identity.',
  },
  {
    key: 'minimal_clean',
    code: '06',
    name: 'Minimal Clean',
    label: '06 | Minimal Clean',
    shortLabel: 'Minimal',
    accent: '#111827',
    description: 'Clean black and white business format.',
  },
  {
    key: 'corporate_dark',
    code: '07',
    name: 'Corporate Dark',
    label: '07 | Corporate Dark',
    shortLabel: 'Corporate',
    accent: '#0f172a',
    description: 'Dark header and footer corporate layout.',
  },
  {
    key: 'premium_orange',
    code: '09',
    name: 'Premium Orange',
    label: '09 | Premium Orange',
    shortLabel: 'Orange',
    accent: '#f97316',
    description: 'Premium orange commercial style.',
  },
  {
    key: 'premium_gold',
    code: '10',
    name: 'Premium Gold',
    label: '10 | Premium Gold',
    shortLabel: 'Gold',
    accent: '#b7791f',
    description: 'Gold bordered premium quotation.',
  },
];

export const DEFAULT_QUOTATION_TEMPLATE = 'standard';

export function getQuotationTemplate(key) {
  return QUOTATION_TEMPLATES.find((template) => template.key === key) || QUOTATION_TEMPLATES[0];
}
