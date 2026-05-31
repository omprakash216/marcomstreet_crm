import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function CrmControl() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [sourceName, setSourceName] = useState('');
  const [stageForm, setStageForm] = useState({ pipeline_id: '', name: '', position: 0 });

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [ov, pl, st, so] = await Promise.all([
        api.get('/superadmin/crm/overview'),
        api.get('/superadmin/crm/pipelines'),
        api.get('/superadmin/crm/stages'),
        api.get('/superadmin/crm/sources'),
      ]);
      if (ov.data?.success) setOverview(ov.data.data);
      if (pl.data?.success) setPipelines(pl.data.data);
      if (st.data?.success) setStages(st.data.data);
      if (so.data?.success) setSources(so.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addPipeline = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post('/superadmin/crm/pipelines', form);
    setForm({ name: '', description: '' });
    loadAll();
  };

  const addStage = async (e) => {
    e.preventDefault();
    if (!stageForm.pipeline_id || !stageForm.name.trim()) return;
    await api.post('/superadmin/crm/stages', stageForm);
    setStageForm({ pipeline_id: '', name: '', position: 0 });
    loadAll();
  };

  const addSource = async (e) => {
    e.preventDefault();
    if (!sourceName.trim()) return;
    await api.post('/superadmin/crm/sources', { name: sourceName });
    setSourceName('');
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-5">
        <h1 className="text-3xl font-semibold text-slate-900">Global CRM Control</h1>
        <p className="text-slate-500 text-sm">Manage pipelines, stages, and lead sources globally.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm">{error}</div>}

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            ['Leads', overview.total_leads],
            ['Deals', overview.total_deals],
            ['Won', overview.won_deals],
            ['Conversion', `${overview.conversion_rate}%`],
            ['Pipelines', overview.pipelines],
            ['Sources', overview.sources],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Pipelines</h3>
          </div>
          <form onSubmit={addPipeline} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Pipeline name"
              className="col-span-1 sm:col-span-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
              className="col-span-1 sm:col-span-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">
              Add Pipeline
            </button>
          </form>
          <div className="divide-y divide-slate-100">
            {pipelines.map((p) => (
              <div key={p.id} className="py-3">
                <div className="font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500">{p.description || '—'}</div>
              </div>
            ))}
            {pipelines.length === 0 && <div className="text-sm text-slate-500 py-4">No pipelines yet.</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Lead Sources</h3>
          </div>
          <form onSubmit={addSource} className="flex gap-3">
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Source name"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              required
            />
            <button type="submit" className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">
              Add Source
            </button>
          </form>
          <div className="divide-y divide-slate-100">
            {sources.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.active ? 'Active' : 'Inactive'}</div>
                </div>
              </div>
            ))}
            {sources.length === 0 && <div className="text-sm text-slate-500 py-4">No sources.</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Stages</h3>
        </div>
        <form onSubmit={addStage} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={stageForm.pipeline_id}
            onChange={(e) => setStageForm({ ...stageForm, pipeline_id: e.target.value })}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            required
          >
            <option value="">Select pipeline</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={stageForm.name}
            onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
            placeholder="Stage name"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            required
          />
          <input
            type="number"
            value={stageForm.position}
            onChange={(e) => setStageForm({ ...stageForm, position: Number(e.target.value) })}
            placeholder="Position"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-slate-800">
            Add Stage
          </button>
        </form>
        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-semibold tracking-[0.12em]">
              <tr>
                <th className="px-4 py-2">Pipeline</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stages.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm font-semibold text-slate-900">{s.pipeline_name || `#${s.pipeline_id}`}</td>
                  <td className="px-4 py-2 text-sm text-slate-700">{s.name}</td>
                  <td className="px-4 py-2 text-sm text-slate-500">{s.position}</td>
                </tr>
              ))}
              {stages.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-4 py-4 text-sm text-slate-500 text-center">No stages.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
