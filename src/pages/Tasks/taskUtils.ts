import { supabase } from '../../lib/supabase';

export const TASK_CATEGORIES = {
  legal_act: 'Νομικές Πράξεις',
  lawsuit: 'Αγωγή/Αίτηση/Προσφυγή/κτλ.',
  extrajudicial: 'Εξωδικαστικές Ενέργειες',
  appointment: 'Επαγγελματικά Ραντεβού',
  file_work: 'Εργασία Φακέλου',
  court: 'Δικαστήριο',
} as const;

export type TaskCategory = keyof typeof TASK_CATEGORIES;

export type LegalActData = {
  protocol_number?: string;
  creation_date?: string;
  authority?: string;
  gak?: string;
  eak?: string;
  decision?: { number?: string; date?: string; description?: string };
};

export type AppointmentData = {
  start_datetime?: string;
  end_datetime?: string;
};

export type CourtData = {
  start_datetime?: string;
  end_datetime?: string;
  decision_number?: string;
  decision_date?: string;
};

export type TaskExpense = { description: string; amount: number };

export function extraDataToDescription(
  category: TaskCategory | null | undefined,
  extra_data: LegalActData | AppointmentData | CourtData | null | undefined,
): string | null {
  if (!category || !extra_data) return null;
  const parts: string[] = [];
  if (category === 'legal_act') {
    const d = extra_data as LegalActData;
    if (d.authority) parts.push(`Αρχή: ${d.authority}`);
    if (d.protocol_number) parts.push(`Αρ. Πρωτ.: ${d.protocol_number}`);
    if (d.creation_date) parts.push(`Ημ. Δημιουργίας: ${new Date(d.creation_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
    if (d.decision?.number) parts.push(`Αρ. Απόφασης: ${d.decision.number}`);
    if (d.decision?.date) parts.push(`Ημ. Απόφασης: ${new Date(d.decision.date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
    if (d.decision?.description) parts.push(`Απόφαση: ${d.decision.description}`);
  } else if (category === 'lawsuit') {
    const d = extra_data as LegalActData;
    if (d.authority) parts.push(`Δικαστήριο: ${d.authority}`);
    if (d.gak) parts.push(`ΓΑΚ: ${d.gak}`);
    if (d.eak) parts.push(`ΕΑΚ: ${d.eak}`);
  } else if (category === 'appointment') {
    const d = extra_data as AppointmentData;
    if (d.start_datetime) {
      const start = new Date(d.start_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      parts.push(`Έναρξη: ${start}`);
    }
    if (d.end_datetime) {
      const end = new Date(d.end_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      parts.push(`Λήξη: ${end}`);
    }
  } else if (category === 'court') {
    const d = extra_data as CourtData;
    if (d.start_datetime) {
      const start = new Date(d.start_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      parts.push(`Έναρξη: ${start}`);
    }
    if (d.end_datetime) {
      const end = new Date(d.end_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      parts.push(`Λήξη: ${end}`);
    }
    if (d.decision_number) parts.push(`Αρ. Απόφασης: ${d.decision_number}`);
    if (d.decision_date) parts.push(`Ημ. Έκδοσης: ${new Date(d.decision_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
  }
  return parts.length ? parts.join('\n') : null;
}

export type LinkedTask = {
  id: string;
  title: string;
  due_date: string | null;
  status: 'open' | 'done';
  category: TaskCategory | null;
};

export type CategoryRate = {
  id: string;
  tenant_id: string;
  category: TaskCategory;
  rate_per_hour: number;
};

export type Task = {
  id: string;
  tenant_id: string;
  case_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: 'open' | 'done';
  completed_at: string | null;
  created_at: string;
  category: TaskCategory | null;
  extra_data: LegalActData | AppointmentData | null;
  fee: number | null;
  expenses: TaskExpense[] | null;
  hours: number | null;
  // joined
  case_code?: string | null;
  case_title?: string | null;
  client_name?: string | null;
  linked_tasks?: LinkedTask[];
};

export async function fetchTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, cases(code, title, clients(name))')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return mapTask(data);
}

export async function fetchAllTasks(tenantId: string): Promise<Task[]> {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, cases(code, title, clients(name))')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all.map(mapTask);
}

function mapTask(r: any): Task {
  return {
    ...r,
    due_date: r.due_date ? r.due_date.slice(0, 10) : null,
    due_time: r.due_time ? r.due_time.slice(0, 5) : null,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
    client_name: r.cases?.clients?.name ?? null,
    category: r.category ?? null,
    extra_data: r.extra_data ?? null,
    fee: r.fee ?? null,
    expenses: r.expenses ?? null,
    hours: r.hours ?? null,
  };
}

// Fetch tasks visible for a given month: the month itself + open tasks with no due date.
// Also includes overdue open tasks so the calendar can show them when navigating back.
export async function fetchTasksForMonth(
  tenantId: string,
  year: number,
  month: number,
): Promise<{ tasks: Task[]; noDueDateTasks: Task[] }> {
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const PAGE = 1000;

  // Fetch tasks with due_date in this month (paginated)
  const inMonth: any[] = [];
  let fromIdx = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, cases(code, title, clients(name))')
      .eq('tenant_id', tenantId)
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .order('due_date', { ascending: true })
      .range(fromIdx, fromIdx + PAGE - 1);
    if (error) throw error;
    inMonth.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    fromIdx += PAGE;
  }

  // Fetch open tasks with no due date (paginated)
  const noDue: any[] = [];
  fromIdx = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, cases(code, title, clients(name))')
      .eq('tenant_id', tenantId)
      .is('due_date', null)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .range(fromIdx, fromIdx + PAGE - 1);
    if (error) throw error;
    noDue.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    fromIdx += PAGE;
  }

  return {
    tasks: inMonth.map(mapTask),
    noDueDateTasks: noDue.map(mapTask),
  };
}

// Fetch only tasks needed for dashboard widgets: overdue + today open tasks.
// Avoids loading the full task table (can be 30k+ rows).
export async function fetchDashboardOpenTasks(tenantId: string): Promise<Task[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('tasks')
    .select('*, cases(code, title, clients(name))')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .lte('due_date', today)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function fetchTaskCounts(tenantId: string): Promise<{ open: number; done: number }> {
  const [{ count: open }, { count: done }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'open'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'done'),
  ]);
  return { open: open ?? 0, done: done ?? 0 };
}

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-complete', { body: { id } });
  if (error) throw error;
}

export async function reopenTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-reopen', { body: { id } });
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTaskHours(id: string, hours: number | null): Promise<void> {
  const { error } = await supabase.from('tasks').update({ hours }).eq('id', id);
  if (error) throw error;
}

export async function updateTask(form: {
  id: string;
  title: string;
  description: string;
  due_date: string;
  due_time?: string;
  case_id?: string | null;
  category?: string;
  extra_data?: object | null;
  fee?: number | null;
  expenses?: TaskExpense[] | null;
  hours?: number | null;
  linked_task_ids?: string[];
}): Promise<void> {
  const { error } = await supabase.functions.invoke('task-update', { body: form });
  if (error) throw error;
}

export async function searchFullTasks(tenantId: string, query: string): Promise<Task[]> {
  const [taskRes, caseRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, cases(code, title, clients(name))')
      .eq('tenant_id', tenantId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('cases')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`code.ilike.%${query}%,title.ilike.%${query}%`),
  ]);
  if (taskRes.error) throw taskRes.error;
  if (caseRes.error) throw caseRes.error;

  const caseIds = (caseRes.data ?? []).map(c => c.id);
  let caseTaskRows: typeof taskRes.data = [];
  if (caseIds.length > 0) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, cases(code, title, clients(name))')
      .eq('tenant_id', tenantId)
      .in('case_id', caseIds)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    caseTaskRows = data ?? [];
  }

  const seen = new Set<string>();
  const merged: Task[] = [];
  for (const row of [...(taskRes.data ?? []), ...caseTaskRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(mapTask(row));
  }
  merged.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
  return merged;
}

export async function searchTasks(tenantId: string, query: string, excludeId?: string): Promise<LinkedTask[]> {
  let q = supabase
    .from('tasks')
    .select('id, title, due_date, status, category')
    .eq('tenant_id', tenantId)
    .ilike('title', `%${query}%`)
    .limit(20);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q;
  return (data ?? []).map(r => ({
    id: r.id,
    title: r.title,
    due_date: r.due_date ? r.due_date.slice(0, 10) : null,
    status: r.status,
    category: r.category ?? null,
  }));
}

export async function fetchLinkedTasks(taskId: string): Promise<LinkedTask[]> {
  const { data } = await supabase
    .from('task_links')
    .select('linked_task:tasks!task_links_linked_task_id_fkey(id, title, due_date, status, category)')
    .eq('task_id', taskId);
  return (data ?? []).map((r: any) => ({
    id: r.linked_task.id,
    title: r.linked_task.title,
    due_date: r.linked_task.due_date ? r.linked_task.due_date.slice(0, 10) : null,
    status: r.linked_task.status,
    category: r.linked_task.category ?? null,
  }));
}

export async function createTask(_tenantId: string, form: {
  title: string;
  description: string;
  due_date: string;
  due_time?: string;
  case_id: string;
  category?: string;
  extra_data?: object | null;
  fee?: number | null;
  expenses?: TaskExpense[] | null;
  hours?: number | null;
  linked_task_ids?: string[];
}): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('task-create', { body: form });
  if (error) throw error;
  return data;
}

// ── Task Payments ─────────────────────────────────────────────────────────────

export type TaskPayment = {
  id: string;
  task_id: string;
  amount: number;
  paid_at: string;
  notes: string | null;
  created_at: string;
};

export async function addTaskLink(tenantId: string, taskId: string, linkedTaskId: string): Promise<void> {
  const { error } = await supabase.from('task_links').upsert(
    { tenant_id: tenantId, task_id: taskId, linked_task_id: linkedTaskId },
    { onConflict: 'task_id,linked_task_id' },
  );
  if (error) throw error;
}

export async function removeTaskLink(taskId: string, linkedTaskId: string): Promise<void> {
  const { error } = await supabase
    .from('task_links')
    .delete()
    .eq('task_id', taskId)
    .eq('linked_task_id', linkedTaskId);
  if (error) throw error;
}

export async function fetchTaskPayments(taskId: string): Promise<TaskPayment[]> {
  const { data, error } = await supabase
    .from('task_payments')
    .select('*')
    .eq('task_id', taskId)
    .order('paid_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => ({ ...r, paid_at: r.paid_at.slice(0, 10) }));
}

export async function createTaskPayment(
  tenantId: string,
  taskId: string,
  payment: { amount: number; paid_at: string; notes?: string },
): Promise<void> {
  const { error } = await supabase.from('task_payments').insert({
    tenant_id: tenantId,
    task_id: taskId,
    amount: payment.amount,
    paid_at: payment.paid_at,
    notes: payment.notes ?? null,
  });
  if (error) throw error;
}

export async function deleteTaskPayment(id: string): Promise<void> {
  const { error } = await supabase.from('task_payments').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTaskPaymentsForTasks(taskIds: string[]): Promise<TaskPayment[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from('task_payments')
    .select('*')
    .in('task_id', taskIds)
    .order('paid_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => ({ ...r, paid_at: r.paid_at.slice(0, 10) }));
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

// ── Category Rates ────────────────────────────────────────────────────────────

export async function fetchCategoryRates(tenantId: string): Promise<CategoryRate[]> {
  const { data, error } = await supabase
    .from('category_rates')
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertCategoryRate(tenantId: string, category: TaskCategory, rate_per_hour: number): Promise<void> {
  const { error } = await supabase
    .from('category_rates')
    .upsert({ tenant_id: tenantId, category, rate_per_hour }, { onConflict: 'tenant_id,category' });
  if (error) throw error;
}

export function calcTaskAmount(hours: number | null, rates: CategoryRate[], category: TaskCategory | null): number | null {
  if (!hours || !category) return null;
  const rate = rates.find(r => r.category === category);
  if (!rate || rate.rate_per_hour === 0) return null;
  return hours * rate.rate_per_hour;
}
