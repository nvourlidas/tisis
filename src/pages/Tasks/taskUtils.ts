import { supabase } from '../../lib/supabase';

export const TASK_CATEGORIES = {
  legal_act: 'Νομικές Πράξεις',
  extrajudicial: 'Εξοδικαστηκές Ενέργιες',
  appointment: 'Επαγγελματικά Ραντεβού',
  file_work: 'Εργασία Φακέλου',
} as const;

export type TaskCategory = keyof typeof TASK_CATEGORIES;

export type LegalActData = {
  protocol_number?: string;
  creation_date?: string;
  authority?: string;
  gak?: string;
  eka?: string;
  decision?: { number?: string; date?: string; description?: string };
};

export type AppointmentData = {
  start_datetime?: string;
  end_datetime?: string;
};

export type TaskExpense = { description: string; amount: number };

export type Task = {
  id: string;
  tenant_id: string;
  case_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'open' | 'done';
  completed_at: string | null;
  created_at: string;
  category: TaskCategory | null;
  extra_data: LegalActData | AppointmentData | null;
  fee: number | null;
  expenses: TaskExpense[] | null;
  // joined
  case_code?: string | null;
  case_title?: string | null;
  client_name?: string | null;
};

export async function fetchAllTasks(tenantId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, cases(code, title, clients(name))')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    due_date: r.due_date ? r.due_date.slice(0, 10) : null,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
    client_name: r.cases?.clients?.name ?? null,
    category: r.category ?? null,
    extra_data: r.extra_data ?? null,
    fee: r.fee ?? null,
    expenses: r.expenses ?? null,
  }));
}

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-complete', { body: { id } });
  if (error) throw error;
}

export async function reopenTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-reopen', { body: { id } });
  if (error) throw error;
}

export async function updateTask(form: {
  id: string;
  title: string;
  description: string;
  due_date: string;
  category?: string;
  extra_data?: object | null;
  fee?: number | null;
  expenses?: TaskExpense[] | null;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('task-update', { body: form });
  if (error) throw error;
}

export async function createTask(_tenantId: string, form: {
  title: string;
  description: string;
  due_date: string;
  case_id: string;
  category?: string;
  extra_data?: object | null;
  fee?: number | null;
  expenses?: TaskExpense[] | null;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('task-create', { body: form });
  if (error) throw error;
}

const today = () => new Date().toISOString().slice(0, 10);

export function groupTasks(tasks: Task[]) {
  const t = today();
  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const upcoming: Task[] = [];
  const noDueDate: Task[] = [];
  const done: Task[] = [];

  for (const task of tasks) {
    if (task.status === 'done') { done.push(task); continue; }
    if (!task.due_date) { noDueDate.push(task); continue; }
    if (task.due_date < t) { overdue.push(task); continue; }
    if (task.due_date === t) { todayTasks.push(task); continue; }
    upcoming.push(task);
  }

  return { overdue, today: todayTasks, upcoming, noDueDate, done };
}
