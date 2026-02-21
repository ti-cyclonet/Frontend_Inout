export interface Customer {
  id?: string;
  potentialUserId?: number;
  tenantId?: string;
  customerCode?: string;
  businessName?: string;
  contactPerson?: string;
  phone?: string;
  email: string;
  address?: string;
  documentType?: string;
  documentNumber?: string;
  documentDv?: string;
  personType?: string;
  firstName?: string;
  secondName?: string;
  firstSurname?: string;
  secondSurname?: string;
  birthDate?: string;
  maritalStatus?: string;
  sex?: string;
  status?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerWithDetails extends Customer {
  potentialUserDetails?: {
    id: number;
    email: string;
    sourceApplication: string;
    basicData?: any;
    documentType?: any;
    documentNumber?: string;
    status: string;
  };
}

export interface CreateCustomerDto {
  email: string;
  businessName?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  documentType?: string;
  documentNumber?: string;
  documentDv?: string;
  personType?: string;
  firstName?: string;
  secondName?: string;
  firstSurname?: string;
  secondSurname?: string;
  birthDate?: string;
  maritalStatus?: string;
  sex?: string;
}