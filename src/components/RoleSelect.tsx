import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fetchContactRoles } from '../lib/roleUtils';
import type { ContactRole } from '../lib/roleUtils';

type Props = {
  tenantId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function RoleSelect({ tenantId, value, onChange, placeholder = 'Επιλογή ρόλου…' }: Props) {
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetchContactRoles(tenantId).then(setRoles);
  }, [tenantId]);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const selectedRole = roles.find(r => r.name === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input w-full flex items-center justify-between gap-2 cursor-pointer text-left"
      >
        <span className={`flex items-center gap-1.5 ${value ? 'text-text-primary' : 'text-text-secondary'}`}>
          {selectedRole && (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: selectedRole.color }} />
          )}
          {value || placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-text-secondary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-border/10 bg-secondary-background shadow-xl overflow-hidden">
            {roles.length === 0 ? (
              <p className="px-4 py-3 text-sm text-text-secondary">Δεν υπάρχουν ρόλοι. Προσθέστε από τη σελίδα Επαφών.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto divide-y divide-border/10">
                {roles.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => select(r.name)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                      value === r.name ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-white/5'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            {value && (
              <div className="border-t border-border/10">
                <button
                  type="button"
                  onClick={() => select('')}
                  className="w-full px-4 py-2 text-left text-xs text-text-secondary hover:bg-white/5 cursor-pointer"
                >
                  Καθαρισμός επιλογής
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
