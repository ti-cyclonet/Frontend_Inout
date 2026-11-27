import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Igual que el backend (product-reviews-rules.ts). */
export const REVIEW_LIMITS = { authorName: 60, comment: 1000, phone: 20, reply: 600 } as const;

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN';

export interface RatingSummary { average: number; count: number }

export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
}

export interface PublicReviewList { enabled: boolean; summary: RatingSummary; reviews: PublicReview[] }

export interface NewReview { rating: number; comment: string; authorName: string; authorPhone?: string; consentPublish: boolean }

export interface ReviewSettings { enabled: boolean; autoPublish: boolean }

export interface AdminReview {
  id: string;
  itemId: string;
  itemName: string;
  rating: number;
  comment: string;
  authorName: string;
  authorPhone: string | null;
  status: ReviewStatus;
  reply: string | null;
  repliedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface AdminReviewList { counts: Record<ReviewStatus, number>; reviews: AdminReview[] }

/** Opiniones de los clientes sobre los ítems de la tienda (backend: product-reviews). */
@Injectable({ providedIn: 'root' })
export class ProductReviewsApi {
  private base = `${environment.apiUrl}/product-reviews`;

  constructor(private http: HttpClient) {}

  // Tienda (público)
  list(tenantId: string, itemId: string): Observable<PublicReviewList> {
    return this.http.get<PublicReviewList>(`${this.base}/public/${tenantId}/items/${itemId}`);
  }

  create(tenantId: string, itemId: string, review: NewReview): Observable<{ status: ReviewStatus; message: string }> {
    return this.http.post<{ status: ReviewStatus; message: string }>(`${this.base}/public/${tenantId}/items/${itemId}`, review);
  }

  summary(tenantId: string): Observable<Record<string, RatingSummary>> {
    return this.http.get<Record<string, RatingSummary>>(`${this.base}/public/${tenantId}/summary`);
  }

  // Panel del negocio
  settings(): Observable<ReviewSettings> {
    return this.http.get<ReviewSettings>(`${this.base}/settings`);
  }

  updateSettings(settings: Partial<ReviewSettings>): Observable<ReviewSettings> {
    return this.http.patch<ReviewSettings>(`${this.base}/settings`, settings);
  }

  adminList(status?: ReviewStatus): Observable<AdminReviewList> {
    return this.http.get<AdminReviewList>(this.base, status ? { params: { status } } : {});
  }

  update(id: string, change: { status?: ReviewStatus; reply?: string | null }) {
    return this.http.patch<Pick<AdminReview, 'id' | 'status' | 'reply' | 'repliedAt' | 'publishedAt'>>(`${this.base}/${id}`, change);
  }

  remove(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }
}

/** "★★★★☆" para una calificación (redondeada a la estrella más cercana). */
export function starsText(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating || 0)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/** "4,5" (la app no registra el locale es: se formatea aquí). */
export function averageText(avg: number): string {
  return (Number(avg) || 0).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "27 nov 2026" en hora de Colombia. */
export function dayText(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

/** Mensaje de error del backend ("message" puede ser texto o lista). */
export function apiError(err: any, fallback: string): string {
  const m = err?.error?.message;
  return (Array.isArray(m) ? m[0] : m) || fallback;
}
