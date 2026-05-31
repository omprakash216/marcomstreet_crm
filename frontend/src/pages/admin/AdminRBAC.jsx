import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';

export default function AdminRBAC() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [rolePermissions, setRolePermissions] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPermission, setNewPermission] = useState({ module: '', action: '', label: '' });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [rolesRes, permsRes] = await Promise.all([
          api.get('/admin/rbac/roles'),
          api.get('/admin/rbac/permissions'),
        ]);
        if (!mounted) return;
        const roleRows = rolesRes.data?.data || [];
        setRoles(roleRows);
        setPermissions(permsRes.data?.data || []);
        if (roleRows[0]) {
          setSelectedRole(roleRows[0].role_key);
        }
      } catch (err) {
        console.error('RBAC load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    api
      .get(`/admin/rbac/role-permissions?role_key=${encodeURIComponent(selectedRole)}`)
      .then((res) => {
        const rows = res.data?.data || [];
        setRolePermissions(new Set(rows.map((r) => r.id)));
      })
      .catch(() => setRolePermissions(new Set()));
  }, [selectedRole]);

  const groupedPermissions = useMemo(() => {
    const groups = {};
    permissions.forEach((p) => {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    });
    return groups;
  }, [permissions]);

  const togglePermission = (permId) => {
    setRolePermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/rbac/role-permissions', {
        role_key: selectedRole,
        permission_ids: Array.from(rolePermissions),
      });
      alert('Permissions updated');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    if (!newPermission.module || !newPermission.action) return;
    try {
      const response = await api.post('/admin/rbac/permissions', newPermission);
      if (response.data?.success) {
        const refreshed = await api.get('/admin/rbac/permissions');
        setPermissions(refreshed.data?.data || []);
        setNewPermission({ module: '', action: '', label: '' });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create permission');
    }
  };

  const handleDeletePermission = async (permId) => {
    if (!window.confirm('Delete this permission?')) return;
    try {
      await api.delete(`/admin/rbac/permissions/${permId}`);
      const refreshed = await api.get('/admin/rbac/permissions');
      setPermissions(refreshed.data?.data || []);
      setRolePermissions((prev) => {
        const next = new Set(prev);
        next.delete(permId);
        return next;
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete permission');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading RBAC settings...</p>
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
            <i className="fas fa-user-shield text-2xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Roles & Permissions</h1>
            <p className="text-slate-300 text-sm">Control module access, pages, and features</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Roles</p>
          <div className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.role_key)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${selectedRole === role.role_key
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-50 text-gray-700 hover:bg-blue-50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span>{role.label}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-70">{role.role_key}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</p>
                <p className="text-sm text-gray-600">Assign permissions for: <span className="font-semibold text-gray-900">{selectedRole}</span></p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>

            <div className="space-y-5">
              {Object.keys(groupedPermissions).length === 0 && (
                <p className="text-sm text-gray-500">No permissions configured yet.</p>
              )}
              {Object.entries(groupedPermissions).map(([module, perms]) => (
                <div key={module} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{module}</h3>
                    <span className="text-[10px] text-gray-400">{perms.length} permissions</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {perms.map((perm) => (
                      <label key={perm.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-blue-50 transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{perm.label || `${perm.module}.${perm.action}`}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{perm.action}</p>
                        </div>
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 rounded border-gray-300"
                          checked={rolePermissions.has(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Create Permission</p>
            <form onSubmit={handleCreatePermission} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                value={newPermission.module}
                onChange={(e) => setNewPermission((prev) => ({ ...prev, module: e.target.value }))}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                placeholder="module"
                required
              />
              <input
                type="text"
                value={newPermission.action}
                onChange={(e) => setNewPermission((prev) => ({ ...prev, action: e.target.value }))}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                placeholder="action"
                required
              />
              <input
                type="text"
                value={newPermission.label}
                onChange={(e) => setNewPermission((prev) => ({ ...prev, label: e.target.value }))}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                placeholder="Label (optional)"
              />
              <button type="submit" className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold shadow hover:bg-emerald-700">
                Add
              </button>
            </form>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissions.map((perm) => (
                <div key={perm.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{perm.label || `${perm.module}.${perm.action}`}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{perm.module}.{perm.action}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePermission(perm.id)}
                    className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                    title="Delete permission"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
