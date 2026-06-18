import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

const emptyProfile = {
  company_name: '',
  email: '',
  phone: '',
  address: '',
  time_zone: 'Asia/Kolkata',
  currency: 'INR',
  date_format: 'DD/MM/YYYY',
  gst_number: '',
  pan_number: '',
  quotation_template: 'standard',
  quotation_header_text: '',
  quotation_footer_text: 'Thank you for your business!',
  logo_path: '',
  bank_name: '',
  account_holder_name: '',
  account_name: '',
  account_number: '',
  ifsc_code: '',
  branch_name: '',
  nature: 'Current Account',
  signature_path: '',
  stamp_path: '',
};

const profileFields = [
  'company_name',
  'email',
  'phone',
  'address',
  'gst_number',
  'pan_number',
  'time_zone',
  'currency',
  'date_format',
  'logo_path',
  'bank_name',
  'account_holder_name',
  'account_number',
  'ifsc_code',
  'branch_name',
  'nature',
  'stamp_path',
];

export default function AdminCompanyProfile() {
  const [profile, setProfile] = useState(emptyProfile);
  const [originalProfile, setOriginalProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const uploadsBase = useMemo(() => {
    const base = api.defaults.baseURL || '';
    return base.replace(/\/api\/?$/, '');
  }, []);

  const logoUrl = profile.logo_path ? `${uploadsBase}/${profile.logo_path}` : '';
  const stampUrl = profile.stamp_path ? `${uploadsBase}/${profile.stamp_path}` : '';

  const completion = useMemo(() => {
    const filled = profileFields.filter((field) => String(profile[field] || '').trim()).length;
    return Math.round((filled / profileFields.length) * 100);
  }, [profile]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(profile) !== JSON.stringify(originalProfile);
  }, [profile, originalProfile]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/company-settings');
      if (response.data?.success) {
        const next = { ...emptyProfile, ...(response.data.data || {}) };
        setProfile(next);
        setOriginalProfile(next);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Company profile load nahi ho paaya');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const updateTaxField = (field, value) => {
    updateField(field, String(value || '').toUpperCase().trim());
  };

  const saveProfile = async (event) => {
    event?.preventDefault();

    if (!String(profile.company_name || '').trim()) {
      alert('Company name required hai');
      return;
    }

    setSaving(true);
    try {
      const response = await api.put('/admin/company-settings', profile);
      if (response.data?.success) {
        const next = { ...emptyProfile, ...(response.data.data || profile) };
        setProfile(next);
        setOriginalProfile(next);
        alert('Company profile saved');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Company profile save nahi ho paaya');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const response = await api.post('/admin/company-settings/logo', form);
      if (response.data?.success) {
        const next = { ...emptyProfile, ...(response.data.data || profile) };
        setProfile(next);
        setOriginalProfile(next);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Logo upload nahi ho paaya');
    } finally {
      setUploading(false);
    }
  };

  const uploadStamp = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('stamp', file);
      const response = await api.post('/admin/company-settings/stamp', form);
      if (response.data?.success) {
        const next = { ...emptyProfile, ...(response.data.data || profile) };
        setProfile(next);
        setOriginalProfile(next);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Stamp upload nahi ho paaya');
    } finally {
      setUploading(false);
    }
  };

  const resetChanges = () => {
    setProfile(originalProfile);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-sm font-semibold text-gray-500">Loading company profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <i className="fas fa-id-card text-xl"></i>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2c86ab]">Company Admin Panel</p>
              <h1 className="mt-1 text-2xl font-black text-gray-900">Company Profile</h1>
              <p className="mt-1 text-sm text-gray-600">Brand, tax, billing, and document identity used across CRM and HRMS</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadProfile}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={resetChanges}
              disabled={!hasChanges || saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving || uploading}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xl font-black text-blue-600">
                    {String(profile.company_name || 'C').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-gray-900">{profile.company_name || 'Company Name'}</p>
                <p className="truncate text-sm font-semibold text-gray-500">{profile.email || 'company@email.com'}</p>
                <p className="mt-1 text-xs font-bold text-gray-400">{profile.phone || 'No phone added'}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Profile Complete</span>
                <span className="text-sm font-black text-blue-700">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${completion}%` }}></div>
              </div>
            </div>

            <label className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-100">
              <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
              {uploading ? 'Uploading Logo...' : 'Upload Company Logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => uploadLogo(event.target.files?.[0])}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-gray-700">Document Preview</h2>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">{profile.company_name || 'Company Name'}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">{profile.address || 'Company address'}</p>
                </div>
                <div className="flex h-12 w-16 items-center justify-center rounded-lg border border-gray-200 bg-white">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-black text-gray-400">LOGO</span>
                  )}
                </div>
              </div>
              <div className="mt-4 border-t border-gray-200 pt-3 text-xs font-semibold text-gray-600">
                <p>GSTIN: {profile.gst_number || '-'}</p>
                <p>PAN: {profile.pan_number || '-'}</p>
                <p>Currency: {profile.currency || 'INR'}</p>
                <p>Bank: {profile.bank_name || '-'}</p>
                <p>A/C: {profile.account_number || '-'}</p>
                <p>IFSC: {profile.ifsc_code || '-'}</p>
              </div>
              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Signature Box</p>
                    <p className="mt-1 text-[11px] font-semibold text-gray-400">Manual sign on printed invoice</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black text-gray-500">Blank</span>
                </div>
                <div className="mt-3 h-20 rounded-xl border border-dashed border-gray-300 bg-gray-50"></div>
              </div>
            </div>
          </div>
        </aside>

        <form onSubmit={saveProfile} className="space-y-4">
          <Section title="Business Information" icon="fa-building">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Company Name" required value={profile.company_name} onChange={(value) => updateField('company_name', value)} />
              <Field label="Email" type="email" value={profile.email} onChange={(value) => updateField('email', value)} />
              <Field label="Phone" value={profile.phone} onChange={(value) => updateField('phone', value)} />
              <Field label="Time Zone" value={profile.time_zone} onChange={(value) => updateField('time_zone', value)} placeholder="Asia/Kolkata" />
              <Field label="Currency" value={profile.currency} onChange={(value) => updateField('currency', value.toUpperCase())} placeholder="INR" />
              <Field label="Date Format" value={profile.date_format} onChange={(value) => updateField('date_format', value)} placeholder="DD/MM/YYYY" />
              <div className="md:col-span-2">
                <TextAreaField label="Registered Address" value={profile.address} onChange={(value) => updateField('address', value)} />
              </div>
            </div>
          </Section>

          <Section title="Tax & Compliance" icon="fa-file-invoice-dollar">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="GST Number"
                value={profile.gst_number}
                onChange={(value) => updateTaxField('gst_number', value)}
                maxLength={15}
                placeholder="22AAAAA0000A1Z5"
              />
              <Field
                label="PAN Number"
                value={profile.pan_number}
                onChange={(value) => updateTaxField('pan_number', value)}
                maxLength={10}
                placeholder="AAAAA0000A"
              />
            </div>
          </Section>

          <Section title="Bank & Invoice Details" icon="fa-university">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Bank Name" value={profile.bank_name} onChange={(value) => updateField('bank_name', value)} placeholder="Canara Bank" />
              <Field label="Account Holder Name" value={profile.account_holder_name} onChange={(value) => updateField('account_holder_name', value)} placeholder="Vanya Group" />
              <Field label="Account Number" value={profile.account_number} onChange={(value) => updateField('account_number', value)} placeholder="1234567890" />
              <Field label="IFSC Code" value={profile.ifsc_code} onChange={(value) => updateField('ifsc_code', value)} placeholder="SBIN0000123" />
              <Field label="Branch Name" value={profile.branch_name} onChange={(value) => updateField('branch_name', value)} placeholder="Noida" />
              <Field label="Nature" value={profile.nature} onChange={(value) => updateField('nature', value)} placeholder="Current Account" />
            </div>
          </Section>

          <Section title="Signature & Mohar" icon="fa-pen-fancy">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-900">Manual Signature Area</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Printed copy par pen se sign karna hai</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-gray-500">No image</span>
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-4">
                  <div className="flex h-20 items-end justify-center">
                    <div className="w-40 border-b-2 border-gray-400"></div>
                  </div>
                  <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">Authorized Signatory</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-gray-900">Mohar / Stamp</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">PDF me company seal ke roop me print hogi</p>
                  </div>
                  {stampUrl ? (
                    <div className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-2">
                      <img src={stampUrl} alt="Stamp preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : null}
                </div>
                <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#2c86ab]/20 bg-white px-4 py-2.5 text-sm font-black text-[#2c86ab] hover:bg-blue-50">
                  <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-stamp'}`}></i>
                  {uploading ? 'Uploading...' : (stampUrl ? 'Replace Stamp' : 'Upload Stamp')}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) => uploadStamp(event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </Section>

          <Section title="Document Defaults" icon="fa-file-signature">
            <div className="grid grid-cols-1 gap-4">
              <Field
                label="Quotation Header Text"
                value={profile.quotation_header_text}
                onChange={(value) => updateField('quotation_header_text', value)}
                placeholder="Optional header line for quotation PDFs"
              />
              <Field
                label="Quotation Footer Text"
                value={profile.quotation_footer_text}
                onChange={(value) => updateField('quotation_footer_text', value)}
                placeholder="Thank you for your business!"
              />
            </div>
          </Section>

          <div className="sticky bottom-0 z-10 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-gray-500">
                {hasChanges ? 'Unsaved profile changes are ready to save.' : 'Company profile is up to date.'}
              </p>
              <button
                type="submit"
                disabled={saving || uploading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                {saving ? 'Saving...' : 'Save Company Profile'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <i className={`fas ${icon}`}></i>
        </span>
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-gray-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '', ...rest }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">
        {label}{required ? ' *' : ''}
      </label>
      <input
        {...rest}
        required={required}
        type={type}
        value={value || ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</label>
      <textarea
        rows={4}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
