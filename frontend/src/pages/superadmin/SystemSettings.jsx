import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { getEmployee, normalizeRole } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function SystemSettings() {
    const navigate = useNavigate();
    const employee = useMemo(() => getEmployee(), []);
    const [settings, setSettings] = useState({
        site_name: 'MARCOM STREET CRM',
        maintenance_mode: 'false',
        allow_registration: 'true',
        smtp_host: 'smtp.marcomstreet.com',
        storage_limit_default: '5',
        primary_color: '#4f46e5',
        sms_provider: 'msg91',
        msg91_sender_id: 'VG',
        otp_prefix: 'VG',
        msg91_auth_key: '',
        two_factor_api_key: '',
        fast2sms_api_key: '',
    });
    const [smsStatus, setSmsStatus] = useState(null);
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
                setSettings((prev) => ({
                    ...prev,
                    site_name: data.site_name ?? prev.site_name,
                    maintenance_mode: data.maintenance_mode ?? prev.maintenance_mode,
                    allow_registration: data.allow_registration ?? prev.allow_registration,
                    smtp_host: data.smtp_host ?? prev.smtp_host,
                    storage_limit_default: data.storage_limit_default ?? prev.storage_limit_default,
                    primary_color: data.primary_color ?? prev.primary_color,
                    sms_provider: data.sms_provider ?? prev.sms_provider,
                    msg91_sender_id: data.msg91_sender_id ?? prev.msg91_sender_id,
                    otp_prefix: data.otp_prefix ?? prev.otp_prefix,
                    msg91_auth_key: '',
                    two_factor_api_key: '',
                    fast2sms_api_key: '',
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
            const payload = { ...settings };
            if (!String(payload.msg91_auth_key || '').trim()) delete payload.msg91_auth_key;
            if (!String(payload.two_factor_api_key || '').trim()) delete payload.two_factor_api_key;
            if (!String(payload.fast2sms_api_key || '').trim()) delete payload.fast2sms_api_key;
            const res = await api.post('/superadmin/settings', payload);
            if (res.data?.success) {
                if (res.data.data?.sms_status) setSmsStatus(res.data.data.sms_status);
                alert(res.data.message || 'Settings saved successfully!');
                setSettings((prev) => ({ ...prev, msg91_auth_key: '', two_factor_api_key: '', fast2sms_api_key: '' }));
                fetchSettings();
            }
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTestSms = async () => {
        if (!testPhone.trim()) {
            alert('Test ke liye mobile number daalein');
            return;
        }
        try {
            setTestingSms(true);
            const res = await api.post('/superadmin/settings/test-sms', { phone: testPhone.trim() });
            alert(res.data?.message || 'Test SMS sent');
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        } finally {
            setTestingSms(false);
        }
    };

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
                {/* Branding & Preview */}
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
                                onChange={e => setSettings({ ...settings, site_name: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em]">Primary Accent</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={settings.primary_color}
                                    onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                                    className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-0"
                                />
                                <input
                                    type="text"
                                    value={settings.primary_color}
                                    onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
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
                            <span
                                className="h-10 w-10 rounded-xl shadow-inner"
                                style={{ background: settings.primary_color }}
                            ></span>
                        </div>
                    </div>
                </section>

                {/* Access & Infra */}
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
                                onClick={() => setSettings({ ...settings, maintenance_mode: settings.maintenance_mode === 'true' ? 'false' : 'true' })}
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
                                onClick={() => setSettings({ ...settings, allow_registration: settings.allow_registration === 'true' ? 'false' : 'true' })}
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
                                onChange={e => setSettings({ ...settings, smtp_host: e.target.value })}
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
                                onChange={e => setSettings({ ...settings, storage_limit_default: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                    </div>
                </section>

                {/* SMS OTP — Forgot Password */}
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
                            {smsStatus?.smsConfigured
                                ? `Active — ${smsStatus.provider || 'sms'}`
                                : 'Not configured'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600">
                        OTP format: <strong>VG</strong> + 6 digits (e.g. VG123456). User ko sirf phone par SMS
                        jayega; verify ke baad hi password reset khulega.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                SMS Provider
                            </label>
                            <select
                                value={settings.sms_provider || 'msg91'}
                                onChange={(e) => setSettings({ ...settings, sms_provider: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                            >
                                <option value="msg91">MSG91 (India)</option>
                                <option value="2factor">2Factor.in (India)</option>
                                <option value="fast2sms">Fast2SMS</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                Sender ID
                            </label>
                            <input
                                type="text"
                                value={settings.msg91_sender_id || 'VG'}
                                onChange={(e) =>
                                    setSettings({ ...settings, msg91_sender_id: e.target.value, otp_prefix: e.target.value })
                                }
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase"
                                placeholder="VG"
                            />
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
                                onChange={(e) => setSettings({ ...settings, msg91_auth_key: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono"
                                placeholder="Paste MSG91 auth key from msg91.com → API"
                                autoComplete="off"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                2Factor.in API Key (alternative)
                                {smsStatus?.twoFactorKeySet && (
                                    <span className="ml-2 text-emerald-600 normal-case">(saved)</span>
                                )}
                            </label>
                            <input
                                type="password"
                                value={settings.two_factor_api_key}
                                onChange={(e) => setSettings({ ...settings, two_factor_api_key: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono"
                                placeholder="Optional — 2factor.in API key"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end border-t border-slate-100 pt-4">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] block mb-2">
                                Test SMS
                            </label>
                            <input
                                type="tel"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                                placeholder="8083866879"
                            />
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
                    <p className="text-xs text-slate-500">
                        Save Changes dabane ke baad Test OTP try karein. CLI:{' '}
                        <code className="bg-slate-100 px-1 rounded">npm run configure:sms -- --msg91=KEY</code>
                    </p>
                </section>
            </div>
        </div>
    );
}
