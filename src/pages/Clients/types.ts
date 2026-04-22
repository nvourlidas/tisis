export type Client = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  vat: string | null;
  address: string | null;
  professional_status: string | null;
  notes: string | null;
  created_at: string;
};

export type ClientFormData = {
  name: string;
  phone: string;
  phone2: string;
  email: string;
  vat: string;
  address: string;
  professional_status: string;
  notes: string;
};
