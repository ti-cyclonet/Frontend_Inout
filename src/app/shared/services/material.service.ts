import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay, map, catchError } from 'rxjs/operators';
import { Material, MaterialFilters, MaterialMetrics, PaginatedResponse } from '../models/material.model';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private materialsSubject = new BehaviorSubject<Material[]>([]);
  public materials$ = this.materialsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  getMaterials(filters?: MaterialFilters, page: number = 1, limit: number = 10): Observable<PaginatedResponse<Material>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.status !== 'all') params = params.set('status', filters.status);
      if (filters.stockStatus !== 'all') params = params.set('stockStatus', filters.stockStatus);
      if (filters.ubicacion.length > 0) params = params.set('ubicacion', filters.ubicacion.join(','));
    }

    return this.http.get<any>(this.apiConfig.ENDPOINTS.MATERIALS, {
      params
    }).pipe(
      map(response => ({
        ...response,
        data: response.data.map((item: any) => ({
          id: item.strId,
          name: item.strName,
          description: item.strDescription,
          measurementUnit: item.strUnitMeasure,
          price: item.fltPrice,
          stockMax: item.ingMaxStock,
          stockMin: item.ingMinStock,
          currentStock: item.ingQuantity,
          status: item.strStatus.toLowerCase(),
          ubicacion: item.strLocation,
          createDate: new Date(item.dtmCreationDate),
          images: item.images || []
        }))
      })),
      catchError(error => {
        console.error('Error loading materials:', error);
        return this.getFallbackMaterials(filters, page, limit);
      })
    );
  }

  getMaterialById(id: number): Observable<Material | undefined> {
    return this.http.get<Material>(`${this.apiConfig.ENDPOINTS.MATERIALS}/${id}`).pipe(
      catchError(error => {
        console.error('Error loading material:', error);
        return of(undefined);
      })
    );
  }

  getMetrics(): Observable<MaterialMetrics> {
    return this.http.get<MaterialMetrics>(this.apiConfig.ENDPOINTS.MATERIALS_METRICS).pipe(
      catchError(error => {
        console.error('Error loading metrics:', error);
        return this.getFallbackMetrics();
      })
    );
  }

  createMaterial(material: Omit<Material, 'id' | 'createDate'>): Observable<Material> {
    return this.http.post<Material>(this.apiConfig.ENDPOINTS.MATERIALS, material).pipe(
      catchError(error => {
        console.error('Error creating material:', error);
        throw error;
      })
    );
  }

  updateMaterial(id: number, material: Partial<Material>): Observable<Material> {
    return this.http.put<Material>(`${this.apiConfig.ENDPOINTS.MATERIALS}/${id}`, material).pipe(
      catchError(error => {
        console.error('Error updating material:', error);
        throw error;
      })
    );
  }

  deleteMaterial(id: number): Observable<boolean> {
    return this.http.delete<void>(`${this.apiConfig.ENDPOINTS.MATERIALS}/${id}`).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error deleting material:', error);
        return of(false);
      })
    );
  }

  // Material Composition methods
  getMaterialComposition(materialId: number): Observable<any[]> {
    const url = this.apiConfig.getEndpoint('MATERIAL_COMPOSITION', { id: materialId });
    return this.http.get<any[]>(url).pipe(
      catchError(error => {
        console.error('Error loading composition:', error);
        return of([]);
      })
    );
  }

  updateMaterialComposition(materialId: number, composition: any[]): Observable<any[]> {
    const url = this.apiConfig.getEndpoint('MATERIAL_COMPOSITION', { id: materialId });
    return this.http.put<any[]>(url, { composition }).pipe(
      catchError(error => {
        console.error('Error updating composition:', error);
        throw error;
      })
    );
  }

  // Fallback methods for development/demo
  private getFallbackMaterials(filters?: MaterialFilters, page: number = 1, limit: number = 10): Observable<PaginatedResponse<Material>> {
    // Return empty data when API fails
    return of({
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0
    }).pipe(delay(300));
  }

  private getFallbackMetrics(): Observable<MaterialMetrics> {
    // Return zero metrics when API fails
    return of({
      totalMaterials: 0,
      lowStockCount: 0,
      totalValue: 0,
      activeCount: 0,
      inactiveCount: 0
    }).pipe(delay(300));
  }

  // Recent Activities
  getRecentActivities(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiConfig.ENDPOINTS.MATERIALS}/activities`).pipe(
      catchError(error => {
        console.error('Error loading activities:', error);
        return of([]);
      })
    );
  }
}