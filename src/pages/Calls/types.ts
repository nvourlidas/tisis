export type CallDirection = 'incoming' | 'outgoing';

export type Call = {
  id: string;
  tenant_id: string;
  phone: string | null;
  caller_name: string | null;
  direction: CallDirection;
  case_id: string | null;
  client_id: string | null;
  contact_id: string | null;
  description: string | null;
  follow_up_required: boolean;
  created_at: string;
  // joined
  case_code?: string | null;
  case_title?: string | null;
};

export type CallFormData = {
  phone: string;
  caller_name: string;
  direction: CallDirection;
  case_id: string;
  contact_id: string;
  description: string;
  follow_up_required: boolean;
  create_task: boolean;
  task_title: string;
  task_due_date: string;
};
