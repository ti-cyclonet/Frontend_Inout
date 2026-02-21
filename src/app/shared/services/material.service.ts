import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
import { delay, map, catchError, switchMap } from 'rxjs/operators';
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
      if (filters.search && filters.search.trim()) {
        params = params.set('search', filters.search.trim());
      }
      if (filters.status && filters.status !== 'all') {
        params = params.set('status', filters.status);
      }
      if (filters.stockStatus && filters.stockStatus !== 'all') {
        params = params.set('stockStatus', filters.stockStatus);
      }
      if (filters.ubicacion && filters.ubicacion.length > 0) {
        params = params.set('ubicacion', filters.ubicacion.join(','));
      }
      if (filters.categoryId && filters.categoryId !== '') {
        params = params.set('category', filters.categoryId);
      }
    }

    return this.http.get<any>(this.apiConfig.ENDPOINTS.MATERIALS, {
      params
    }).pipe(
      map(response => ({
        ...response,
        data: response.data.map((item: any) => ({
          id: item.strId,
          strCode: item.strCode,
          name: item.strName,
          description: item.strDescription,
          measurementUnit: item.strUnitMeasure,
          dischargeUnit: item.strDischargeUnit,
          price: item.fltPrice,
          stockMax: item.ingMaxStock,
          stockMin: item.ingMinStock,
          currentStock: item.ingQuantity,
          status: item.strStatus.toLowerCase(),
          ubicacion: item.strLocation,
          location: item.strLocation,
          createDate: new Date(item.dtmCreationDate),
          updateDate: new Date(item.dtmUpdateDate || item.dtmCreationDate),
          images: item.images || [],
          categoryId: item.categoryId || item.category?.id
        }))
      })),
      catchError(error => {
        return this.getFallbackMaterials(filters, page, limit);
      })
    );
  }

  getMaterialById(id: number): Observable<Material | undefined> {
    return this.http.get<Material>(`${this.apiConfig.ENDPOINTS.MATERIALS}/${id}`).pipe(
      catchError(error => {
        return of(undefined);
      })
    );
  }

  getMetrics(): Observable<MaterialMetrics> {
    return this.http.get<MaterialMetrics>(this.apiConfig.ENDPOINTS.MATERIALS_METRICS).pipe(
      catchError(error => {
        return this.getFallbackMetrics();
      })
    );
  }

  createMaterial(material: Omit<Material, 'id' | 'createDate'>): Observable<Material> {
    return this.http.post<Material>(this.apiConfig.ENDPOINTS.MATERIALS, material).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  createTransformedMaterial(materialData: any): Observable<Material> {
    return this.http.post<Material>(`${this.apiConfig.baseUrl}/materials-t`, materialData).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  updateTransformedMaterial(id: number, materialData: any): Observable<Material> {
    return this.http.patch<Material>(`${this.apiConfig.baseUrl}/materials-t/${id}`, materialData).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  getTransformedMaterialById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiConfig.baseUrl}/materials-t/${id}`).pipe(
      switchMap((material: any) => 
        this.http.get<any[]>(`${this.apiConfig.baseUrl}/materials-t/${id}/compositions`).pipe(
          catchError(() => of([])),
          map(compositions => ({ ...material, compositions }))
        )
      ),
      catchError(error => {
        throw error;
      })
    );
  }

  updateMaterial(id: number, material: Partial<Material>): Observable<Material> {
    return this.http.patch<Material>(`${this.apiConfig.ENDPOINTS.MATERIALS}/${id}`, material).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  deleteMaterial(id: number): Observable<boolean> {
    return this.http.delete<void>(`${this.apiConfig.ENDPOINTS.MATERIALS}/${id}`).pipe(
      map(() => true),
      catchError(error => {
        return of(false);
      })
    );
  }

  // Material Composition methods
  getMaterialComposition(materialId: number): Observable<any[]> {
    const url = this.apiConfig.getEndpoint('MATERIAL_COMPOSITION', { id: materialId });
    return this.http.get<any[]>(url).pipe(
      catchError(error => {
        return of([]);
      })
    );
  }

  updateMaterialComposition(materialId: number, composition: any[]): Observable<any[]> {
    const url = this.apiConfig.getEndpoint('MATERIAL_COMPOSITION', { id: materialId });
    return this.http.put<any[]>(url, { composition }).pipe(
      catchError(error => {
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

  getTransformedMaterials(): Observable<any[]> {
    return this.http.get<any>(`${this.apiConfig.baseUrl}/materials-t`).pipe(
      switchMap((response: any): Observable<any[]> => {
        const materials = Array.isArray(response) ? response : (response.data || []);
        
        if (materials.length === 0) {
          return of([]);
        }
        
        const materialRequests = materials.map((material: any) => 
          this.http.get<any[]>(`${this.apiConfig.baseUrl}/materials-t/${material.strId}/compositions`).pipe(
            catchError(() => of([])),
            map(compositions => ({ 
              ...material, 
              strCode: material.strCode,
              compositions 
            }))
          )
        );
        
        return forkJoin(materialRequests) as Observable<any[]>;
      }),
      catchError(() => of([]))
    );
  }

  // Recent Activities
  getRecentActivities(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiConfig.ENDPOINTS.MATERIALS}/activities`).pipe(
      catchError(error => {
        return of([]);
      })
    );
  }

  // Bulk Upload
  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiConfig.ENDPOINTS.MATERIALS}/template/download`, {
      responseType: 'blob'
    });
  }

  bulkValidate(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiConfig.ENDPOINTS.MATERIALS}/bulk-validate`, formData);
  }

  bulkUpload(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiConfig.ENDPOINTS.MATERIALS}/bulk-upload`, formData);
  }
}