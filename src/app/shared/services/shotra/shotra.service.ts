import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, throwError, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

/**
 * Integración InOut → Shotra.
 *
 * InOut es un canal de captación de demanda para el marketplace de Shotra: el
 * comerciante publica solicitudes de "entrega a domicilio" y gestiona las
 * ofertas (propuestas) de los domiciliarios, todo desde InOut.
 *
 * Autenticación: el comerciante ya tiene el rol `userShotra` (bonus CycloNet al
 * firmar su contrato de InOut). Pero su token de InOut no sirve en Shotra, así
 * que aquí se obtiene un token Shotra vía `POST {authorizaUrl}/switch-app`
 * (usa la sesión InOut vigente, sin pedir contraseña) y se cachea en memoria +
 * sessionStorage. Las llamadas a Shotra adjuntan ESE token explícitamente; el
 * AuthInterceptor de InOut omite estas URLs.
 */
@Injectable({ providedIn: 'root' })
export class ShotraService {
  private readonly shotraApi = environment.shotra.apiUrl;
  // Base de Authoriza normalizada: authorizaUrl puede venir como
  // '.../api' (dev) o '.../api/auth' (prod). Quitamos un '/auth' final si existe
  // y siempre construimos '.../auth/switch-app', para que funcione en ambos.
  private readonly switchAppUrl = `${environment.auth.authorizaUrl.replace(/\/auth\/?$/, '')}/auth/switch-app`;
  private static readonly TOKEN_KEY = 'shotra_auth_token';

