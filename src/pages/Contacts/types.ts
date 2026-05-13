export type Contact = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  role: string | null;
  notes: string | null;
  vat: string | null;
  address: string | null;
  job_title: string | null;
  organization: string | null;
  website: string | null;
  google_contact_id: string | null;
  father_name: string | null;
  mother_name: string | null;
  birthdate: string | null;
  amka: string | null;
  iban: string | null;
  at: string | null;
  taxis_username: string | null;
  taxis_password: string | null;
  is_client: boolean;
  created_at: string;
};

export type ContactFormData = {
  name: string;
  phone: string;
  phone2: string;
  email: string;
  role: string;
  notes: string;
  vat: string;
  address: string;
  job_title: string;
  organization: string;
  website: string;
  father_name: string;
  mother_name: string;
  birthdate: string;
  amka: string;
  iban: string;
  at: string;
  taxis_username: string;
  taxis_password: string;
};

export type ContactCase = {
  case_id: string;
  code: string;
  title: string;
  status: string;
};
