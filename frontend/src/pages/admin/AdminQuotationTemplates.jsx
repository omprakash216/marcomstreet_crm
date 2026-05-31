import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { DEFAULT_QUOTATION_TEMPLATE, QUOTATION_TEMPLATES } from '../../constants/quotationTemplates';

const emptySettings = {
  company_name: '',
  email: '',
  phone: '',
  address: '',
  gst_number: '',
  pan_number: '',
  logo_path: '',
  quotation_template: DEFAULT_QUOTATION_TEMPLATE,
  quotation_header_text: '',
  quotation_footer_text: 'Thank you for your business!',
};

function TemplatePreview({ template, selected, onSelect, logoUrl, companyName }) {
  const isDark = template.key === 'corporate_dark';
  const isCenter = template.key === 'logo_center_details' || template.key === 'premium_gold';
  const hideLogo = template.key === 'standard' || template.key === 'minimal_clean';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left bg-white border rounded-xl overflow-hidden transition-all ${
        selected ? 'border-blue-600 ring-2 ring-blue-100 shadow-md' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <div
        className="px-3 py-2 text-center text-[11px] font-black uppercase tracking-widest text-white"
        style={{ backgroundColor: isDark ? '#0f172a' : template.accent }}
      >
        {template.label}
      </div>
      <div className="p-3 bg-white">
        <div className={`h-48 border rounded-lg overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
          <div
            className={`px-3 py-3 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'} ${
              isCenter ? 'text-center' : 'flex items-start justify-between gap-2'
            }`}
          >
            {!hideLogo && (
              <div
                className={`shrink-0 inline-flex items-center justify-center rounded-md border overflow-hidden ${
                  isCenter ? 'mx-auto mb-1 h-9 w-14' : 'h-9 w-14'
                }`}
                style={{ borderColor: template.accent }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[8px] font-black" style={{ color: template.accent }}>LOGO</span>
                )}
              </div>
            )}
            <div className={isCenter ? '' : 'min-w-0 flex-1'}>
              <div className={`text-[10px] font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {companyName || 'COMPANY NAME'}
              </div>
              <div className={`text-[7px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>TAGLINE HERE</div>
            </div>
            {!isCenter && (
              <div className="text-[10px] font-black" style={{ color: isDark ? '#fff' : template.accent }}>
                QUOTATION
              </div>
            )}
          </div>
          {isCenter && <div className="text-center text-[10px] font-black mt-1" style={{ color: template.accent }}>QUOTATION</div>}
          <div className="mx-3 mt-2 border-t" style={{ borderColor: template.accent }}></div>
          <div className="grid grid-cols-2 gap-3 px-3 py-3 text-[7px] text-slate-600">
            <div>
              <div className="font-black text-slate-900">From</div>
              <div>Your Company Name</div>
              <div>123 Business Street</div>
            </div>
            <div>
              <div className="font-black text-slate-900">To</div>
              <div>Client Name</div>
              <div>Client Company</div>
            </div>
          </div>
          <div className="mx-3">
            <div className="grid grid-cols-4 text-[7px] text-white font-black px-2 py-1" style={{ backgroundColor: template.accent }}>
              <span>#</span>
              <span className="col-span-2">DESCRIPTION</span>
              <span className="text-right">AMOUNT</span>
            </div>
            {[1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-4 text-[7px] border-b border-slate-100 px-2 py-1">
                <span>{row}</span>
                <span className="col-span-2">Product / Service</span>
                <span className="text-right">3,000</span>
              </div>
            ))}
          </div>
          <div className="mx-3 mt-2 flex justify-end">
            <div className="w-24 text-[7px]">
              <div className="flex justify-between"><span>Subtotal</span><span>10,300</span></div>
              <div className="flex justify-between text-white px-1 py-0.5 mt-1 font-black" style={{ backgroundColor: template.accent }}>
                <span>Total</span><span>12,154</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-gray-900">{template.name}</p>
            <p className="text-xs text-gray-500 mt-1">{template.description}</p>
          </div>
          <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
            {selected ? <i className="fas fa-check text-[10px]"></i> : null}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function AdminQuotationTemplates() {
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadsBase = useMemo(() => {
    const base = api.defaults.baseURL || '';
    return base.replace(/\/api\/?$/, '');
  }, []);

  const logoUrl = settings.logo_path ? `${uploadsBase}/${settings.logo_path}` : '';

  useEffect(() => {
    let mounted = true;
    api
      .get('/admin/company-settings')
      .then((res) => {
        if (mounted && res.data?.success) {
          setSettings({ ...emptySettings, ...(res.data.data || {}) });
        }
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.put('/admin/company-settings', settings);
      if (response.data?.success) {
        setSettings({ ...emptySettings, ...(response.data.data || settings) });
        alert('Quotation format saved');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save quotation format');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const response = await api.post('/admin/company-settings/logo', form);
      if (response.data?.success) {
        setSettings({ ...emptySettings, ...(response.data.data || settings) });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quotation formats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 via-blue-800 to-cyan-700 rounded-xl shadow-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fas fa-file-invoice text-white text-2xl"></i>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-cyan-100 font-black">Company Admin Panel</p>
              <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">Quotation Formats</h1>
              <p className="text-cyan-50/90 text-sm mt-1">Company quotation PDF ke header, footer, logo aur layout setup karo.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-white text-blue-800 rounded-lg font-black hover:bg-blue-50 disabled:opacity-60 transition-colors shadow-lg"
          >
            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'} mr-2`}></i>
            {saving ? 'Saving...' : 'Save Format'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Branding</h2>
            <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
              <div className="w-40 h-20 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-slate-400 text-xs font-bold">
                    <i className="fas fa-image text-xl mb-1 block"></i>
                    LOGO
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs font-bold text-slate-500">Standard logo slot: 160 x 80 px</p>
              <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow hover:bg-blue-700 cursor-pointer">
                <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                <span>{uploading ? 'Uploading...' : 'Upload Logo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Company Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Company Name</label>
                <input
                  type="text"
                  value={settings.company_name || ''}
                  onChange={(event) => handleChange('company_name', event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(event) => handleChange('email', event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Phone</label>
                <input
                  type="text"
                  value={settings.phone || ''}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">GST Number</label>
                <input
                  type="text"
                  value={settings.gst_number || ''}
                  onChange={(event) => handleChange('gst_number', String(event.target.value || '').toUpperCase().trim())}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={15}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">PAN Number</label>
                <input
                  type="text"
                  value={settings.pan_number || ''}
                  onChange={(event) => handleChange('pan_number', String(event.target.value || '').toUpperCase().trim())}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={10}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Address</label>
                <textarea
                  value={settings.address || ''}
                  onChange={(event) => handleChange('address', event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Header Text</label>
                <input
                  type="text"
                  value={settings.quotation_header_text || ''}
                  onChange={(event) => handleChange('quotation_header_text', event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional quotation header text"
                  maxLength={180}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Footer Text</label>
                <input
                  type="text"
                  value={settings.quotation_footer_text || ''}
                  onChange={(event) => handleChange('quotation_footer_text', event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Thank you for your business!"
                  maxLength={220}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Select Quotation Format</h2>
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-black uppercase tracking-wider">
            {QUOTATION_TEMPLATES.find((item) => item.key === settings.quotation_template)?.shortLabel || 'Standard'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {QUOTATION_TEMPLATES.map((template) => (
            <TemplatePreview
              key={template.key}
              template={template}
              selected={(settings.quotation_template || DEFAULT_QUOTATION_TEMPLATE) === template.key}
              onSelect={() => handleChange('quotation_template', template.key)}
              logoUrl={logoUrl}
              companyName={settings.company_name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
