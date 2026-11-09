import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Igual al mensaje del backend mientras CycloNet define el proveedor tecnológico. */
export const EINVOICING_NOT_AVAILABLE =
  'La facturación electrónica está en configuración y todavía no está disponible. Te avisaremos cuando puedas activarla.';

export interface EinvoicingTier { code: 'BASICO' | 'MEDIO' | 'ALTO'; name: string; includedUnits: number; monthly: number | null }

export interface EinvoicingStatus {
  available: boolean;
  provider: string | null;
  message: string | null;
  supports: string[];
  catalog: { code: string; name: string; tiers: EinvoicingTier[]; extraUnit: number | null; termsVersion: string; pricesDefined: boolean };
  addon: null | {
    status: 'SOLICITADO' | 'ACTIVO';
    tier: string;
    includedUnits: number;
    monthlyValue: number | null;
    extraUnitValue: number | null;
    requestedAt: string;
    activatedAt: string | null;
  };
  issuer: any | null;
  issuerErrors: string[];
  resolutions: {
    id: string; docType: string; resolutionNumber: string | null; prefix: string; rangeFrom: number; rangeTo: number;
    lastNumber: number; validFrom: string; validTo: string; warning: string | null;
  }[];
  usage: { month: string; used: number; included: number };
}

export interface SaleEinvoiceDoc {
  id: string; type: string; fullNumber: string; status: string; cufe: string | null; qrData: string | null;
  pdfUrl: string | null; xmlUrl: string | null; total: number; issueDate: string; messages: string[];
}

/** Configuración › Facturación electrónica (backend de InOut → núcleo en Authoriza). */
@Injectable({ providedIn: 'root' })
export class EinvoicingService {
  private readonly base = `${environment.apiUrl}/einvoicing`;

  constructor(private http: HttpClient) {}

  status(): Observable<EinvoicingStatus> {
    return this.http.get<EinvoicingStatus>(`${this.base}/status`);
  }

  request(tier: string): Observable<EinvoicingStatus> {
    return this.http.post<EinvoicingStatus>(`${this.base}/request`, { tier, acceptTerms: true });
  }

  cancel(): Observable<EinvoicingStatus> {
    return this.http.post<EinvoicingStatus>(`${this.base}/cancel`, {});
  }

  saveIssuer(data: any): Observable<EinvoicingStatus> {
    return this.http.put<EinvoicingStatus>(`${this.base}/issuer`, data);
  }

  addResolution(data: any): Observable<EinvoicingStatus> {
    return this.http.post<EinvoicingStatus>(`${this.base}/resolutions`, data);
  }

  saleDocuments(saleId: string): Observable<SaleEinvoiceDoc[]> {
    return this.http.get<SaleEinvoiceDoc[]>(`${this.base}/sales/${encodeURIComponent(saleId)}`);
  }

  retrySale(saleId: string): Observable<SaleEinvoiceDoc[]> {
    return this.http.post<SaleEinvoiceDoc[]>(`${this.base}/sales/${encodeURIComponent(saleId)}/retry`, {});
  }
}

/** Dígito de verificación del NIT (igual al backend), para mostrarlo al escribir. */
export function nitCheckDigit(nit: string): number | null {
  const d = String(nit || '').replace(/\D/g, '');
  if (!d || d.length > 15) return null;
  const w = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let s = 0;
  for (let i = 0; i < d.length; i++) s += Number(d[d.length - 1 - i]) * w[i];
  const r = s % 11;
  return r > 1 ? 11 - r : r;
}
