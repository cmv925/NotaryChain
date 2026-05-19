import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Shield, Plus, Pencil, Trash2, X, Loader2, Check,
  ChevronDown, ChevronUp, Users, Lock, Eye, ToggleLeft, ToggleRight,
  Grid3X3, List, FileText, FolderLock, UserPlus, ClipboardCheck, Stamp, Building2,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_ICONS = {
  Documents: FileText,
  Vault: FolderLock,
  Members: UserPlus,
  Templates: ClipboardCheck,
  Approvals: Check,
  Notarization: Stamp,
  Organization: Building2,
};

const CATEGORY_COLORS = {
  Documents: 'blue',
  Vault: 'purple',
  Members: 'cyan',
  Templates: 'amber',
  Approvals: 'emerald',
  Notarization: 'rose',
  Organization: 'orange',
};

const RBACManagement = ({ orgId, myRole, token }) => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [previewRole, setPreviewRole] = useState(null);

  const canManage = myRole === 'owner' || myRole === 'admin';

  const fetchData = useCallback(async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        axios.get(`${API}/organizations/${orgId}/roles`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/organizations/${orgId}/permissions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setRoles(rolesRes.data.roles);
      setPermissions(permsRes.data.permissions);
      setCategories(permsRes.data.categories);
    } catch {
      toast({ title: 'Error', description: 'Failed to load roles', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (roleId, roleName) => {
    if (!window.confirm(`Delete role "${roleName}"? Members with this role will lose their custom permissions.`)) return;
    try {
      await axios.delete(`${API}/organizations/${orgId}/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Deleted', description: `Role "${roleName}" deleted.` });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const togglePermission = async (role, permKey) => {
    if (role.is_system || !canManage) return;
    const hasIt = role.permissions?.includes(permKey);
    const updated = hasIt
      ? role.permissions.filter(p => p !== permKey)
      : [...(role.permissions || []), permKey];
    try {
      await axios.put(`${API}/organizations/${orgId}/roles/${role.id}`, {
        name: role.name,
        description: role.description,
        permissions: updated,
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to update', variant: 'destructive' });
    }
  };

  if (loading) return <div className="text-slate-500 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const customRoles = roles.filter(r => !r.is_system);
  const allRoles = roles;

  return (
    <div data-testid="rbac-management">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> Access Roles ({roles.length})
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">Define custom roles with granular permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-cream-100 rounded-lg border border-slate-200 p-0.5">
            <button onClick={() => setViewMode('grid')} className={`px-2.5 py-1 rounded text-xs transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-500'}`} data-testid="rbac-grid-view">
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('list')} className={`px-2.5 py-1 rounded text-xs transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-500'}`} data-testid="rbac-list-view">
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setShowCreateModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="create-role-btn">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Role
            </Button>
          )}
        </div>
      </div>

      {/* Grid View — Visual Permission Matrix */}
      {viewMode === 'grid' && allRoles.length > 0 && (
        <div className="bg-cream-100 rounded-xl border border-slate-200 overflow-x-auto mb-4" data-testid="rbac-permission-grid">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs sticky left-0 bg-cream-100 min-w-[180px]">Permission</th>
                {allRoles.map(role => (
                  <th key={role.id} className="px-3 py-3 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-white text-xs font-medium">{role.name}</span>
                      {role.is_system && <span className="text-[9px] px-1.5 py-0 rounded bg-blue-500/15 text-blue-400">SYS</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(categories).map(([cat, perms]) => {
                const CatIcon = CATEGORY_ICONS[cat] || Shield;
                const color = CATEGORY_COLORS[cat] || 'gray';
                return (
                  <React.Fragment key={cat}>
                    <tr className="border-b border-slate-200/50">
                      <td className={`px-4 py-2 sticky left-0 bg-cream-100`} colSpan={1 + allRoles.length}>
                        <span className={`flex items-center gap-2 text-${color}-400 text-xs font-bold uppercase tracking-wider`}>
                          <CatIcon className="w-3.5 h-3.5" /> {cat}
                        </span>
                      </td>
                    </tr>
                    {perms.map(perm => (
                      <tr key={perm.key} className="border-b border-slate-200/30 hover:bg-cream-100/50 transition-colors">
                        <td className="px-4 py-2 text-slate-500 text-xs sticky left-0 bg-cream-100">{perm.label}</td>
                        {allRoles.map(role => {
                          const has = role.permissions?.includes(perm.key);
                          const clickable = !role.is_system && canManage;
                          return (
                            <td key={role.id} className="px-3 py-2 text-center">
                              <button
                                onClick={() => clickable && togglePermission(role, perm.key)}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                                  has
                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                    : 'bg-gray-800/30 text-slate-700 hover:bg-gray-800/50'
                                } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                                data-testid={`perm-toggle-${role.id}-${perm.key}`}
                              >
                                {has ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* List View — Role Cards */}
      {viewMode === 'list' && (
        <div className="space-y-2 mb-4">
          {roles.map((role) => (
            <div key={role.id} className="bg-cream-100 rounded-lg border border-slate-200 overflow-hidden" data-testid={`role-${role.id}`}>
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-cream-100 transition-colors"
                onClick={() => setPreviewRole(previewRole === role.id ? null : role.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role.is_system ? 'bg-blue-500/15' : 'bg-emerald-500/15'}`}>
                    {role.is_system ? <Lock className="w-4 h-4 text-blue-400" /> : <Shield className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{role.name}</span>
                      {role.is_system && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">SYSTEM</span>}
                    </div>
                    <p className="text-slate-500 text-xs">{role.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-xs flex items-center gap-1"><Users className="w-3 h-3" /> {role.member_count || 0}</span>
                  <span className="text-slate-500 text-xs">{role.permissions?.length || 0} perms</span>
                  {previewRole === role.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </div>

              {previewRole === role.id && (
                <div className="border-t border-slate-200 p-4" data-testid={`role-preview-${role.id}`}>
                  {/* Effective Permissions Preview */}
                  <p className="text-slate-500 text-xs font-medium mb-3">EFFECTIVE PERMISSIONS</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {Object.entries(categories).map(([cat, perms]) => {
                      const CatIcon = CATEGORY_ICONS[cat] || Shield;
                      const color = CATEGORY_COLORS[cat] || 'gray';
                      const catPerms = perms.map(p => p.key);
                      const granted = catPerms.filter(k => role.permissions?.includes(k));
                      return (
                        <div key={cat} className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-${color}-400 text-xs font-medium flex items-center gap-1.5`}>
                              <CatIcon className="w-3.5 h-3.5" /> {cat}
                            </span>
                            <span className={`text-xs ${granted.length === catPerms.length ? 'text-emerald-400' : granted.length > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>
                              {granted.length}/{catPerms.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {perms.map(p => (
                              <span key={p.key} className={`text-[10px] px-1.5 py-0.5 rounded ${role.permissions?.includes(p.key) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800/50 text-slate-600 border border-slate-200/50'}`}>
                                {p.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {canManage && (
                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingRole(role); }} className="border-slate-200 text-slate-500 hover:text-white text-xs" data-testid={`edit-role-${role.id}`}>
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      {!role.is_system && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDelete(role.id, role.name); }} className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs" data-testid={`delete-role-${role.id}`}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <RoleEditor
          orgId={orgId} token={token} permissions={permissions} categories={categories}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); fetchData(); }}
        />
      )}
      {editingRole && (
        <RoleEditor
          orgId={orgId} token={token} role={editingRole} permissions={permissions} categories={categories}
          onClose={() => setEditingRole(null)}
          onSaved={() => { setEditingRole(null); fetchData(); }}
        />
      )}
    </div>
  );
};


const RoleEditor = ({ orgId, token, role, permissions, categories, onClose, onSaved }) => {
  const isEdit = !!role;
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selected, setSelected] = useState(new Set(role?.permissions || []));
  const [saving, setSaving] = useState(false);

  const togglePerm = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCategory = (cat) => {
    const catPerms = categories[cat]?.map(p => p.key) || [];
    const allSelected = catPerms.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      catPerms.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), description, permissions: Array.from(selected) };
      if (isEdit) {
        await axios.put(`${API}/organizations/${orgId}/roles/${role.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast({ title: 'Updated', description: `Role "${name}" updated.` });
      } else {
        await axios.post(`${API}/organizations/${orgId}/roles`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast({ title: 'Created', description: `Role "${name}" created.` });
      }
      onSaved();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="role-editor-modal">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">{isEdit ? 'Edit Role' : 'Create Custom Role'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-slate-500 text-sm">Role Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Compliance Officer" className="bg-cream-100 border-slate-200 text-white mt-1" data-testid="role-name-input" />
          </div>
          <div>
            <Label className="text-slate-500 text-sm">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role can do..." className="bg-cream-100 border-slate-200 text-white mt-1" data-testid="role-desc-input" />
          </div>

          {/* Permission summary bar */}
          <div className="bg-cream-100 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs">{selected.size} of {permissions.length} permissions selected</span>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(permissions.map(p => p.key)))} className="text-[10px] text-blue-400 hover:text-blue-300">Select All</button>
                <button onClick={() => setSelected(new Set())} className="text-[10px] text-slate-500 hover:text-slate-500">Clear All</button>
              </div>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(selected.size / Math.max(permissions.length, 1)) * 100}%` }} />
            </div>
          </div>

          <div>
            <Label className="text-slate-500 text-sm mb-2 block">Permissions</Label>
            <div className="space-y-3">
              {Object.entries(categories).map(([cat, perms]) => {
                const CatIcon = CATEGORY_ICONS[cat] || Shield;
                const color = CATEGORY_COLORS[cat] || 'gray';
                const catPerms = perms.map(p => p.key);
                const allChecked = catPerms.every(k => selected.has(k));
                const someChecked = catPerms.some(k => selected.has(k));
                const count = catPerms.filter(k => selected.has(k)).length;
                return (
                  <div key={cat} className="bg-cream-100 rounded-lg border border-slate-200 overflow-hidden">
                    <div className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-cream-100/50 border-b border-slate-200/50`} onClick={() => toggleCategory(cat)}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={() => toggleCategory(cat)}
                          className="rounded border-slate-200 text-emerald-500 focus:ring-emerald-500"
                        />
                        <CatIcon className={`w-3.5 h-3.5 text-${color}-400`} />
                        <span className="text-white text-sm font-medium">{cat}</span>
                      </label>
                      <span className="text-slate-500 text-xs">{count}/{catPerms.length}</span>
                    </div>
                    <div className="px-3 py-2 grid grid-cols-2 gap-1">
                      {perms.map(p => (
                        <label key={p.key} className="flex items-center gap-1.5 cursor-pointer text-xs py-1 px-1 rounded hover:bg-cream-100/30 transition-colors">
                          <input
                            type="checkbox"
                            checked={selected.has(p.key)}
                            onChange={() => togglePerm(p.key)}
                            className="rounded border-slate-200 text-emerald-500 focus:ring-emerald-500 w-3 h-3"
                          />
                          <span className={selected.has(p.key) ? 'text-slate-500' : 'text-slate-500'}>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="save-role-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {isEdit ? 'Update Role' : 'Create Role'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RBACManagement;
