import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import {
  Building2, Users, Plus, Settings, Shield, Mail, Crown,
  UserPlus, X, ChevronRight, Loader2, Check, Trash2,
  Key, Globe, Lock, FolderOpen, ShieldCheck,
} from 'lucide-react';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { OrgVault } from '../components/OrgVault';
import RBACManagement from '../components/RBACManagement';
import PermissionGate from '../components/PermissionGate';
import { usePermissions } from '../hooks/usePermissions';
import OrgActivityLog from '../components/OrgActivityLog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ROLE_BADGES = {
  owner: { label: 'Owner', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  admin: { label: 'Admin', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  member: { label: 'Member', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

// --- Create Organization Modal ---
const CreateOrgModal = ({ onClose, onCreated, token }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleNameChange = (val) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    try {
      const res = await axios.post(`${API}/organizations/`, { name, slug, description }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Organization Created', description: `"${name}" is ready to go.` });
      onCreated(res.data);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to create', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="create-org-modal">
      <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Create Organization</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label className="text-gray-200 text-sm">Organization Name *</Label>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Acme Corp" className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="org-name-input" />
          </div>
          <div>
            <Label className="text-gray-200 text-sm">URL Slug *</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-corp" className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="org-slug-input" />
            <p className="text-gray-500 text-xs mt-1">Used in URLs: /org/{slug}</p>
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief description..." className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="org-desc-input" />
          </div>
          <Button type="submit" disabled={creating || !name.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="create-org-btn">
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Organization
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- Invite Member Modal ---
const InviteMemberModal = ({ orgId, onClose, onInvited, token }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [sending, setSending] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await axios.post(`${API}/organizations/${orgId}/invite`, { email, role }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Invite Sent', description: `Invitation sent to ${email}` });
      onInvited();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to invite', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="invite-member-modal">
      <div className="bg-[#1a2332] border border-gray-700 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Invite Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <Label className="text-gray-200 text-sm">Email Address *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" className="bg-[#0a0f1a] border-gray-700 text-white mt-1" data-testid="invite-email-input" />
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Role</Label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white mt-1" data-testid="invite-role-select">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={sending || !email.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="send-invite-btn">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Send Invitation
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- SSO Settings Panel ---
const SSOSettings = ({ orgId, myRole, token }) => {
  const [config, setConfig] = useState({ sso_enabled: false, sso_config: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sso_enabled: false,
    sso_provider: 'oidc',
    sso_issuer_url: '',
    sso_client_id: '',
    sso_client_secret: '',
    sso_metadata_url: '',
    sso_allowed_domains: '',
  });

  useEffect(() => {
    fetchSSO();
  }, [orgId]);

  const fetchSSO = async () => {
    try {
      const res = await axios.get(`${API}/organizations/${orgId}/sso`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfig(res.data);
      setForm({
        sso_enabled: res.data.sso_enabled,
        sso_provider: res.data.sso_config?.sso_provider || 'oidc',
        sso_issuer_url: res.data.sso_config?.sso_issuer_url || '',
        sso_client_id: res.data.sso_config?.sso_client_id || '',
        sso_client_secret: res.data.sso_config?.sso_client_secret || '',
        sso_metadata_url: res.data.sso_config?.sso_metadata_url || '',
        sso_allowed_domains: (res.data.sso_config?.sso_allowed_domains || []).join(', '),
      });
    } catch {
      /* ignore - no access */
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/organizations/${orgId}/sso`, {
        sso_enabled: form.sso_enabled,
        sso_provider: form.sso_provider,
        sso_issuer_url: form.sso_issuer_url,
        sso_client_id: form.sso_client_id,
        sso_client_secret: form.sso_client_secret,
        sso_metadata_url: form.sso_metadata_url,
        sso_allowed_domains: form.sso_allowed_domains.split(',').map(d => d.trim()).filter(Boolean),
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'SSO Updated', description: 'SSO configuration saved successfully.' });
      fetchSSO();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to update SSO', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-400 py-8 text-center">Loading SSO config...</div>;
  if (myRole !== 'owner') return <div className="text-gray-400 py-8 text-center">Only the organization owner can configure SSO.</div>;

  return (
    <div className="space-y-4" data-testid="sso-settings">
      <div className="flex items-center justify-between p-4 bg-[#0a0f1a] rounded-lg border border-gray-800">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-white font-medium">Single Sign-On (SSO)</p>
            <p className="text-gray-500 text-xs">Allow members to sign in with your identity provider</p>
          </div>
        </div>
        <button
          onClick={() => setForm(f => ({ ...f, sso_enabled: !f.sso_enabled }))}
          className={`w-12 h-6 rounded-full transition-colors ${form.sso_enabled ? 'bg-blue-600' : 'bg-gray-700'} relative`}
          data-testid="sso-toggle"
        >
          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${form.sso_enabled ? 'left-6' : 'left-0.5'}`} />
        </button>
      </div>

      {form.sso_enabled && (
        <div className="space-y-4 p-4 bg-[#0a0f1a] rounded-lg border border-gray-800">
          <div>
            <Label className="text-gray-200 text-sm">Provider</Label>
            <select value={form.sso_provider} onChange={(e) => setForm(f => ({ ...f, sso_provider: e.target.value }))} className="w-full bg-[#1a2332] border border-gray-700 rounded-md px-3 py-2 text-white mt-1" data-testid="sso-provider-select">
              <option value="oidc">OpenID Connect (OIDC)</option>
              <option value="saml">SAML 2.0</option>
            </select>
          </div>
          <div>
            <Label className="text-gray-200 text-sm">Issuer URL / IdP URL *</Label>
            <Input value={form.sso_issuer_url} onChange={(e) => setForm(f => ({ ...f, sso_issuer_url: e.target.value }))} placeholder="https://login.example.com" className="bg-[#1a2332] border-gray-700 text-white mt-1" data-testid="sso-issuer-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-200 text-sm">Client ID *</Label>
              <Input value={form.sso_client_id} onChange={(e) => setForm(f => ({ ...f, sso_client_id: e.target.value }))} className="bg-[#1a2332] border-gray-700 text-white mt-1" data-testid="sso-client-id-input" />
            </div>
            <div>
              <Label className="text-gray-200 text-sm">Client Secret *</Label>
              <Input type="password" value={form.sso_client_secret} onChange={(e) => setForm(f => ({ ...f, sso_client_secret: e.target.value }))} className="bg-[#1a2332] border-gray-700 text-white mt-1" data-testid="sso-client-secret-input" />
            </div>
          </div>
          {form.sso_provider === 'saml' && (
            <div>
              <Label className="text-gray-200 text-sm">Metadata URL</Label>
              <Input value={form.sso_metadata_url} onChange={(e) => setForm(f => ({ ...f, sso_metadata_url: e.target.value }))} placeholder="https://login.example.com/saml/metadata" className="bg-[#1a2332] border-gray-700 text-white mt-1" data-testid="sso-metadata-input" />
            </div>
          )}
          <div>
            <Label className="text-gray-200 text-sm">Allowed Email Domains</Label>
            <Input value={form.sso_allowed_domains} onChange={(e) => setForm(f => ({ ...f, sso_allowed_domains: e.target.value }))} placeholder="example.com, acme.com" className="bg-[#1a2332] border-gray-700 text-white mt-1" data-testid="sso-domains-input" />
            <p className="text-gray-500 text-xs mt-1">Comma-separated. Only users with these email domains can SSO.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="save-sso-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Save SSO Configuration
          </Button>
        </div>
      )}
    </div>
  );
};

// --- Member Row with Custom Role Assignment ---
const MemberRow = ({ member: m, orgId, myRole, isAdmin, token, onRemove, onRoleChange, onAssignCustomRole, roles, userPerms = [] }) => {
  const canManageRoles = userPerms.includes('members:manage_roles');
  const canRemove = userPerms.includes('members:remove');

  return (
    <div className="flex items-center justify-between p-3 bg-[#0a0f1a] rounded-lg border border-gray-800" data-testid={`member-${m.id}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
          {(m.full_name || m.email)[0].toUpperCase()}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{m.full_name || m.email}</p>
          <div className="flex items-center gap-2">
            <p className="text-gray-500 text-xs">{m.email}</p>
            {m.custom_role_id && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {roles.find(r => r.id === m.custom_role_id)?.name || 'Custom Role'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {m.role === 'owner' ? (
          <span className="flex items-center gap-1 text-xs text-amber-400"><Crown className="w-3 h-3" /> Owner</span>
        ) : canManageRoles && myRole === 'owner' ? (
          <div className="flex items-center gap-1.5">
            <select
              value={m.role}
              onChange={(e) => onRoleChange(m.id, e.target.value)}
              className="bg-[#1a2332] border border-gray-700 rounded text-xs text-gray-300 px-2 py-1"
              data-testid={`member-role-select-${m.id}`}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={m.custom_role_id || ''}
              onChange={(e) => onAssignCustomRole(m.id, e.target.value || null)}
              className="bg-[#1a2332] border border-gray-700 rounded text-xs text-gray-300 px-2 py-1"
              data-testid={`member-custom-role-select-${m.id}`}
            >
              <option value="">No custom role</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_BADGES[m.role]?.color}`}>
            {ROLE_BADGES[m.role]?.label}
          </span>
        )}
        {canRemove && m.role !== 'owner' && (
          <button onClick={() => onRemove(m.id)} className="text-red-400 hover:text-red-300 p-1" data-testid={`remove-member-${m.id}`}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Main Organization Page ---
const OrganizationPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('members');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [orgRoles, setOrgRoles] = useState([]);

  const { permissions: myPerms, source: permSource, loading: permsLoading, hasPermission, hasAny, refresh: refreshPerms } = usePermissions(selectedOrg?.id, token);

  useEffect(() => {
    if (token) fetchOrgs();
  }, [token]);

  useEffect(() => {
    if (token) fetchPendingInvites();
  }, [token]);

  const fetchOrgs = async () => {
    try {
      const res = await axios.get(`${API}/organizations/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrgs(res.data.organizations);
      if (res.data.organizations.length > 0 && !selectedOrg) {
        selectOrg(res.data.organizations[0]);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const fetchPendingInvites = async () => {
    try {
      const res = await axios.get(`${API}/organizations/my/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingInvites(res.data.invites);
    } catch { /* ignore */ }
  };

  const selectOrg = async (org) => {
    setSelectedOrg(org);
    try {
      const [membersRes, invitesRes, rolesRes] = await Promise.all([
        axios.get(`${API}/organizations/${org.id}/members`, { headers: { Authorization: `Bearer ${token}` } }),
        org.my_role === 'owner' || org.my_role === 'admin'
          ? axios.get(`${API}/organizations/${org.id}/invites`, { headers: { Authorization: `Bearer ${token}` } })
          : Promise.resolve({ data: { invites: [] } }),
        axios.get(`${API}/organizations/${org.id}/roles`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { roles: [] } })),
      ]);
      setMembers(membersRes.data.members);
      setInvites(invitesRes.data.invites);
      setOrgRoles(rolesRes.data.roles || []);
    } catch { /* ignore */ }
  };

  const handleAcceptInvite = async (inviteToken) => {
    try {
      await axios.post(`${API}/organizations/accept-invite/${inviteToken}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Joined!', description: 'You have joined the organization.' });
      fetchOrgs();
      fetchPendingInvites();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to accept', variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await axios.delete(`${API}/organizations/${selectedOrg.id}/members/${memberId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Removed', description: 'Member has been removed.' });
      selectOrg(selectedOrg);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleUpdateRole = async (memberId, newRole) => {
    try {
      await axios.put(`${API}/organizations/${selectedOrg.id}/members/${memberId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: 'Updated', description: `Role changed to ${newRole}` });
      selectOrg(selectedOrg);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      await axios.delete(`${API}/organizations/${selectedOrg.id}/invites/${inviteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Cancelled', description: 'Invite cancelled.' });
      selectOrg(selectedOrg);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleAssignCustomRole = async (memberId, roleId) => {
    try {
      if (roleId) {
        await axios.put(`${API}/organizations/${selectedOrg.id}/members/${memberId}/custom-role`,
          { role_id: roleId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.delete(`${API}/organizations/${selectedOrg.id}/members/${memberId}/custom-role`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      toast({ title: 'Updated', description: 'Custom role updated.' });
      selectOrg(selectedOrg);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const handleDeleteOrg = async () => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/organizations/${selectedOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast({ title: 'Deleted', description: 'Organization deleted.' });
      setSelectedOrg(null);
      fetchOrgs();
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed', variant: 'destructive' });
    }
  };

  const isAdmin = selectedOrg?.my_role === 'owner' || selectedOrg?.my_role === 'admin';

  const ALL_TABS = [
    { id: 'members', label: 'Members', icon: Users, permission: 'members:view' },
    { id: 'roles', label: 'Roles', icon: ShieldCheck, permission: 'members:manage_roles' },
    { id: 'activity', label: 'Activity', icon: Globe, permission: 'org:settings' },
    { id: 'vault', label: 'Vault', icon: FolderOpen, permission: 'vault:view' },
    { id: 'invites', label: 'Invites', icon: Mail, permission: 'members:invite' },
    { id: 'sso', label: 'SSO', icon: Key, permission: 'org:sso' },
    { id: 'settings', label: 'Settings', icon: Settings, permission: 'org:settings' },
  ];

  // Filter tabs based on user permissions (owners/admins see everything)
  const TABS = ALL_TABS.filter(tab => isAdmin || myPerms.includes(tab.permission));

  return (
    <div className="min-h-screen bg-[#0f1825]">
      <Navbar />
      <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="org-page-title">Organizations</h1>
              <p className="text-gray-400 text-sm mt-1">Manage your teams and enterprise settings</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="new-org-btn">
              <Plus className="w-4 h-4 mr-2" /> New Organization
            </Button>
          </div>

          {/* Pending Invites Banner */}
          {pendingInvites.length > 0 && (
            <div className="mb-6 space-y-2" data-testid="pending-invites-banner">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-200 text-sm">
                      <strong className="text-white">{inv.invited_by_name}</strong> invited you to <strong className="text-white">{inv.org_name}</strong> as {inv.role}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => handleAcceptInvite(inv.token)} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid={`accept-invite-${inv.id}`}>
                    <Check className="w-3 h-3 mr-1" /> Accept
                  </Button>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="text-center py-20 text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Org Sidebar */}
              <div className="space-y-2" data-testid="org-list">
                {orgs.length === 0 ? (
                  <Card className="bg-[#1a2332] border-gray-800">
                    <CardContent className="p-6 text-center">
                      <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No organizations yet.</p>
                      <p className="text-gray-500 text-xs mt-1">Create one to get started.</p>
                    </CardContent>
                  </Card>
                ) : orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => selectOrg(org)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedOrg?.id === org.id
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-[#1a2332] border-gray-800 hover:border-gray-700'
                    }`}
                    data-testid={`org-item-${org.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${selectedOrg?.id === org.id ? 'text-blue-400' : 'text-gray-500'}`} />
                      <span className="text-white font-medium text-sm truncate">{org.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-6">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_BADGES[org.my_role]?.color}`}>
                        {ROLE_BADGES[org.my_role]?.label}
                      </span>
                      <span className="text-gray-500 text-xs">{org.member_count} member{org.member_count !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Org Detail */}
              {selectedOrg ? (
                <div className="lg:col-span-3">
                  <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800">
                    <CardContent className="p-6">
                      {/* Org Header */}
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h2 className="text-white font-bold text-xl" data-testid="selected-org-name">{selectedOrg.name}</h2>
                          <p className="text-gray-500 text-sm">{selectedOrg.description || `/${selectedOrg.slug}`}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded border ${ROLE_BADGES[selectedOrg.my_role]?.color}`}>
                          {ROLE_BADGES[selectedOrg.my_role]?.label}
                        </span>
                      </div>

                      {/* Tabs */}
                      <div className="flex gap-1 mb-5 bg-[#0a0f1a] rounded-lg p-1" data-testid="org-tabs">
                        {TABS.map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-all ${
                              activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                            }`}
                            data-testid={`tab-${id}`}
                          >
                            <Icon className="w-3.5 h-3.5" /> {label}
                          </button>
                        ))}
                      </div>

                      {/* Members Tab */}
                      {activeTab === 'members' && (
                        <div data-testid="members-tab">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold">Members ({members.length})</h3>
                            <div className="flex items-center gap-2">
                              {permSource && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2332] text-gray-500 border border-gray-800" data-testid="perm-source-badge">
                                  {permSource}
                                </span>
                              )}
                              <PermissionGate permission="members:invite" userPermissions={myPerms} showLock>
                                <Button size="sm" onClick={() => setShowInviteModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="invite-member-btn">
                                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite
                                </Button>
                              </PermissionGate>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {members.map((m) => (
                              <MemberRow key={m.id} member={m} orgId={selectedOrg.id} myRole={selectedOrg.my_role} isAdmin={isAdmin} token={token} onRemove={handleRemoveMember} onRoleChange={handleUpdateRole} onAssignCustomRole={handleAssignCustomRole} roles={orgRoles} userPerms={myPerms} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Roles Tab */}
                      {activeTab === 'roles' && (
                        <RBACManagement orgId={selectedOrg.id} myRole={selectedOrg.my_role} token={token} />
                      )}

                      {/* Activity Tab */}
                      {activeTab === 'activity' && (
                        <OrgActivityLog orgId={selectedOrg.id} token={token} />
                      )}

                      {/* Invites Tab */}
                      {activeTab === 'invites' && (
                        <div data-testid="invites-tab">
                          <h3 className="text-white font-semibold mb-4">Pending Invites ({invites.length})</h3>
                          {invites.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-8">No pending invites.</p>
                          ) : (
                            <div className="space-y-2">
                              {invites.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between p-3 bg-[#0a0f1a] rounded-lg border border-gray-800">
                                  <div>
                                    <p className="text-white text-sm">{inv.email}</p>
                                    <p className="text-gray-500 text-xs">Role: {inv.role} &bull; Invited by {inv.invited_by_name}</p>
                                  </div>
                                  <PermissionGate permission="members:invite" userPermissions={myPerms}>
                                    <button onClick={() => handleCancelInvite(inv.id)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                                      <X className="w-3 h-3" /> Cancel
                                    </button>
                                  </PermissionGate>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SSO Tab */}
                      {activeTab === 'sso' && (
                        <SSOSettings orgId={selectedOrg.id} myRole={selectedOrg.my_role} token={token} />
                      )}

                      {/* Vault Tab */}
                      {activeTab === 'vault' && (
                        <OrgVault orgId={selectedOrg.id} myRole={selectedOrg.my_role} token={token} userPerms={myPerms} />
                      )}

                      {/* Settings Tab */}
                      {activeTab === 'settings' && (
                        <div data-testid="settings-tab">
                          <h3 className="text-white font-semibold mb-4">Organization Settings</h3>
                          <div className="space-y-4">
                            <div className="p-4 bg-[#0a0f1a] rounded-lg border border-gray-800">
                              <p className="text-gray-400 text-sm mb-1">Organization ID</p>
                              <p className="text-white text-sm font-mono">{selectedOrg.id}</p>
                            </div>
                            <div className="p-4 bg-[#0a0f1a] rounded-lg border border-gray-800">
                              <p className="text-gray-400 text-sm mb-1">URL Slug</p>
                              <p className="text-white text-sm font-mono">/{selectedOrg.slug}</p>
                            </div>
                            <div className="p-4 bg-[#0a0f1a] rounded-lg border border-gray-800">
                              <p className="text-gray-400 text-sm mb-1">Created</p>
                              <p className="text-white text-sm">{new Date(selectedOrg.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="p-4 bg-[#0a0f1a] rounded-lg border border-gray-800">
                              <p className="text-gray-400 text-sm mb-1">Plan</p>
                              <p className="text-white text-sm capitalize">{selectedOrg.plan}</p>
                            </div>
                            <div className="p-4 bg-[#0a0f1a] rounded-lg border border-gray-800">
                              <p className="text-gray-400 text-sm mb-1">Your Permissions</p>
                              <p className="text-white text-sm">{myPerms.length} permissions via <span className="text-blue-400">{permSource}</span></p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {myPerms.slice(0, 8).map(p => (
                                  <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{p}</span>
                                ))}
                                {myPerms.length > 8 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">+{myPerms.length - 8} more</span>}
                              </div>
                            </div>
                            <PermissionGate permission="org:settings" userPermissions={myPerms}>
                              {selectedOrg.my_role === 'owner' && (
                                <div className="pt-4 border-t border-gray-800">
                                  <Button onClick={handleDeleteOrg} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10" data-testid="delete-org-btn">
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Organization
                                  </Button>
                                </div>
                              )}
                            </PermissionGate>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="lg:col-span-3 flex items-center justify-center">
                  <div className="text-center py-20">
                    <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Select an organization or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />

      {showCreateModal && (
        <CreateOrgModal
          token={token}
          onClose={() => setShowCreateModal(false)}
          onCreated={(org) => { setShowCreateModal(false); fetchOrgs(); }}
        />
      )}
      {showInviteModal && selectedOrg && (
        <InviteMemberModal
          orgId={selectedOrg.id}
          token={token}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { setShowInviteModal(false); selectOrg(selectedOrg); }}
        />
      )}
    </div>
  );
};

export default OrganizationPage;
