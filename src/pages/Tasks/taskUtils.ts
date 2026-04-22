import { supabase } from '../../lib/supabase';

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
  // joined
  case_code?: string | null;
  case_title?: string | null;
};

export async function fetchAllTasks(tenantId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, cases(code, title)')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
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

export async function createTask(_tenantId: string, form: {
  title: string;
  description: string;
  due_date: string;
  case_id: string;
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
