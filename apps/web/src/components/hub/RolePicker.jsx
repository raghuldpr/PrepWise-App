import React, { useEffect, useState } from 'react';
import { ROLES, STACK_PRESETS } from '@prepwise/content';
import { roleFromText } from '@prepwise/core';
import api from '../../services/api';

const selectClass =
  'mt-1 w-full rounded-xl px-3 py-2 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]';

/** The role the profile's target role maps to (null while loading or when nothing matches). */
export function useProfileRole() {
  const [roleId, setRoleId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.get('/users/profile')
      .then((res) => !cancelled && setRoleId(roleFromText(res.data.targetRole)?.id ?? null))
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, []);
  return { profileRoleId: roleId, loaded };
}

export default function RolePicker({ roleId, stackId, onChange, disabled = false }) {
  const presets = STACK_PRESETS[roleId] ?? [];
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <label className="block text-sm font-semibold">
        Target role
        <select
          value={roleId}
          disabled={disabled}
          onChange={(e) => onChange({ roleId: e.target.value, stackId: '' })}
          className={selectClass}
        >
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
      </label>
      {presets.length > 0 && (
        <label className="block text-sm font-semibold">
          Preferred stack
          <select value={stackId} disabled={disabled} onChange={(e) => onChange({ roleId, stackId: e.target.value })} className={selectClass}>
            <option value="">No preference</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export { selectClass };
