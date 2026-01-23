export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  address: string;
  documentType: string;
  documentNumber: string;
  contactEmail: string;
  contactPhone: string;
  status: 'active' | 'inactive';
}
