import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Shield, Plus, Pencil, Trash2, X, Loader2, Check,
  ChevronDown, ChevronUp, Users, Lock, Eye,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_ICONS = {
  Documents: '📄',
  Vault: '🗄️',
  Members: '👥',
  Templates: '📋',
  Approvals: '✅',
  Notarization: '🔏',
  Organization: '🏢',
};

const RBACManagement = ({ orgId, myRole, token }) => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);

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

  if (loading) return <div className="text-gray-400 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div data-testid="rbac-management">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> Access Roles ({roles.length})
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">Define custom roles with granular permissions</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="create-role-btn">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Role
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {roles.map((role) => (
          <div key={role.id} className="bg-[#0a0f1a] rounded-lg border border-gray-800 overflow-hidden" data-testid={`role-${role.id}`}>
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#111827] transition-colors"
              onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role.is_system ? 'bg-blue-500/15' : 'bg-emerald-500/15'}`}>
                  {role.is_system ? <Lock className="w-4 h-4 text-blue-400" /> : <Shield className="w-4 h-4 text-emerald-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{role.name}</span>
                    {role.is_system && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">SYSTEM</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs">{role.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs flex items-center gap-1">
                  <Users className="w-3 h-3" /> {role.member_count || 0}
                </span>
                <span className="text-gray-500 text-xs">{role.permissions?.length || 0} perms</span>
                {expandedRole === role.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </div>

            {expandedRole === role.id && (
              <div className="border-t border-gray-800 p-3">
                <div className="mb-3">
                  <p className="text-gray-400 text-xs font-medium mb-2">PERMISSIONS</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(role.permissions || []).map((perm) => {
                      const permDef = permissions.find(p => p.key === perm);
                      return (
                        <span key={perm} className="text-[11px] px-2 py-0.5 rounded-full bg-[#1a2332] text-gray-300 border border-gray-700">
                          {permDef?.label || perm}
                        </span>
                      );
                    })}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <span className="text-gray-600 text-xs">No permissions assigned</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2 pt-2 border-t border-gray-800">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditingRole(role); }} className="border-gray-700 text-gray-300 hover:text-white text-xs" data-testid={`edit-role-${role.id}`}>
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

      {showCreateModal && (
        <RoleEditor
          orgId={orgId}
          token={token}
          permissions={permissions}
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); fetchData(); }}
        />
      )}
      {editingRole && (
        <RoleEditor
          orgId={orgId}
          token={token}
          role={editingRole}
          permissions={permissions}
          categories={categories}
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
      <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">{isEdit ? 'Edit Role' : 'Create Role'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-200 text-sm">Role Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Compliance Officer" className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="role-name-input" />
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role can do..." className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="role-desc-input" />
          </div>

          <div>
            <Label className="text-gray-200 text-sm mb-2 block">Permissions ({selected.size} selected)</Label>
            <div className="space-y-3">
              {Object.entries(categories).map(([cat, perms]) => {
                const catPerms = perms.map(p => p.key);
                const allChecked = catPerms.every(k => selected.has(k));
                const someChecked = catPerms.some(k => selected.has(k));
                return (
                  <div key={cat} className="bg-[#0a0f1a] rounded-lg border border-gray-800 p-3">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={() => toggleCategory(cat)}
                        className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-white text-sm font-medium">{CATEGORY_ICONS[cat] || '📁'} {cat}</span>
                    </label>
                    <div className="ml-6 grid grid-cols-2 gap-1">
                      {perms.map(p => (
                        <label key={p.key} className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-200 py-0.5">
                          <input
                            type="checkbox"
                            checked={selected.has(p.key)}
                            onChange={() => togglePerm(p.key)}
                            className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 w-3 h-3"
                          />
                          {p.label}
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
