export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  measurementUnit: string;
  stockMin?: number;
  stockMax?: number;
  location?: string;
  status: string;
  createDate: Date;
}

export interface ProductComposition {
  materialId: string;
  materialName?: string;
  quantity: number;
}
