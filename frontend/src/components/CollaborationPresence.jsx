import React from 'react';
import { Users, Eye, Edit3 } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500',
];

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function getColor(userId) {
  let hash = 0;
  for (let i = 0; i < (userId || '').length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Presence bar showing who is currently viewing/editing a draft.
 */
export function PresenceBar({ users, connected, currentUserId }) {
  const otherUsers = users.filter(u => u.user_id !== currentUserId);

  return (
    <div
      className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0d1520] border border-gray-800"
      data-testid="presence-bar"
    >
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-500'}`} />
        <span className="text-xs text-gray-400">
          {connected ? 'Live' : 'Connecting...'}
        </span>
      </div>

      {otherUsers.length > 0 && (
        <>
          <div className="w-px h-4 bg-gray-700" />
          <Users className="w-3.5 h-3.5 text-gray-500" />
          <div className="flex -space-x-2">
            {otherUsers.slice(0, 5).map((user) => (
              <div
                key={user.user_id}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#0d1520] ${getColor(user.user_id)}`}
                title={`${user.name} (${user.email})`}
                data-testid={`presence-avatar-${user.user_id}`}
              >
                {getInitials(user.name)}
              </div>
            ))}
            {otherUsers.length > 5 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-300 border-2 border-[#0d1520] bg-gray-700">
                +{otherUsers.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {otherUsers.length} other{otherUsers.length > 1 ? 's' : ''} here
          </span>
        </>
      )}

      {otherUsers.length === 0 && connected && (
        <>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xs text-gray-600">Only you here</span>
        </>
      )}
    </div>
  );
}

/**
 * Inline cursor/typing indicator for a specific field.
 */
export function FieldCollabIndicator({ fieldName, cursors, typingUsers, currentUserId }) {
  const cursorEntries = Object.entries(cursors).filter(
    ([uid, c]) => c.field === fieldName && uid !== currentUserId
  );
  const typingEntries = Object.entries(typingUsers).filter(
    ([uid, t]) => t.field === fieldName && uid !== currentUserId
  );

  if (cursorEntries.length === 0 && typingEntries.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1" data-testid={`collab-indicator-${fieldName}`}>
      {typingEntries.map(([uid, t]) => (
        <span
          key={uid}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/15 rounded text-[10px] text-purple-400 border border-purple-500/25 animate-pulse"
        >
          <Edit3 className="w-2.5 h-2.5" />
          {t.user_name} is typing...
        </span>
      ))}
      {cursorEntries.filter(([uid]) => !typingEntries.some(([tid]) => tid === uid)).map(([uid, c]) => (
        <span
          key={uid}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded text-[10px] text-blue-400 border border-blue-500/20"
        >
          <Eye className="w-2.5 h-2.5" />
          {c.user_name}
        </span>
      ))}
    </div>
  );
}
