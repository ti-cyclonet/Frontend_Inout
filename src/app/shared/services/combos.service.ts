import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ComboType = 'VIRTUAL' | 'KIT';
export type ComboItemType = 'product' | 'material' | 'material_t';
export type ComboQuantityMode = 'SALE' | 'STOCK';

export interface ComboComponentView {
  strId: string;
  itemType: ComboItemType;
  itemId: string;
  name: string;
  quantity: number;
  quantityMode: ComboQuantityMode;
  unitMeasure: string | null;
  listPrice: number;
  stockUnitCost: number;
  presentationFactor: number;
  /** Disponible en unidad de stock. */
  stockAvailable: number;
  madeToOrder: boolean;
}

export interface ComboView {
  strId: string;
  strCode: string;
  strName: string;
  strDescription: string | null;
  strType: ComboType;
  strStatus: 'active' | 'inactive';
  blnMarketplaceVisible: boolean;
  strImageUrl: string | null;
  fltPrice: number;
  listPrice: number;
  savings: number;
  savingsPercent: number;
  cost: number;
  currentComponentsCost: number;
  margin: number;
  marginPercent: number;
  belowCost: boolean;
  /** KIT: armados libres. VIRTUAL: vendibles con el stock (null = sin límite). */
  available: number | null;
  ingQuantity: number;
  ingReservedStock: number;
  /** KIT: cuántos se pueden armar con el stock de componentes. */
  assemblable: number | null;
  components: ComboComponentView[];
}

export interface CatalogOption {
  itemType: ComboItemType;
  id: string;
  name: string;
  /** Nombre de venta (producto o presentación); null si el material no es de reventa. */
  saleName: string | null;
  unit: string | null;
  resale: boolean;
  listPrice: number;
  stockUnitCost: number;
  presentationFactor: number;
  stock: number;
  saleStock: number | null;
  categoryId: number | null;
  madeToOrder?: boolean;
  active: boolean;
}

export interface CatalogOptions {
  items: CatalogOption[];
  combos: { itemType: 'combo' | 'kit'; id: string; name: string; listPrice: number; active: boolean }[];
  categories: { id: string; name: string }[];
}

export interface ComboComponentInput {
  itemType: ComboItemType;
  itemId: string;
  quantity: number;
  quantityMode: ComboQuantityMode;
}

export interface ComboInput {
  name: string;
  description?: string;
  type: ComboType;
  price: number;
  marketplaceVisible: boolean;
  components: ComboComponentInput[];
}

export interface ComboAssembly {
  strId: string;
  strType: 'ASSEMBLE' | 'DISASSEMBLE';
  fltQuantity: number;
  fltUnitCost: number;
  strBatchReference: string;
  dtmDate: string;
  strNotes: string | null;
  strCreatedBy: string | null;
  dtmCreationDate: string;
}

/** Combos virtuales y kits armados (backend: /combos). */
@Injectable({ providedIn: 'root' })
export class CombosService {
  private readonly baseUrl = `${environment.apiUrl}/combos`;

  constructor(private http: HttpClient) {}

  list(): Observable<ComboView[]> {
    return this.http.get<ComboView[]>(this.baseUrl);
  }

  options(): Observable<CatalogOptions> {
    return this.http.get<CatalogOptions>(`${this.baseUrl}/options`);
  }

  create(input: ComboInput): Observable<ComboView> {
    return this.http.post<ComboView>(this.baseUrl, input);
  }

  update(id: string, input: Partial<ComboInput> & { status?: 'active' | 'inactive' }): Observable<ComboView> {
    return this.http.patch<ComboView>(`${this.baseUrl}/${id}`, input);
  }

  remove(id: string): Observable<{ deleted: boolean; deactivated: boolean; message: string }> {
    return this.http.delete<{ deleted: boolean; deactivated: boolean; message: string }>(`${this.baseUrl}/${id}`);
  }

  assemble(id: string, body: { quantity: number; date?: string; notes?: string }): Observable<{ message: string; combo: ComboView }> {
    return this.http.post<{ message: string; combo: ComboView }>(`${this.baseUrl}/${id}/assemble`, body);
  }

  disassemble(id: string, body: { quantity: number; date?: string; notes?: string }): Observable<{ message: string; combo: ComboView }> {
    return this.http.post<{ message: string; combo: ComboView }>(`${this.baseUrl}/${id}/disassemble`, body);
  }

  assemblies(id: string): Observable<ComboAssembly[]> {
    return this.http.get<ComboAssembly[]>(`${this.baseUrl}/${id}/assemblies`);
  }
}
