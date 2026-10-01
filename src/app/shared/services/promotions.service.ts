import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PromotionTargetType = 'product' | 'material' | 'material_t' | 'kit' | 'combo' | 'category';
export type PromotionState = 'inactive' | 'scheduled' | 'expired' | 'live' | 'waiting';

export interface PromotionTarget {
  type: PromotionTargetType;
  id: string;
  name?: string | null;
}

export interface PromotionView {
  strId: string;
  strName: string;
  strDescription: string | null;
  strStatus: 'active' | 'inactive';
  state: PromotionState;
  label: string;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  scope: 'ITEMS' | 'ALL';
  targets: PromotionTarget[];
  channel: 'ALL' | 'POS' | 'MARKETPLACE';
  startDate: string;
  endDate: string | null;
  weekdays: number[] | null;
  timeFrom: string | null;
  timeTo: string | null;
}

export interface PromotionInput {
  name: string;
  description?: string;
  discountType: 'PERCENT' | 'FIXED';
  value: number;
  scope: 'ITEMS' | 'ALL';
  targets: { type: PromotionTargetType; id: string }[];
  channel: 'ALL' | 'POS' | 'MARKETPLACE';
  startDate: string;
  endDate: string | null;
  weekdays: number[] | null;
  timeFrom: string | null;
  timeTo: string | null;
}

/** Promociones (backend: /promotions). */
@Injectable({ providedIn: 'root' })
export class PromotionsService {
  private readonly baseUrl = `${environment.apiUrl}/promotions`;

  constructor(private http: HttpClient) {}

  list(): Observable<PromotionView[]> {
    return this.http.get<PromotionView[]>(this.baseUrl);
  }

  create(input: PromotionInput): Observable<PromotionView> {
    return this.http.post<PromotionView>(this.baseUrl, input);
  }

  update(id: string, input: Partial<PromotionInput> & { status?: 'active' | 'inactive' }): Observable<PromotionView> {
    return this.http.patch<PromotionView>(`${this.baseUrl}/${id}`, input);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
