export interface Material {
  id: number;
  name: string;
  description: string;
  measurementUnit: string;
  price: number;
  stockMax: number;
  stockMin: number;
  currentStock?: number;
  status: 'active' | 'inactive';
  ubicacion: string;
  location: string;
  createDate: Date;
  images?: MaterialImage[];
  compositions?: MaterialComposition[];
  type?: 'regular' | 'transformed'; // Add type to distinguish material types
  // Backend fields
  strId?: string;
  strName?: string;
  strDescription?: string;
  strUnitMeasure?: string;
  fltPrice?: number;
  ingQuantity?: number;
  ingMinStock?: number;
  ingMaxStock?: number;
  strStatus?: string;
}

export interface MaterialImage {
  id: number;
  materialId: number;
  url: string;
  strImageUrl?: string; // Campo del backend
  status: 'active' | 'inactive';
  file?: File; // Archivo temporal para subir
}

export interface MaterialComposition {
  id: number;
  materialId: number;
  componentMaterialId: number;
  quantity: number;
  componentMaterial?: Material;
}

export interface MaterialFilters {
  search: string;
  ubicacion: string[];
  priceRange: [number, number];
  stockStatus: 'low' | 'normal' | 'high' | 'all';
  status: 'active' | 'inactive' | 'all';
}

export interface MaterialMetrics {
  totalMaterials: number;
  lowStockCount: number;
  totalValue: number;
  activeCount: number;
  inactiveCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}