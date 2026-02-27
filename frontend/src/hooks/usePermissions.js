import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Cache permissions per org to avoid refetching on every render
const permCache = {};

export function usePermissions(orgId, token) {
  const [permissions, setPermissions] = useState([]);
  const [source, setSource] = useState('');
  const [baseRole, setBaseRole] = useState('');
  const [customRole, setCustomRole] = useState(null);
  const [loading, setLoading] = useState(!!orgId);
  const fetchedRef = useRef('');

  const fetchPermissions = useCallback(async () => {
    if (!orgId || !token) { setLoading(false); return; }
    const cacheKey = `${orgId}:${token.slice(-8)}`;
    if (permCache[cacheKey]) {
      const c = permCache[cacheKey];
      setPermissions(c.permissions);
      setSource(c.source);
      setBaseRole(c.base_role);
      setCustomRole(c.custom_role);
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API}/organizations/${orgId}/my-permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = res.data;
      permCache[cacheKey] = d;
      setPermissions(d.permissions || []);
      setSource(d.source || '');
      setBaseRole(d.base_role || '');
      setCustomRole(d.custom_role || null);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, token]);

  useEffect(() => {
    const key = `${orgId}:${token?.slice(-8)}`;
    if (fetchedRef.current === key) return;
    fetchedRef.current = key;
    setLoading(true);
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((perm) => permissions.includes(perm), [permissions]);
  const hasAny = useCallback((perms) => perms.some(p => permissions.includes(p)), [permissions]);
  const hasAll = useCallback((perms) => perms.every(p => permissions.includes(p)), [permissions]);

  const refresh = useCallback(() => {
    const cacheKey = `${orgId}:${token?.slice(-8)}`;
    delete permCache[cacheKey];
    fetchedRef.current = '';
    setLoading(true);
    fetchPermissions();
  }, [orgId, token, fetchPermissions]);

  return { permissions, source, baseRole, customRole, loading, hasPermission, hasAny, hasAll, refresh };
}

// Utility to clear cache (e.g. on logout)
export function clearPermissionCache() {
  Object.keys(permCache).forEach(k => delete permCache[k]);
}
