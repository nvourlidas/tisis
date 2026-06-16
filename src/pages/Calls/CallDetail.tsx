import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Users, Mail, Briefcase, User, CalendarDays,
  AlertCircle, RotateCcw, Pencil,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCall } from './callUtils';
import type { Call } from './types';
import EditCallModal from './modals/EditCallModal';

const DIRECTION_LABEL: Record<string, string> = {
  phone: 'Τηλεφώνημα',
  inperson: 'Δια ζώσης',
  email: 'Email',
};

const DIRECTION_ICON: Record<string, React.ReactNode> = {
  phone: <Phone className="h-4 w-4" />,
  inperson: <Users className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};

const DIRECTION_COLOR: Record<string, { badge: string; icon: string }> = {
  phone: { badge: 'bg-green-500/10 text-green-400 border-green-500/20', icon: 'bg-green-500/10 text-green-500' },
  inperson: { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: 'bg-blue-500/10 text-blue-500' },
  email: { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: 'bg-purple-500/10 text-purple-500' },
};

export default function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const c = await fetchCall(id);
    setCall(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft">
        <RotateCcw className="h-4 w-4 animate-spin" />
        Φόρτωση γεγονότος…
      </div>
    );
  }

  if (!call) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => navigate('/calls')} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Γεγονότα
        </button>
        <p className="text-sm text-text-secondary">Το γεγονός δεν βρέθηκε.</p>
      </div>
    );
  }

  const dir = call.direction ?? 'phone';
  const colors = DIRECTION_COLOR[dir] ?? DIRECTION_COLOR.phone;
  const dateObj = new Date(call.created_at);
  const dateStr = dateObj.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <EditCallModal
        open={editing}
        call={call}
        onClose={() => setEditing(false)}
        onUpdated={() => { setEditing(false); load(); }}
      />

      <div className="p-6 space-y-6">
        {/* Back */}
        <button onClick={() => navigate('/calls')} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors animate-fade-in">
          <ArrowLeft className="h-4 w-4" />
          Γεγονότα
        </button>

        {/* Header card */}
        <div className="animate-fade-in-up rounded-2xl border border-border/10 bg-secondary-background p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                {DIRECTION_ICON[dir]}
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  {call.caller_name ?? call.phone ?? 'Άγνωστος'}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.badge}`}>
                  {DIRECTION_ICON[dir]}
                  {DIRECTION_LABEL[dir]}
                </span>
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              Επεξεργασία
            </button>
          </div>

          {/* Info chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <InfoCard
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Ημερομηνία"
              value={`${dateStr} ${timeStr}`}
              color="text-blue-500"
              bg="bg-blue-500/10"
            />
            {call.phone && (
              <InfoCard
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Τηλέφωνο"
                value={call.phone}
                color="text-text-secondary"
                bg="bg-border/10"
              />
            )}
            {call.caller_name && (
              <InfoCard
                icon={<User className="h-3.5 w-3.5" />}
                label="Επαφή"
                value={call.caller_name}
                color="text-teal-500"
                bg="bg-teal-500/10"
              />
            )}
            {call.case_code && (
              <button
                onClick={() => call.case_id && navigate(`/cases/${call.case_id}`)}
                className="flex items-center gap-2.5 rounded-xl border border-border/10 bg-secondary-background p-3 hover:border-primary/20 hover:bg-primary/5 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-text-secondary uppercase tracking-wider">Υπόθεση</div>
                  <div className="text-xs font-mono text-primary truncate">{call.case_code}</div>
                  {call.case_title && <div className="text-xs text-text-primary truncate">{call.case_title}</div>}
                </div>
              </button>
            )}
            {!call.case_id && (
              <div className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                <span className="text-xs text-orange-400">Χωρίς υπόθεση</span>
              </div>
            )}
          </div>

          {/* Description */}
          {call.description && (
            <div className="rounded-xl border border-border/10 bg-background p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Περιγραφή</div>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{call.description}</p>
            </div>
          )}
        </div>

        {/* Follow-up card */}
        {call.follow_up_required && (
          <div className="animate-fade-in-up rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-orange-400">Follow-up απαιτείται</h2>
            </div>
            {call.follow_up_notes && (
              <div>
                <div className="text-xs font-medium text-orange-400/70 uppercase tracking-wider mb-1">Εξέλιξη</div>
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{call.follow_up_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function InfoCard({ icon, label, value, color = 'text-text-secondary', bg = 'bg-border/5' }: {
  icon: React.ReactNode; label: string; value: string; color?: string; bg?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/10 bg-secondary-background p-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg} ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-text-primary truncate">{value}</div>
      </div>
    </div>
  );
}
