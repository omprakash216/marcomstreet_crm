import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';

export default function SystemSettings() {
    const navigate = useNavigate();
    const employee = useMemo(() => getEmployee(), []);
    const [settings, setSettings] = useState({
        site_name: 'MARCOM STREET CRM',
        maintenance_mode: 'false',
        allow_registration: 'true',
        smtp_host: '',
        smtp_port: '587',
        smtp_secure: 'false',
        smtp_user: '',
        smtp_pass: '',
        smtp_from_name: 'MARCOM STREET CRM',
        smtp_from_email: '',
        mail_from: '',
        password_reset_brand_name: 'MARCOM STREET CRM',
        allow_email_preview: 'false',
        disable_email_sending: 'false',
        storage_limit_default: '5',
        primary_color: '#4f46e5',
        sms_provider: 'msg91',
        sender_id: 'VG',
        msg91_sender_id: 'VG',
        otp_prefix: 'VG',
        otp_expiry_minutes: '5',
        sms_otp_status: 'active',
        msg91_template_id: '',
        msg91_auth_key: '',
        two_factor_api_key: '',
    });
    const [smsStatus, setSmsStatus] = useState(null);
    const [emailStatus, setEmailStatus] = useState(null);
    const [smsFieldErrors, setSmsFieldErrors] = useState({});
    const [saveMessage, setSaveMessage] = useState(null);
    const [testSmsMessage, setTestSmsMessage] = useState(null);
    const [testPhone, setTestPhone] = useState('');
    const [testingSms, setTestingSms] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const role = normalizeRole(employee?.role);
        if (!employee || (role !== 'superadmin' && role !== 'super_admin')) {
            navigate('/');
            return;
        }
        fetchSettings();
    }, [employee, navigate]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/superadmin/settings');
            if (res.data?.success) {
                const data = res.data.data || {};
                setSmsStatus(data.sms_status || null);
                setEmailStatus(data.email_status || null);
                setSettings((prev) => ({
                    ...prev,
                    site_name: data.site_name ?? prev.site_name,
                    maintenance_mode: data.maintenance_mode ?? prev.maintenance_mode,
                    allow_registration: data.allow_registration ?? prev.allow_registration,
                    smtp_host: data.smtp_host ?? prev.smtp_host,
                    smtp_port: String(data.smtp_port ?? prev.smtp_port),
                    smtp_secure: String(data.smtp_secure ?? prev.smtp_secure),
                    smtp_user: data.smtp_user ?? prev.smtp_user,
                    smtp_pass: '',
                    smtp_from_name: data.smtp_from_name ?? prev.smtp_from_name,
                    smtp_from_email: data.smtp_from_email ?? prev.smtp_from_email,
                    mail_from: data.mail_from ?? prev.mail_from,
                    password_reset_brand_name: data.password_reset_brand_name ?? prev.password_reset_brand_name,
                    allow_email_preview: String(data.allow_email_preview ?? prev.allow_email_preview),
                    disable_email_sending: String(data.disable_email_sending ?? prev.disable_email_sending),
                    storage_limit_default: data.storage_limit_default ?? prev.storage_limit_default,
                    primary_color: data.primary_color ?? prev.primary_color,
                    sms_provider: data.sms_provider ?? data.provider ?? prev.sms_provider,
                    sender_id: data.sender_id ?? data.msg91_sender_id ?? prev.sender_id,
                    msg91_sender_id: data.msg91_sender_id ?? data.sender_id ?? prev.msg91_sender_id,
                    otp_prefix: data.otp_prefix ?? data.sender_id ?? prev.otp_prefix,
                    otp_expiry_minutes: String(data.otp_expiry_minutes ?? prev.otp_expiry_minutes),
                    sms_otp_status: data.sms_otp_status ?? prev.sms_otp_status,
                    msg91_template_id: data.msg91_template_id ?? prev.msg91_template_id,
                    msg91_auth_key: '',
                    two_factor_api_key: '',
                }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setSmsFieldErrors({});
            setSaveMessage(null);
            const payload = { ...settings };
            if (!String(payload.smtp_pass || '').trim()) delete payload.smtp_pass;
            if (!String(payload.msg91_auth_key || '').trim()) delete payload.msg91_auth_key;
            if (!String(payload.two_factor_api_key || '').trim()) delete payload.two_factor_api_key;
            payload.sender_id = payload.sender_id || payload.msg91_sender_id || payload.otp_prefix || 'VG';
            payload.msg91_sender_id = payload.sender_id;
            payload.otp_prefix = payload.sender_id;
            payload.smtp_port = String(payload.smtp_port || '587');

            const res = await api.post('/superadmin/settings', payload);
            if (res.data?.success) {
                if (res.data.data?.sms_status) setSmsStatus(res.data.data.sms_status);
                if (res.data.data?.email_status) setEmailStatus(res.data.data.email_status);
                setSaveMessage({ type: 'success', text: res.data.message || 'Settings saved successfully.' });
                setSettings((prev) => ({ ...prev, msg91_auth_key: '', two_factor_api_key: '', smtp_pass: '' }));
                fetchSettings();
            }
        } catch (err) {
            const data = err.response?.data || {};
            setSmsFieldErrors(data.errors || {});
            setSaveMessage({ type: 'error', text: data.message || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleTestSms = async () => {
        setSmsFieldErrors({});
        setTestSmsMessage(null);
        if (!testPhone.trim()) {
            setSmsFieldErrors({ test_phone: 'Test ke liye mobile number daalein.' });
            return;
        }
        try {
            setTestingSms(true);
            const res = await api.post('/superadmin/settings/test-sms', { phone: testPhone.trim() });
            setTestSmsMessage({ type: 'success', text: res.data?.message || 'Test SMS sent successfully.' });
        } catch (err) {
            const data = err.response?.data || {};
            setSmsFieldErrors(data.errors || {});
            setTestSmsMessage({ type: 'error', text: data.message || err.message });
        } finally {
            setTestingSms(false);
        }
    };

    const updateSetting = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const inputClass = (errorKey, extra = '') =>
        `w-full rounded-lg border bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 ${
            smsFieldErrors[errorKey] ? 'border-rose-400' : 'border-slate-200'
        } ${extra}`;

    const errorText = (key) =>
        smsFieldErrors[key] ? <p className="mt-1 text-xs text-rose-600">{smsFieldErrors[key]}</p> : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
            <header className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-5 sm:px-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Super Admin</p>
                        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Global System Settings</h1>
                        <p className="text-slate-500 text-sm mt-1">Branding, access control, and infra knobs that affect the whole platform.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <div className="flex items-center gap-2">
                        <span className="h-5 w-1 rounded-full bg-indigo-600"></span>
                        <h2 className="text-lg font-semibold text-slate-900">Branding</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em]">Site Title</label>
                            <input
                                type="text"
                                value={settings.site_name}
                                onChange={(e) => updateSetting('site_name', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em]">Primary Accent</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={settings.primary_color}
                                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                                    className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-0"
                                />
                                <input
                                    type="text"
                                    value={settings.primary_color}
                                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono uppercase focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.14em] mb-3">Live Preview</p>
                        <div className="rounded-xl border border-white shadow-sm bg-white px-5 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em]">Header</p>
                                <p className="text-lg font-semibold" style={{ color: settings.primary_color }}>{settings.site_name || 'MARCOM STREET CRM'}</p>
                                <p className="text-xs text-slate-500">Primary color applied to accents and call-to-action buttons.</p>
                            </div>
                            <span className="h-10 w-10 rounded-xl shadow-inner" style={{ background: settings.primary_color }}></span>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <div className="flex items-center gap-2">
                        <span className="h-5 w-1 rounded-full bg-rose-500"></span>
                        <h2 className="text-lg font-semibold text-slate-900">Access & Infrastructure</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Maintenance Mode</p>
                                <p className="text-xs text-slate-500">Temporarily block non-admin users.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateSetting('maintenance_mode', settings.maintenance_mode === 'true' ? 'false' : 'true')}
                                className={`w-12 h-6 rounded-full transition-colors relative shadow-inner ${settings.maintenance_mode === 'true' ? 'bg-rose-500' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${settings.maintenance_mode === 'true' ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Allow Self Registration</p>
                                <p className="text-xs text-slate-500">Enable public signups (if disabled, invite-only).</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateSetting('allow_registration', settings.allow_registration === 'true' ? 'false' : 'true')}
                                className={`w-12 h-6 rounded-full transition-colors relative shadow-inner ${settings.allow_registration === 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${settings.allow_registration === 'true' ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMTP Gateway</label>
                            <input
                                type="text"
                                value={settings.smtp_host}
                                onChange={(e) => updateSetting('smtp_host', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                                placeholder="smtp.domain.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">Default Storage (GB)</label>
                            <input
                                type="number"
                                min="1"
                                value={settings.storage_limit_default}
                                onChange={(e) => updateSetting('storage_limit_default', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                    </div>
                </section>

                <section className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-sky-200 p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="h-5 w-1 rounded-full bg-sky-500"></span>
                            <h2 className="text-lg font-semibold text-slate-900">Email OTP (Forgot Password)</h2>
                        </div>
                        <span
                            className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                emailStatus?.emailConfigured
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                            }`}
                        >
                            {emailStatus?.deliveryMode === 'preview'
                                ? 'Preview mode'
                                : emailStatus?.emailConfigured
                                    ? `Active - ${emailStatus.provider || 'smtp'}`
                                    : 'Not configured'}
                        </span>
                    </div>

                    <p className="text-sm text-slate-600">
                        Live OTP delivery ke liye SMTP settings yahan save karo. Preview mode sirf local testing ke
                        liye hai. Production me SMTP credentials wajib hain.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMTP Host</label>
                            <input
                                type="text"
                                value={settings.smtp_host}
                                onChange={(e) => updateSetting('smtp_host', e.target.value)}
                                className={inputClass('smtp_host')}
                                placeholder="smtp.domain.com"
                            />
                            {errorText('smtp_host')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMTP Port</label>
                            <input
                                type="number"
                                min="1"
                                value={settings.smtp_port}
                                onChange={(e) => updateSetting('smtp_port', e.target.value)}
                                className={inputClass('smtp_port')}
                                placeholder="587"
                            />
                            {errorText('smtp_port')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMTP Secure</label>
                            <select
                                value={settings.smtp_secure}
                                onChange={(e) => updateSetting('smtp_secure', e.target.value)}
                                className={inputClass('smtp_secure')}
                            >
                                <option value="false">false</option>
                                <option value="true">true</option>
                            </select>
                            {errorText('smtp_secure')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMTP User</label>
                            <input
                                type="text"
                                value={settings.smtp_user}
                                onChange={(e) => updateSetting('smtp_user', e.target.value)}
                                className={inputClass('smtp_user')}
                                placeholder="no-reply@yourdomain.com"
                                autoComplete="off"
                            />
                            {errorText('smtp_user')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                SMTP Password
                                {emailStatus?.smtpPassSet && <span className="ml-2 text-emerald-600 normal-case">(saved)</span>}
                            </label>
                            <input
                                type="password"
                                value={settings.smtp_pass}
                                onChange={(e) => updateSetting('smtp_pass', e.target.value)}
                                className={inputClass('smtp_pass')}
                                placeholder="SMTP password or app password"
                                autoComplete="off"
                            />
                            {errorText('smtp_pass')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMTP From Name</label>
                            <input
                                type="text"
                                value={settings.smtp_from_name}
                                onChange={(e) => updateSetting('smtp_from_name', e.target.value)}
                                className={inputClass('smtp_from_name')}
                                placeholder="MARCOM STREET CRM"
                            />
                            {errorText('smtp_from_name')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMTP From Email</label>
                            <input
                                type="email"
                                value={settings.smtp_from_email}
                                onChange={(e) => updateSetting('smtp_from_email', e.target.value)}
                                className={inputClass('smtp_from_email')}
                                placeholder="no-reply@yourdomain.com"
                                autoComplete="off"
                            />
                            {errorText('smtp_from_email')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">MAIL_FROM</label>
                            <input
                                type="text"
                                value={settings.mail_from}
                                onChange={(e) => updateSetting('mail_from', e.target.value)}
                                className={inputClass('mail_from')}
                                placeholder='"MARCOM STREET CRM <no-reply@yourdomain.com>"'
                            />
                            {errorText('mail_from')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">Reset Brand Name</label>
                            <input
                                type="text"
                                value={settings.password_reset_brand_name}
                                onChange={(e) => updateSetting('password_reset_brand_name', e.target.value)}
                                className={inputClass('password_reset_brand_name')}
                                placeholder="MARCOM STREET CRM"
                            />
                            {errorText('password_reset_brand_name')}
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Allow Preview Mode</p>
                                <p className="text-xs text-slate-500">Local dev testing only. Keep off in production.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateSetting('allow_email_preview', settings.allow_email_preview === 'true' ? 'false' : 'true')}
                                className={`w-12 h-6 rounded-full transition-colors relative shadow-inner ${settings.allow_email_preview === 'true' ? 'bg-amber-500' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${settings.allow_email_preview === 'true' ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Disable Email Sending</p>
                                <p className="text-xs text-slate-500">Turn off outgoing email without removing config.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateSetting('disable_email_sending', settings.disable_email_sending === 'true' ? 'false' : 'true')}
                                className={`w-12 h-6 rounded-full transition-colors relative shadow-inner ${settings.disable_email_sending === 'true' ? 'bg-rose-500' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${settings.disable_email_sending === 'true' ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-slate-500">
                        Gmail use kar rahe ho to app password daalo. Brevo/custom SMTP me host, user, password, aur
                        from address ko provider ke verified sender ke saath match karao.
                    </p>
                </section>

                <section className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-amber-200 p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="h-5 w-1 rounded-full bg-amber-500"></span>
                            <h2 className="text-lg font-semibold text-slate-900">SMS OTP (Forgot Password)</h2>
                        </div>
                        <span
                            className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                smsStatus?.smsConfigured
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                            }`}
                        >
                            {smsStatus?.smsConfigured ? `Active - ${smsStatus.provider || 'sms'}` : 'Not configured'}
                        </span>
                    </div>

                    {saveMessage && (
                        <div
                            className={`rounded-xl border px-4 py-3 text-sm ${
                                saveMessage.type === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-rose-200 bg-rose-50 text-rose-800'
                            }`}
                        >
                            {saveMessage.text}
                        </div>
                    )}

                    <p className="text-sm text-slate-600">
                        Backend 6 digit OTP generate karta hai, DB me hashed form me save hota hai, aur expiry default
                        5 minutes hai. API keys frontend response me kabhi raw nahi dikhengi.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">SMS Provider</label>
                            <select
                                value={settings.sms_provider || 'msg91'}
                                onChange={(e) => updateSetting('sms_provider', e.target.value)}
                                className={inputClass('sms_provider')}
                            >
                                <option value="msg91">MSG91 (India)</option>
                                <option value="2factor">2Factor.in (India)</option>
                            </select>
                            {errorText('sms_provider')}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">Sender ID</label>
                            <input
                                type="text"
                                value={settings.sender_id || settings.msg91_sender_id || 'VG'}
                                onChange={(e) => {
                                    updateSetting('sender_id', e.target.value);
                                    setSettings((prev) => ({
                                        ...prev,
                                        sender_id: e.target.value,
                                        msg91_sender_id: e.target.value,
                                        otp_prefix: e.target.value,
                                    }));
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                                placeholder="VG"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">OTP Expiry (Minutes)</label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={settings.otp_expiry_minutes || '5'}
                                onChange={(e) => updateSetting('otp_expiry_minutes', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">Status</label>
                            <select
                                value={settings.sms_otp_status || 'active'}
                                onChange={(e) => updateSetting('sms_otp_status', e.target.value)}
                                className={inputClass('status')}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            {errorText('status')}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                MSG91 Template ID
                                {smsStatus?.msg91TemplateIdSet && <span className="ml-2 text-emerald-600 normal-case">(saved)</span>}
                            </label>
                            <input
                                type="text"
                                value={settings.msg91_template_id || ''}
                                onChange={(e) => updateSetting('msg91_template_id', e.target.value)}
                                className={`${inputClass('msg91_template_id')} font-mono`}
                                placeholder="MSG91 OTP template ID"
                                autoComplete="off"
                            />
                            {errorText('msg91_template_id')}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                MSG91 Auth Key
                                {smsStatus?.msg91AuthKeySet && (
                                    <span className="ml-2 text-emerald-600 normal-case">
                                        (saved {smsStatus.msg91AuthKeyMasked})
                                    </span>
                                )}
                            </label>
                            <input
                                type="password"
                                value={settings.msg91_auth_key}
                                onChange={(e) => updateSetting('msg91_auth_key', e.target.value)}
                                className={`${inputClass('msg91_auth_key')} font-mono`}
                                placeholder="Paste MSG91 auth key"
                                autoComplete="off"
                            />
                            {errorText('msg91_auth_key')}
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                2Factor.in API Key
                                {smsStatus?.twoFactorKeySet && (
                                    <span className="ml-2 text-emerald-600 normal-case">
                                        (saved {smsStatus.twoFactorKeyMasked || ''})
                                    </span>
                                )}
                            </label>
                            <input
                                type="password"
                                value={settings.two_factor_api_key}
                                onChange={(e) => updateSetting('two_factor_api_key', e.target.value)}
                                className={`${inputClass('two_factor_api_key')} font-mono`}
                                placeholder="Paste 2Factor API key"
                                autoComplete="off"
                            />
                            {errorText('two_factor_api_key')}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end border-t border-slate-100 pt-4">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">Test SMS</label>
                            <input
                                type="tel"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                className={inputClass('test_phone')}
                                placeholder="8083866879"
                            />
                            {errorText('test_phone')}
                        </div>
                        <button
                            type="button"
                            onClick={handleTestSms}
                            disabled={testingSms}
                            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                            {testingSms ? 'Sending...' : 'Send Test OTP'}
                        </button>
                    </div>

                    {testSmsMessage && (
                        <div
                            className={`rounded-xl border px-4 py-3 text-sm ${
                                testSmsMessage.type === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-rose-200 bg-rose-50 text-rose-800'
                            }`}
                        >
                            {testSmsMessage.text}
                        </div>
                    )}

                    <p className="text-xs text-slate-500">
                        Save Changes dabane ke baad Test OTP try karein. MSG91 me auth key, template ID, aur mobile
                        international format backend se use hoga.
                    </p>
                </section>
            </div>
        </div>
    );
}
