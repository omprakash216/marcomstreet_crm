import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const emptySettings = {
  company_name: '',
  email: '',
  phone: '',
  address: '',
  time_zone: '',
  currency: '',
  date_format: '',
  gst_number: '',
  pan_number: '',
  logo_path: '',
};

export default function AdminCompanySettings() {
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const uploadsBase = useMemo(() => {
    const base = api.defaults.baseURL || '';
    return base.replace(/\/api\/?$/, '');
  }, []);

  const logoUrl = settings.logo_path ? `${uploadsBase}/${settings.logo_path}` : '';

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleTaxIdChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: String(value || '').toUpperCase().trim() }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put('/admin/company-settings', settings);
      if (response.data?.success) {
        alert('Company settings saved');
        setSettings({ ...emptySettings, ...(response.data.data || settings) });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save settings');
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
          <p className="text-gray-600">Loading company settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 rounded-2xl shadow-xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/10 text-white">
            <i className="fas fa-cog text-2xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Company Settings</h1>
            <p className="text-slate-300 text-sm">Configure global company details and branding</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Company Logo</p>
                <div className="w-full h-40 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-center text-slate-400 text-sm">
                      <i className="fas fa-image text-2xl mb-2"></i>
                      <p>No logo uploaded</p>
                    </div>
                  )}
                </div>
                <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow hover:bg-blue-700 cursor-pointer">
                  <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                  <span>{uploading ? 'Uploading...' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Company Name</label>
                  <input
                    type="text"
                    value={settings.company_name || ''}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                  <input
                    type="email"
                    value={settings.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="support@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Phone</label>
                  <input
                    type="text"
                    value={settings.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Time Zone</label>
                  <input
                    type="text"
                    value={settings.time_zone || ''}
                    onChange={(e) => handleChange('time_zone', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="Asia/Kolkata"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Currency</label>
                  <input
                    type="text"
                    value={settings.currency || ''}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="INR"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date Format</label>
                  <input
                    type="text"
                    value={settings.date_format || ''}
                    onChange={(e) => handleChange('date_format', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">GST Number</label>
                  <input
                    type="text"
                    value={settings.gst_number || ''}
                    onChange={(e) => handleTaxIdChange('gst_number', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm uppercase focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
                    title="Enter a valid 15-character GST number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">PAN Card Number</label>
                  <input
                    type="text"
                    value={settings.pan_number || ''}
                    onChange={(e) => handleTaxIdChange('pan_number', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm uppercase focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                    placeholder="AAAAA0000A"
                    maxLength={10}
                    pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                    title="Enter a valid 10-character PAN number"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Address</label>
                <textarea
                  value={settings.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none resize-none"
                  rows={4}
                  placeholder="Company address"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
