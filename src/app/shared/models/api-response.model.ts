// Standard API Response interfaces for InOut Backend

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ApiError[];
  timestamp: string;
  path: string;
}

export interface ApiError {
  field?: string;
  code: string;
  message: string;
  value?: any;
}

export interface PaginatedApiResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Material specific responses
export interface MaterialResponse extends ApiResponse<Material> {}

export interface MaterialListResponse extends PaginatedApiResponse<Material> {}

export interface MaterialMetricsResponse extends ApiResponse<MaterialMetrics> {
  data: MaterialMetrics;
}

// Image upload responses
export interface ImageUploadResponse extends ApiResponse<CloudinaryUploadResponse> {}

export interface MultipleImageUploadResponse extends ApiResponse<CloudinaryUploadResponse[]> {}

// Composition responses
export interface MaterialCompositionResponse extends ApiResponse<MaterialComposition[]> {}

// Standard error response
export interface ErrorResponse extends ApiResponse<null> {
  success: false;
  data: null;
  errors: ApiError[];
}

// Import types from existing models
import { Material, MaterialMetrics, MaterialComposition } from './material.model';
import { CloudinaryUploadResponse } from '../services/cloudinary.service';