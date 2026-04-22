export type Contact = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  notes: string | null;
  created_at: string;
};

export type ContactFormData = {
  name: string;
  phone: string;
  email: string;
  role: string;
  notes: string;
};

export type ContactCase = {
  case_id: string;
  code: string;
  title: string;
  status: string;
};
