export type CaseStatus = 'active' | 'pending' | 'closed';
export type CaseType = 'Αστικό' | 'Ποινικό' | 'Διοικητικό' | 'Εμπορικό';

export type CaseStage = {
  id: string;
  tenant_id: string;
  name: string;
  position: number;
  created_at: string;
};

export type Case = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  code: string;
  title: string;
  status: CaseStatus;
  stage_id: string | null;
  description: string | null;
  google_drive_url: string | null;
  google_drive_folder_id: string | null;
  notes: string | null;
  type: CaseType | null;
  created_at: string;
  // joined
  client_name?: string | null;
  client_email?: string | null;
  stage_name?: string | null;
};

export type CaseFormData = {
  code: string;
  title: string;
  client_id: string;
  status: CaseStatus;
  type: CaseType | '';
  stage_id: string;
  description: string;
  google_drive_url: string;
  notes: string;
  created_at: string;
};

export type CaseContact = {
  contact_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
};

export type CaseContactEmail = {
  label: string;
  email: string;
};

export type CaseCall = {
  id: string;
  phone: string | null;
  caller_name: string | null;
  direction: 'phone' | 'inperson';
  description: string | null;
  follow_up_required: boolean;
  created_at: string;
};

export type CaseTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  status: 'open' | 'done';
  completed_at: string | null;
  created_at: string;
  category: import('../Tasks/taskUtils').TaskCategory | null;
  extra_data: import('../Tasks/taskUtils').LegalActData | import('../Tasks/taskUtils').AppointmentData | null;
  hours: number | null;
  fee_id: string | null;
};

export type CaseFee = {
  id: string;
  tenant_id: string;
  case_id: string;
  amount: number;
  agreement_date: string | null;
  notes: string | null;
  created_at: string;
  payments?: FeePayment[];
};

export type FeePayment = {
  id: string;
  fee_id: string;
  amount: number;
  paid_at: string;
  notes: string | null;
  created_at: string;
};

export type CaseExpense = {
  id: string;
  tenant_id: string;
  case_id: string;
  amount: number;
  date: string | null;
  notes: string | null;
  created_at: string;
  drive_file_id: string | null;
  drive_file_url: string | null;
  drive_file_name: string | null;
};
