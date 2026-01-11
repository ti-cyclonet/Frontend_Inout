import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  
  // InOut Backend Configuration
  private readonly INOUT_API_BASE_URL = environment.apiUrl;
  
  // API Endpoints
  public readonly ENDPOINTS = {
    // Materials
    MATERIALS: `${this.INOUT_API_BASE_URL}/materials`,
    MATERIALS_METRICS: `${this.INOUT_API_BASE_URL}/materials/metrics`,
    
    // Images (Cloudinary integration)
    IMAGES_UPLOAD: `${this.INOUT_API_BASE_URL}/images/upload`,
    IMAGES_UPLOAD_MULTIPLE: `${this.INOUT_API_BASE_URL}/images/upload-multiple`,
    IMAGES_DELETE: `${this.INOUT_API_BASE_URL}/images`,
    
    // Material Composition
    MATERIAL_COMPOSITION: `${this.INOUT_API_BASE_URL}/materials/{id}/composition`,
    
    // Locations/Warehouses
    LOCATIONS: `${this.INOUT_API_BASE_URL}/locations`,
    
    // Reports
    REPORTS: `${this.INOUT_API_BASE_URL}/reports/materials`
  };

  constructor() {}

  getEndpoint(key: keyof typeof this.ENDPOINTS, params?: { [key: string]: string | number }): string {
    let url = this.ENDPOINTS[key];
    
    if (params) {
      Object.keys(params).forEach(param => {
        url = url.replace(`{${param}}`, params[param].toString());
      });
    }
    
    return url;
  }

  isInOutApiUrl(url: string): boolean {
    return url.startsWith(this.INOUT_API_BASE_URL);
  }

  get baseUrl(): string {
    return this.INOUT_API_BASE_URL;
  }
}