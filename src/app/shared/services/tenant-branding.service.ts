import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TenantBranding {
  tenantId: string;
  logoUrl: string | null;
  /** PNG acotado (Cloudinary), para PDFs. */
  logoPdfUrl: string | null;
  /** Formato automático, para mostrar en pantalla. */
  logoWebUrl: string | null;
  updatedAt: string | null;
}

/** Logo listo para jsPDF: data URL + proporción para no deformarlo. */
export interface PdfLogo {
  dataUrl: string;
  ratio: number; // ancho / alto
}

/**
 * Identidad visual del negocio (logo). Se configura en Configuración >
 * Identidad del negocio y se usa en documentos PDF, MarketPlace, etc.
 */
@Injectable({ providedIn: 'root' })
export class TenantBrandingService {
  private readonly baseUrl = `${environment.apiUrl}/tenant-branding`;
  private readonly brandingSubject = new BehaviorSubject<TenantBranding | null>(null);
  /** Branding del tenant en sesión (null mientras no se haya cargado). */
  readonly branding$ = this.brandingSubject.asObservable();

  private loading: Promise<TenantBranding | null> | null = null;
  private pdfLogoCache: { url: string; logo: PdfLogo | null } | null = null;
  /** Token con el que se cargó: si cambia (otro usuario/contrato), se recarga. */
  private loadedForToken: string | null = null;

  constructor(private http: HttpClient) {}

  /** Carga (una vez) el branding del tenant en sesión. */
  load(force = false): Promise<TenantBranding | null> {
    const token = currentToken();
    if (token !== this.loadedForToken) {
      this.clear();
      force = true;
    }
    if (!force && this.brandingSubject.value) return Promise.resolve(this.brandingSubject.value);
    if (!force && this.loading) return this.loading;
    this.loading = firstValueFrom(this.http.get<TenantBranding>(`${this.baseUrl}/me`))
      .then((b) => {
        this.loadedForToken = token;
        this.brandingSubject.next(b);
        return b;
      })
      .catch(() => null)
      .finally(() => (this.loading = null));
    return this.loading;
  }

  /** Branding público de una tienda (MarketPlace, sin sesión). */
  getPublic(tenantId: string): Observable<TenantBranding> {
    return this.http.get<TenantBranding>(`${this.baseUrl}/${tenantId}`);
  }

  uploadLogo(file: File): Observable<TenantBranding> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<TenantBranding>(`${this.baseUrl}/logo`, form).pipe(tap((b) => this.brandingSubject.next(b)));
  }

  removeLogo(): Observable<TenantBranding> {
    return this.http.delete<TenantBranding>(`${this.baseUrl}/logo`).pipe(tap((b) => this.brandingSubject.next(b)));
  }

  /** Limpia el estado al cerrar sesión / cambiar de tenant. */
  clear(): void {
    this.brandingSubject.next(null);
    this.pdfLogoCache = null;
    this.loadedForToken = null;
  }

  /**
   * Logo del tenant en sesión listo para jsPDF. null si no hay logo o no se
   * pudo descargar: el documento se genera igual, sin logo.
   */
  async getPdfLogo(): Promise<PdfLogo | null> {
    const branding = await this.load();
    const url = branding?.logoPdfUrl;
    if (!url) return null;
    if (this.pdfLogoCache?.url === url) return this.pdfLogoCache.logo;
    const logo = await loadImageAsDataUrl(url);
    this.pdfLogoCache = { url, logo };
    return logo;
  }
}

function currentToken(): string | null {
  try {
    return typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;
  } catch {
    return null;
  }
}

async function loadImageAsDataUrl(url: string): Promise<PdfLogo | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1);
      img.onerror = () => resolve(1);
      img.src = dataUrl;
    });
    return { dataUrl, ratio };
  } catch {
    return null;
  }
}

/**
 * Dibuja el logo en una tarjeta blanca alineada a la derecha (sobre la franja
 * azul de los encabezados). Devuelve el ancho ocupado (0 si no hay logo) para
 * correr el texto que va a su izquierda.
 */
export function drawPdfLogo(doc: any, logo: PdfLogo | null, rightX: number, topY: number, boxSize: number): number {
  if (!logo) return 0;
  const pad = 2;
  const max = boxSize - pad * 2;
  const w = logo.ratio >= 1 ? max : max * logo.ratio;
  const h = logo.ratio >= 1 ? max / logo.ratio : max;
  const boxX = rightX - boxSize;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, topY, boxSize, boxSize, 2, 2, 'F');
  try {
    doc.addImage(logo.dataUrl, 'PNG', boxX + (boxSize - w) / 2, topY + (boxSize - h) / 2, w, h);
  } catch {
    return 0;
  }
  return boxSize + 4;
}
