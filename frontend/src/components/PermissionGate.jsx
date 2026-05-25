import React from 'react';
import { Lock } from 'lucide-react';

/**
 * PermissionGate - Conditionally renders children based on RBAC permissions.
 *
 * Props:
 *   permission  - single permission string to check (e.g. "members:invite")
 *   permissions - array of permissions; renders if user has ANY of them
 *   allOf       - array of permissions; renders if user has ALL of them
 *   userPermissions - array of the user's current permissions (from usePermissions hook)
 *   fallback    - optional React node to render when access is denied (null = hidden)
 *   showLock    - if true, shows a subtle lock indicator when access denied (default: false)
 *   children    - content to render when permission check passes
 */
const PermissionGate = ({
  permission,
  permissions,
  allOf,
  userPermissions = [],
  fallback = null,
  showLock = false,
  children,
}) => {
  let allowed = false;

  if (permission) {
    allowed = userPermissions.includes(permission);
  } else if (permissions) {
    allowed = permissions.some(p => userPermissions.includes(p));
  } else if (allOf) {
    allowed = allOf.every(p => userPermissions.includes(p));
  } else {
    allowed = true; // no permission specified = always render
  }

  if (allowed) return <>{children}</>;

  if (showLock) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-navy-800/50 border border-slate-200/50 text-slate-600 text-xs cursor-not-allowed"
        title="You don't have permission for this action"
        data-testid="permission-locked"
      >
        <Lock className="w-3 h-3" />
        <span>Restricted</span>
      </div>
    );
  }

  return fallback;
};

export default PermissionGate;
