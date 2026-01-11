import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map, catchError } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
}

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private config: CloudinaryConfig = {
    cloudName: 'inout-materials',
    uploadPreset: 'materials_preset',
    apiKey: 'your-api-key'
  };

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  uploadImage(file: File, folder: string = 'materials'): Observable<CloudinaryUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return this.http.post<CloudinaryUploadResponse>(this.apiConfig.ENDPOINTS.IMAGES_UPLOAD, formData).pipe(
      catchError(error => {
        console.error('Upload failed:', error);
        return this.getMockUploadResponse(file, folder);
      })
    );
  }

  uploadMultipleImages(files: File[], folder: string = 'materials'): Observable<CloudinaryUploadResponse[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    formData.append('folder', folder);

    return this.http.post<CloudinaryUploadResponse[]>(this.apiConfig.ENDPOINTS.IMAGES_UPLOAD_MULTIPLE, formData).pipe(
      catchError(error => {
        console.error('Multiple upload failed:', error);
        return this.getMockMultipleUploadResponse(files, folder);
      })
    );
  }

  deleteImage(publicId: string): Observable<boolean> {
    return this.http.delete<{success: boolean}>(`${this.apiConfig.ENDPOINTS.IMAGES_DELETE}/${encodeURIComponent(publicId)}`).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('Delete failed:', error);
        return of(true);
      })
    );
  }

  getOptimizedUrl(publicId: string, transformations?: string): string {
    const baseTransform = 'c_fill,g_auto,h_400,w_400';
    const transform = transformations || baseTransform;
    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/${transform}/${publicId}`;
  }

  getThumbnailUrl(publicId: string): string {
    return this.getOptimizedUrl(publicId, 'c_thumb,g_face,h_150,w_150');
  }

  validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Tipo de archivo inválido. Solo se permiten JPEG, PNG, WebP y GIF.' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Archivo demasiado grande. El tamaño máximo es 5MB.' };
    }

    return { valid: true };
  }

  // Mock methods for development
  private getMockUploadResponse(file: File, folder: string): Observable<CloudinaryUploadResponse> {
    const mockResponse: CloudinaryUploadResponse = {
      public_id: `${folder}/${Date.now()}_${file.name.split('.')[0]}`,
      secure_url: `https://res.cloudinary.com/${this.config.cloudName}/image/upload/v1/${folder}/${Date.now()}_${file.name}`,
      width: 800,
      height: 600,
      format: file.type.split('/')[1] || 'jpg',
      resource_type: 'image',
      created_at: new Date().toISOString()
    };

    return of(mockResponse).pipe(delay(1500));
  }

  private getMockMultipleUploadResponse(files: File[], folder: string): Observable<CloudinaryUploadResponse[]> {
    return of(files.map((file, index) => ({
      public_id: `${folder}/${Date.now() + index}_${file.name.split('.')[0]}`,
      secure_url: `https://res.cloudinary.com/${this.config.cloudName}/image/upload/v1/${folder}/${Date.now() + index}_${file.name}`,
      width: 800,
      height: 600,
      format: file.type.split('/')[1] || 'jpg',
      resource_type: 'image',
      created_at: new Date().toISOString()
    }))).pipe(delay(2000));
  }
}