  private token: string | null = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.token = sessionStorage.getItem(ShotraService.TOKEN_KEY);
    }
  }

  // ─── Token ─────────────────────────────────────────────────────────────────

  /** Devuelve el token Shotra cacheado o lo obtiene vía switch-app. */
  private ensureToken(forceRefresh = false): Observable<string> {
    if (this.token && !forceRefresh) {
      return of(this.token);
    }
    // switch-app usa el token de InOut (lo inyecta el AuthInterceptor porque la
    // URL es de Authoriza, no de Shotra).
    return this.http
      .post<{ access_token: string }>(this.switchAppUrl, { applicationName: 'Shotra' })
      .pipe(
        switchMap((res) => {
          const t = res?.access_token;
          if (!t) return throwError(() => new Error('No se recibió token de Shotra'));
          this.token = t;
          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(ShotraService.TOKEN_KEY, t);
          }
          return of(t);
        }),
      );
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /**
   * Ejecuta una petición autenticada a Shotra. Si responde 401 (token expirado),
   * refresca el token una vez vía switch-app y reintenta.
   */
  private request<T>(fn: (token: string) => Observable<T>): Observable<T> {
    return this.ensureToken().pipe(
      switchMap((token) => fn(token)),
      catchError((err) => {
        if (err?.status === 401) {
          // Token vencido/inválido: refrescar y reintentar una vez.
          return this.ensureToken(true).pipe(switchMap((token) => fn(token)));
        }
        return throwError(() => err);
      }),
    );
  }

  // ─── Perfil ──────────────────────────────────────────────────────────────

  /**
   * Garantiza que el comerciante tenga perfil en Shotra (findOrCreate). Debe
   * llamarse antes de crear la primera solicitud. Idempotente.
   */
  ensureProfile(): Observable<any> {
    return this.request((token) =>
      this.http.get<any>(`${this.shotraApi}/profiles/me`, { headers: this.authHeaders(token) }),
    );
  }

  // ─── Categorías ────────────────────────────────────────────────────────────

  /** Categoría padre "Delivery" con sus subcategorías (hijos). */
  getDeliveryCategory(): Observable<ShotraCategory> {
    return this.request((token) =>
      this.http.get<ShotraCategory>(`${this.shotraApi}/categories/delivery`, {
        headers: this.authHeaders(token),
      }),
    );
  }

  // ─── Solicitudes ─────────────────────────────────────────────────────────

  /** Publica una solicitud de servicio (entrega a domicilio). */
  createRequest(dto: CreateShotraRequest): Observable<ShotraRequest> {
    return this.request((token) =>
      this.http.post<ShotraRequest>(`${this.shotraApi}/requests`, dto, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /** Mis solicitudes (como solicitante). */
  getMyRequests(): Observable<ShotraRequest[]> {
    return this.request((token) =>
      this.http.get<ShotraRequest[]>(`${this.shotraApi}/requests/mine`, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /** Detalle de una solicitud, incluyendo sus propuestas (ofertas). */
  getRequest(requestId: string): Observable<ShotraRequestDetail> {
    return this.request((token) =>
      this.http.get<ShotraRequestDetail>(`${this.shotraApi}/requests/${requestId}`, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /** Cancelar una solicitud. */
  cancelRequest(requestId: string): Observable<any> {
    return this.request((token) =>
      this.http.patch<any>(
        `${this.shotraApi}/requests/${requestId}/cancel`,
        {},
        { headers: this.authHeaders(token) },
      ),
    );
  }

  // ─── Propuestas / Ofertas ──────────────────────────────────────────────────

  /** Aceptar una propuesta (genera contrato en Shotra). */
  acceptProposal(proposalId: string): Observable<any> {
    return this.request((token) =>
      this.http.patch<any>(
        `${this.shotraApi}/proposals/${proposalId}/accept`,
        {},
        { headers: this.authHeaders(token) },
      ),
    );
  }

  /** Rechazar una propuesta. */
  rejectProposal(proposalId: string): Observable<any> {
    return this.request((token) =>
      this.http.patch<any>(
        `${this.shotraApi}/proposals/${proposalId}/reject`,
        {},
        { headers: this.authHeaders(token) },
      ),
    );
  }

  // ─── Contrato ──────────────────────────────────────────────────────────────

  /** Detalle del contrato (estado, firmas, pago). */
  getContract(contractId: string): Observable<ShotraContract> {
    return this.request((token) =>
      this.http.get<ShotraContract>(`${this.shotraApi}/contracts/${contractId}`, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /** Firmar el contrato como solicitante (respaldo; normalmente ya firma al aceptar). */
  signContract(contractId: string): Observable<any> {
    return this.request((token) =>
      this.http.patch<any>(
        `${this.shotraApi}/contracts/${contractId}/sign`,
        {},
        { headers: this.authHeaders(token) },
      ),
    );
  }

  /**
   * Confirmar recepción del servicio + declarar el pago (cierra el trabajo).
   * Es la acción del solicitante: "recibí a satisfacción y le pagué".
   */
  confirmReceipt(contractId: string, dto: ConfirmReceiptPayload): Observable<any> {
    return this.request((token) =>
      this.http.patch<any>(`${this.shotraApi}/contracts/${contractId}/confirm`, dto, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /**
   * Sube un comprobante de pago (imagen o PDF) a Shotra (Cloudinary) y devuelve
   * la URL segura para adjuntarla como voucherUrl en confirmReceipt.
   */
  uploadVoucher(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.request((token) =>
      this.http.post<{ url: string }>(`${this.shotraApi}/uploads/voucher`, fd, {
        headers: this.authHeaders(token), // no fijar Content-Type: el navegador pone el boundary
      }),
    );
  }

  // ─── Evaluación ────────────────────────────────────────────────────────────

  /** Calificar al domiciliario tras un trabajo completado (1–5 + criterios). */
  rateContract(dto: CreateRatingPayload): Observable<any> {
    return this.request((token) =>
      this.http.post<any>(`${this.shotraApi}/ratings`, dto, {
        headers: this.authHeaders(token),
      }),
    );
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────
  // Solo se habilita una vez la propuesta fue aceptada y AMBAS partes firmaron
  // el contrato (requesterSignedAt + providerSignedAt); el backend valida esto
  // igual, esta capa solo refleja esa regla en la UI.

  /**
   * Mis notificaciones de Shotra (nueva oferta, contrato firmado, evaluación,
   * mensaje de chat, etc.) — la misma fuente que usa el badge del ícono en la
   * app móvil de Shotra. `unread` es el total pendiente para el badge del FAB.
   */
  getNotifications(): Observable<{ items: ShotraNotification[]; unread: number }> {
    return this.request((token) =>
      this.http.get<{ items: ShotraNotification[]; unread: number }>(`${this.shotraApi}/notifications`, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /** Marca una notificación como leída. */
  markNotificationRead(id: string): Observable<any> {
    return this.request((token) =>
      this.http.patch<any>(`${this.shotraApi}/notifications/${id}/read`, {}, { headers: this.authHeaders(token) }),
    );
  }

  /** Marca todas mis notificaciones como leídas. */
  markAllNotificationsRead(): Observable<any> {
    return this.request((token) =>
      this.http.patch<any>(`${this.shotraApi}/notifications/read-all`, {}, { headers: this.authHeaders(token) }),
    );
  }

  /** Vacía (borra) todas mis notificaciones. */
  clearAllNotifications(): Observable<any> {
    return this.request((token) =>
      this.http.delete<any>(`${this.shotraApi}/notifications`, { headers: this.authHeaders(token) }),
    );
  }

  /** Mis conversaciones activas (una por solicitud con contrato firmado por ambas partes). */
  getConversations(): Observable<ShotraConversation[]> {
    return this.request((token) =>
      this.http.get<ShotraConversation[]>(`${this.shotraApi}/messaging/conversations`, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /** Mensajes de la conversación de una solicitud. */
  getMessages(requestId: string): Observable<ShotraMessage[]> {
    return this.request((token) =>
      this.http.get<ShotraMessage[]>(`${this.shotraApi}/messaging/${requestId}`, {
        headers: this.authHeaders(token),
      }),
    );
  }

  /** Envía un mensaje en el contexto de una solicitud. */
  sendMessage(requestId: string, content: string): Observable<ShotraMessage> {
    return this.request((token) =>
      this.http.post<ShotraMessage>(
        `${this.shotraApi}/messaging`,
        { requestId, content, type: 'TEXT' },
        { headers: this.authHeaders(token) },
      ),
    );
  }
}

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface ShotraCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  // Si la categoría implica trayecto (origen → destino, ej. domicilios).
  requiresRoute?: boolean;
  children?: ShotraCategory[];
}

export interface CreateShotraRequest {
  categoryId: string;
  title: string;
  description: string;
  budgetMin?: number;
  budgetMax?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  // Origen del trayecto (recogida). Solo aplica a categorías con requiresRoute.
  originLatitude?: number;
  originLongitude?: number;
  originAddress?: string;
  isRemote?: boolean;
  scheduledAt?: string;
  isUrgent?: boolean;
}

export interface ShotraRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  address?: string;
  budgetMin?: number;
  budgetMax?: number;
  isUrgent?: boolean;
  scheduledAt?: string;
  createdAt: string;
  category?: ShotraCategory;
  _count?: { proposals: number };
  // Contrato asociado (si ya se aceptó una oferta). Su estado refleja el ciclo
  // real y puede ir por delante de `status`.
  contract?: { id: string; code: string; status: string };
}

export interface ShotraProposal {
  id: string;
  price: number;
  currency: string;
  description: string;
  estimatedTime?: string;
  status: string;
  createdAt: string;
  provider?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    averageRating?: number;
    completedJobs?: number;
  };
  // Hasta 3 fotos que el domiciliario eligió mostrar en esta oferta puntual.
  images?: { id: string; imageUrl: string; title: string }[];
}

export interface ShotraRequestDetail extends ShotraRequest {
  proposals: ShotraProposal[];
  contract?: { id: string; code: string; status: string };
}

export type ShotraPaymentMethod = 'CASH' | 'TRANSFER' | 'NEQUI' | 'DAVIPLATA' | 'PSE' | 'OTHER';

export interface ConfirmReceiptPayload {
  method: ShotraPaymentMethod;
  amount?: number;
  note?: string;
  voucherUrl?: string;
}

export interface ShotraRating {
  id: string;
  authorId: string;
  targetId: string;
  score: number;
  comment?: string | null;
}

export interface ShotraContract {
  id: string;
  code: string;
  status: string; // PENDING | SIGNED | IN_PROGRESS | PENDING_CONFIRMATION | COMPLETED | EVALUATED | DISPUTED | CANCELLED
  agreedPrice: number;
  currency?: string;
  requestId?: string;
  requesterId?: string;
  providerId?: string;
  requesterSignedAt?: string | null;
  providerSignedAt?: string | null;
  providerCompletedAt?: string | null;
  requesterConfirmedAt?: string | null;
  completedAt?: string | null;
  ratings?: ShotraRating[];
}

export interface ShotraNotification {
  id: string;
  type: string; // NEW_PROPOSAL | PROPOSAL_ACCEPTED | PROPOSAL_REJECTED | CONTRACT_SIGNED | CONTRACT_COMPLETED | NEW_RATING | NEW_MESSAGE
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

export interface ShotraConversation {
  requestId: string;
  lastMessage: ShotraMessage;
  unreadCount: number;
  closed: boolean;
}

export interface ShotraMessage {
  id: string;
  requestId: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  readAt?: string | null;
  sender?: { id?: string; displayName?: string; avatarUrl?: string };
}

export interface CreateRatingPayload {
  contractId: string;
  score: number;
  comment?: string;
  quality?: number;
  punctuality?: number;
  communication?: number;
}
