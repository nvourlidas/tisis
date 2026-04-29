export type CaseStatus = 'active' | 'pending' | 'closed';
export type CaseType = 'Αστικό' | 'Ποινικό' | 'Διοικητικό' | 'Εμπορικό';

export type Case = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  code: string;
  title: string;
  status: CaseStatus;
  stage: string | null;
  description: string | null;
  next_critical_date: string | null;
  google_drive_url: string | null;
  notes: string | null;
  type: CaseType | null;
  created_at: string;
  // joined
  client_name?: string | null;
};

export type CaseFormData = {
  code: string;
  title: string;
  client_id: string;
  status: CaseStatus;
  type: CaseType | '';
  stage: string;
  description: string;
  next_critical_date: string;
  google_drive_url: string;
  notes: string;
};

export type CaseContact = {
  contact_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
};

export type CaseCall = {
  id: string;
  phone: string | null;
  caller_name: string | null;
  direction: 'incoming' | 'outgoing';
  description: string | null;
  follow_up_required: boolean;
  created_at: string;
};

export type CaseTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'open' | 'done';
  completed_at: string | null;
  created_at: string;
  category: import('../Tasks/taskUtils').TaskCategory | null;
  extra_data: import('../Tasks/taskUtils').LegalActData | import('../Tasks/taskUtils').AppointmentData | null;
  fee: number | null;
  expenses: import('../Tasks/taskUtils').TaskExpense[] | null;
};

export type CaseFinancial = {
  id: string;
  type: 'fee' | 'expense' | 'receipt';
  amount: number;
  description: string | null;
  date: string | null;
  created_at: string;
};
