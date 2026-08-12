import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  status: string;
  locations?: WarehouseLocation[];
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  name: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
  capacity?: string;
}

export interface StockTransfer {
  id: string;
  transferCode?: string;
  materialId: string;
  materialName: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  quantity: number;
  notes?: string;
  createdAt: string;
}

export interface PhysicalCount {
  id: string;
  countCode?: string;
  description: string;
  status: string;
  items: PhysicalCountItem[];
  totalItems: number;
  countedItems: number;
  discrepancies: number;
  performedBy?: string;
  createdAt: string;
  completedAt?: string;
  appliedAt?: string;
}

export interface PhysicalCountItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  unit: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WarehousesService {
  private apiUrl = `${environment.apiUrl}/warehouses`;

  constructor(private http: HttpClient) {}

  // Warehouses
  getWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(this.apiUrl);
  }

  createWarehouse(data: Partial<Warehouse>): Observable<Warehouse> {
    return this.http.post<Warehouse>(this.apiUrl, data);
  }

  deleteWarehouse(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Locations
  getLocations(warehouseId: string): Observable<WarehouseLocation[]> {
    return this.http.get<WarehouseLocation[]>(`${this.apiUrl}/${warehouseId}/locations`);
  }

  createLocation(data: any): Observable<WarehouseLocation> {
    return this.http.post<WarehouseLocation>(`${this.apiUrl}/locations`, data);
  }

  deleteLocation(locationId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/locations/${locationId}`);
  }

  // Transfers
  getTransfers(): Observable<StockTransfer[]> {
    return this.http.get<StockTransfer[]>(`${this.apiUrl}/transfers`);
  }

  createTransfer(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/transfers`, data);
  }

  // Physical Counts
  getPhysicalCounts(): Observable<PhysicalCount[]> {
    return this.http.get<PhysicalCount[]>(`${this.apiUrl}/physical-counts`);
  }

  createPhysicalCount(data: any): Observable<PhysicalCount> {
    return this.http.post<PhysicalCount>(`${this.apiUrl}/physical-count`, data);
  }

  updatePhysicalCount(id: string, data: any): Observable<PhysicalCount> {
    return this.http.patch<PhysicalCount>(`${this.apiUrl}/physical-count/${id}`, data);
  }

  applyPhysicalCount(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/physical-count/${id}/apply`, {});
  }
}
