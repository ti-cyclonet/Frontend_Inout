import { Component, OnDestroy, ElementRef, ViewChild, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Import SOLO DE TIPOS: se borra en compilación, no mete leaflet en el bundle.
// El módulo real se carga en runtime (import() dinámico) en loadLeaflet(), y
// solo cuando el comerciante abre el formulario — así los ~45KB gzip de
// Leaflet no viajan en cada carga de InOut (este componente vive en el layout
// global, no en una ruta lazy).
import type * as Leaflet from 'leaflet';
import Swal from 'sweetalert2';
import {
  ShotraService,
  ShotraCategory,
  ShotraRequest,
  ShotraRequestDetail,
  ShotraProposal,
  ShotraContract,
  ShotraPaymentMethod,
  ShotraMessage,
  ShotraConversation,
  ShotraNotification,
  CreateShotraRequest,
} from '../../../shared/services/shotra/shotra.service';
import { UiPrefsService } from '../../../shared/services/ui-prefs/ui-prefs.service';
import { Subscription } from 'rxjs';

/**
 * Pestaña "Domicilios" del módulo Comercial de InOut.
 *
 * Permite al comerciante publicar solicitudes de "entrega a domicilio" en el
 * marketplace de Shotra y gestionar las ofertas (propuestas) de los
 * domiciliarios, sin salir de InOut. Todo se apoya en ShotraService (token
 * Shotra vía switch-app).
 */
@Component({
  selector: 'app-delivery-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery-request.component.html',
  styleUrls: ['./delivery-request.component.css'],
})
export class DeliveryRequestComponent implements OnDestroy {
  // Panel flotante (drawer): se comporta como una "app" aparte (Shotra) montada
  // sobre InOut. Cerrado por defecto; se abre desde el FAB.
  open = false;
  private initialized = false;

  // Visibilidad del FAB según preferencia de Configuración (localStorage).
  fabEnabled = true;
  private prefSub?: Subscription;

  // Selector de categoría estilo Shotra (bottom-sheet con buscador).
  showCategorySheet = false;
  categorySearch = '';

  // ─── Polling de la lista en tiempo (casi) real ──────────────────────────────
  // Mientras el panel está abierto, se refresca la lista periódicamente.
  private pollTimer: any = null;
  private readonly POLL_MS = 12000; // cada 12s
  private audioCtx: AudioContext | null = null;

  // Estado general
  loading = false;
  error: string | null = null;

  // Subcategorías de delivery (para el select)
  subcategories: ShotraCategory[] = [];

  // Lista de mis solicitudes
  requests: ShotraRequest[] = [];

  // Detalle abierto (con propuestas)
  selectedRequest: ShotraRequestDetail | null = null;
  loadingDetail = false;

  // Vista ampliada de una foto de oferta
  previewImageUrl: string | null = null;

  // Contrato de la solicitud abierta (si existe) + flujo de cierre
  contract: ShotraContract | null = null;
  showConfirmForm = false;
  confirming = false;
  uploadingVoucher = false;
  payment: { method: ShotraPaymentMethod; amount?: number; note?: string; voucherUrl?: string } = { method: 'CASH' };

  // ─── Chat (solo habilitado cuando ambas partes firmaron el contrato) ───────
  showChat = false;
  chatMessages: ShotraMessage[] = [];
  chatText = '';
  loadingChat = false;
  sendingChat = false;
  private chatPollTimer: any = null;
  private readonly CHAT_POLL_MS = 5000;

  // ─── Campana de notificaciones (badge + sonido) ─────────────────────────────
  // Independiente del polling de la lista: corre mientras el módulo esté
  // inicializado (aunque el panel/drawer esté cerrado), para que el badge del
  // FAB y el sonido avisen aunque el comerciante no tenga el panel abierto.
  // totalPendingNotifications = TODAS las novedades (ofertas, firmas,
  // evaluaciones, mensajes) — mismo criterio que el badge de Android en la
  // app de Shotra. conversationsByRequest sigue siendo solo para el badge de
  // chat por tarjeta.
  totalPendingNotifications = 0;
  conversationsByRequest: Record<string, ShotraConversation> = {};
  private knownNotificationIds = new Set<string>();
  private notificationsBaselineSet = false;

  // ─── Vista de notificaciones (abierta desde la campana) ─────────────────────
  showNotifications = false;
  notificationItems: ShotraNotification[] = [];
  private bellPollTimer: any = null;
  private readonly BELL_POLL_MS = 12000;

  // Evaluación del domiciliario (tras completar el trabajo)
  showRatingForm = false;
  rating = false;
  ratingForm: { score: number; comment?: string } = { score: 5 };
  readonly stars = [1, 2, 3, 4, 5];
  readonly paymentMethods: { value: ShotraPaymentMethod; label: string; icon: string }[] = [
    { value: 'CASH', label: 'Efectivo', icon: '💵' },
    { value: 'TRANSFER', label: 'Transferencia', icon: '🏦' },
    { value: 'NEQUI', label: 'Nequi', icon: '📱' },
    { value: 'DAVIPLATA', label: 'Daviplata', icon: '📲' },
    { value: 'PSE', label: 'PSE', icon: '💳' },
    { value: 'OTHER', label: 'Otro', icon: '💰' },
  ];

  selectPayMethod(m: ShotraPaymentMethod): void {
    this.payment.method = m;
  }

  // Formulario
  showForm = false;
  submitting = false;
  form: CreateShotraRequest = this.emptyForm();

  constructor(
    private shotra: ShotraService,
    private uiPrefs: UiPrefsService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.fabEnabled = this.uiPrefs.getShowDeliveryFab();
    // Reacciona en vivo al toggle de Configuración: si se apaga con el panel
    // abierto, se cierra.
    this.prefSub = this.uiPrefs.showDeliveryFab$.subscribe((v) => {
      this.fabEnabled = v;
      if (!v && this.open) this.closePanel();
    });
  }

  /** Abre el panel de Shotra. La primera vez inicializa (perfil + datos). */
  openPanel(): void {
    this.open = true;
    if (!this.initialized) {
      this.initialized = true;
      this.init();
    } else {
      // Ya inicializado: refrescar al reabrir para traer ofertas nuevas.
      this.refreshRequestsSilently();
    }
    this.startPolling();
  }

  /** Cierra el panel (no descarta el estado ya cargado). */
  closePanel(): void {
    this.open = false;
    this.showForm = false;
    this.selectedRequest = null;
    this.showNotifications = false;
    this.stopPolling();
    this.closeChat();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopChatPolling();
    this.stopBellPolling();
    this.prefSub?.unsubscribe();
    this.destroyMap();
  }

  // ─── Polling ─────────────────────────────────────────────────────────────

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      // Solo refrescar la lista principal (no cuando hay un sheet abierto encima,
      // para no perturbar el formulario a medio llenar).
      if (this.open && !this.showForm) {
        this.refreshRequestsSilently();
      }
    }, this.POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Refresca la lista SIN mostrar el spinner (para no parpadear en cada poll).
   * El sonido de "nueva oferta" ya no se detecta aquí por delta de conteo:
   * lo dispara refreshNotifications() a partir del feed real de notificaciones
   * de Shotra (más preciso, y funciona aunque el panel esté cerrado).
   */
  private refreshRequestsSilently(): void {
    this.shotra.getMyRequests().subscribe({
      next: (reqs) => {
        this.requests = reqs || [];
        this.error = null;
      },
      error: () => {
        // Silencioso: un fallo de poll no debe romper la vista.
      },
    });
  }

  /** Beep sintetizado con Web Audio API (no requiere archivo de audio). */
  private playNotification(): void {
    try {
      if (typeof window === 'undefined') return;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      const ctx = this.audioCtx!;
      if (ctx.state === 'suspended') ctx.resume();

      // Dos tonos cortos ascendentes (ding-ding), agradable y discreto.
      const now = ctx.currentTime;
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.16;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {
      // Si el navegador bloquea el audio (autoplay policy), se ignora.
    }
  }

  /** Beep de un solo tono agudo para mensajes de chat (distinto del "ding-ding" de ofertas). */
  private playChatNotification(): void {
    try {
      if (typeof window === 'undefined') return;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      const ctx = this.audioCtx!;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1320;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Si el navegador bloquea el audio (autoplay policy), se ignora.
    }
  }

  /** Reintenta la conexión/carga inicial (botón de la alerta de error). */
  retry(): void {
    this.init();
  }

  private emptyForm(): CreateShotraRequest {
    return {
      categoryId: '',
      title: '',
      description: '',
      budgetMin: undefined,
      budgetMax: undefined,
      address: '',
      latitude: undefined,
      longitude: undefined,
      isUrgent: false,
      scheduledAt: undefined,
    };
  }

  /** Garantiza perfil Shotra, carga subcategorías y mis solicitudes. */
  private init(): void {
    this.loading = true;
    this.error = null;
    // ensureProfile crea el perfil Shotra si no existe (findOrCreate).
    this.shotra.ensureProfile().subscribe({
      next: () => {
        this.loadCategories();
        this.loadRequests();
        this.refreshNotifications();
        this.startBellPolling();
      },
      error: (err) => {
        this.loading = false;
        this.error = this.readError(err, 'No se pudo conectar con Shotra. Verifica que tengas acceso.');
      },
    });
  }

  // ─── Campana de notificaciones (badge del FAB + sonido) ────────────────────
  // Independiente del panel abierto/cerrado: corre desde que el módulo se
  // inicializa por primera vez, igual que en la app de Shotra (mismo criterio
  // de "badge de Android" — total de pendientes, no solo chat).

  private startBellPolling(): void {
    this.stopBellPolling();
    this.bellPollTimer = setInterval(() => this.refreshNotifications(), this.BELL_POLL_MS);
  }

  private stopBellPolling(): void {
    if (this.bellPollTimer) {
      clearInterval(this.bellPollTimer);
      this.bellPollTimer = null;
    }
  }

  /**
   * Trae el feed de notificaciones de Shotra (nueva oferta, contrato firmado,
   * evaluación, mensaje de chat...) — la misma fuente que alimenta el badge
   * del ícono en la app móvil — y las conversaciones (para el badge por
   * tarjeta). Detecta notificaciones nuevas por id (no por delta de conteo,
   * más preciso) y suena la alerta que corresponda según el tipo. La primera
   * carga solo establece la base, sin sonar.
   */
  private refreshNotifications(): void {
    this.shotra.getNotifications().subscribe({
      next: (res) => {
        const list = res?.items || [];
        const fresh = list.filter((n) => !this.knownNotificationIds.has(n.id));
        list.forEach((n) => this.knownNotificationIds.add(n.id));

        if (this.notificationsBaselineSet) {
          const freshUnread = fresh.filter((n) => !n.read);
          if (freshUnread.length > 0) {
            // Sonido distinto para mensajes de chat vs. el resto (nueva
            // oferta, contrato firmado, evaluación).
            if (freshUnread[0].type === 'NEW_MESSAGE') {
              this.playChatNotification();
            } else {
              this.playNotification();
            }
          }
        }
        this.notificationsBaselineSet = true;
        this.totalPendingNotifications = res?.unread || 0;
        this.notificationItems = list;
      },
      error: () => {
        // Silencioso: un fallo de poll no debe romper la vista.
      },
    });

    // Badge por tarjeta (específico de chat): sigue viniendo de conversations.
    this.shotra.getConversations().subscribe({
      next: (convs) => {
        const map: Record<string, ShotraConversation> = {};
        for (const c of convs || []) {
          map[c.requestId] = c;
        }
        this.conversationsByRequest = map;
      },
      error: () => {},
    });
  }

  /** Badge de no leídos para la tarjeta de una solicitud puntual. */
  unreadCountFor(req: ShotraRequest): number {
    return this.conversationsByRequest[req.id]?.unreadCount || 0;
  }

  // ─── Vista de notificaciones ─────────────────────────────────────────────

  openNotifications(): void {
    this.showNotifications = true;
    this.refreshNotifications();
  }

  closeNotifications(): void {
    this.showNotifications = false;
  }

  notificationIcon(type: string): string {
    const icons: Record<string, string> = {
      NEW_PROPOSAL: 'send',
      PROPOSAL_ACCEPTED: 'check-circle',
      PROPOSAL_REJECTED: 'x-circle',
      CONTRACT_SIGNED: 'pen',
      CONTRACT_COMPLETED: 'check2-all',
      NEW_RATING: 'star',
      NEW_MESSAGE: 'chat-dots',
    };
    return icons[type] || 'bell';
  }

  notificationTimeAgo(iso: string): string {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
  }

  /** Marca como leída y navega a la solicitud/chat correspondiente. */
  openNotificationItem(n: ShotraNotification): void {
    if (!n.read) {
      n.read = true;
      this.totalPendingNotifications = Math.max(0, this.totalPendingNotifications - 1);
      this.shotra.markNotificationRead(n.id).subscribe({ error: () => {} });
    }

    if (!n.entityId) return;

    if (n.entityType === 'chat' || n.entityType === 'request') {
      this.closeNotifications();
      this.openDetail({ id: n.entityId } as ShotraRequest);
      if (n.entityType === 'chat') {
        const waitAndOpenChat = () => {
          if (this.loadingDetail) {
            setTimeout(waitAndOpenChat, 150);
            return;
          }
          if (this.canChat()) this.openChat();
        };
        waitAndOpenChat();
      }
    } else if (n.entityType === 'contract') {
      // El contrato no tiene vista propia en InOut: se resuelve a la
      // solicitud dueña del contrato y se abre su detalle.
      this.shotra.getContract(n.entityId).subscribe({
        next: (c) => {
          if (c?.requestId) {
            this.closeNotifications();
            this.openDetail({ id: c.requestId } as ShotraRequest);
          }
        },
        error: () => {},
      });
    }
  }

  markAllNotificationsReadClick(): void {
    this.shotra.markAllNotificationsRead().subscribe({
      next: () => {
        this.notificationItems = this.notificationItems.map((n) => ({ ...n, read: true }));
        this.totalPendingNotifications = 0;
      },
      error: () => {},
    });
  }

  clearAllNotificationsClick(): void {
    Swal.fire({
      title: '¿Vaciar notificaciones?',
      text: 'Se eliminarán todas tus notificaciones. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, vaciar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.shotra.clearAllNotifications().subscribe({
        next: () => {
          this.notificationItems = [];
          this.totalPendingNotifications = 0;
          this.knownNotificationIds.clear();
        },
        error: (err) => Swal.fire('Error', this.readError(err, 'No se pudo vaciar las notificaciones.'), 'error'),
      });
    });
  }

  private loadCategories(): void {
    this.shotra.getDeliveryCategory().subscribe({
      next: (cat) => {
        this.subcategories = cat?.children || [];
      },
      error: () => {
        // Si falla, dejamos la lista vacía; el form avisará.
        this.subcategories = [];
      },
    });
  }

  loadRequests(): void {
    this.loading = true;
    this.shotra.getMyRequests().subscribe({
      next: (reqs) => {
        this.requests = reqs || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = this.readError(err, 'No se pudieron cargar tus solicitudes.');
      },
    });
  }

  // ─── Formulario ────────────────────────────────────────────────────────────

  openForm(): void {
    this.form = this.emptyForm();
    if (this.subcategories.length === 1) {
      this.form.categoryId = this.subcategories[0].id;
    }
    // Reinicia el estado del mini-mapa (origen/destino/ruta) del formulario anterior.
    this.originCoords = null;
    this.destCoords = null;
    this.geocoding = false;
    this.geocodeFailed = false;
    if (this.geocodeTimer) clearTimeout(this.geocodeTimer);
    this.showForm = true;
  }

  /** Selecciona el tipo de entrega y cierra el bottom-sheet. */
  selectCategory(id: string): void {
    this.form.categoryId = id;
    this.showCategorySheet = false;
    this.categorySearch = '';
  }

  openCategorySheet(): void {
    this.categorySearch = '';
    this.showCategorySheet = true;
  }

  closeCategorySheet(): void {
    this.showCategorySheet = false;
  }

  /** Categoría seleccionada (para mostrar su nombre/ícono en el selector). */
  get selectedCategory(): ShotraCategory | undefined {
    return this.subcategories.find((s) => s.id === this.form.categoryId);
  }

  /** Subcategorías filtradas por el buscador del sheet. */
  get filteredSubcategories(): ShotraCategory[] {
    const q = this.categorySearch.trim().toLowerCase();
    if (!q) return this.subcategories;
    return this.subcategories.filter((s) => (s.name || '').toLowerCase().includes(q));
  }

  /** Ícono (Bootstrap Icons) representativo según la subcategoría de delivery. */
  categoryIcon(sub: ShotraCategory): string {
    const key = `${sub.slug || ''} ${sub.name || ''}`.toLowerCase();
    if (key.includes('comida') || key.includes('food')) return 'cup-hot';
    if (key.includes('mercado') || key.includes('grocery')) return 'cart';
    if (key.includes('paquet') || key.includes('package') || key.includes('express')) return 'box-seam';
    if (key.includes('mensaj') || key.includes('messenger')) return 'envelope';
    if (key.includes('compra') || key.includes('mandado') || key.includes('errand')) return 'bag';
    if (key.includes('mudanz') || key.includes('move')) return 'truck';
    if (key.includes('mascota') || key.includes('pet')) return 'heart';
    if (key.includes('prenda') || key.includes('laundry') || key.includes('ropa')) return 'bag-check';
    return 'geo-alt';
  }

  closeForm(): void {
    this.showForm = false;
  }

  // ─── Mini-mapa: recogida (origen) → entrega (destino) ──────────────────────
  //
  // El botón 📍 captura la ubicación GPS del comerciante, que normalmente está
  // en su tienda al publicar la solicitud: eso es el ORIGEN (punto de
  // recogida), NUNCA el destino. El destino real es la "Dirección de entrega"
  // que el usuario escribe, geocodificada para obtener sus coordenadas.
  //
  // Solo destCoords se envía al backend como latitude/longitude de la
  // solicitud (así el punto coincide con el texto de `form.address`). originCoords
  // es puramente referencial: sirve para dibujar el mini-mapa con la ruta que
  // debe recorrer el domiciliario, pero no se persiste (Shotra no tiene un
  // campo de origen en su modelo de solicitud).
  originCoords: { lat: number; lng: number } | null = null;
  destCoords: { lat: number; lng: number } | null = null;
  geocoding = false;
  geocodeFailed = false;
  private geocodeTimer: any = null;

  // Módulo de Leaflet cargado en runtime (ver loadLeaflet) + instancias vivas.
  private L: typeof Leaflet | null = null;
  private leafletModulePromise: Promise<typeof Leaflet> | null = null;
  private map: Leaflet.Map | null = null;
  private mapContainer: HTMLDivElement | null = null; // detecta si el form se cerró mientras cargaba
  private originMarker: Leaflet.Marker | null = null;
  private destMarker: Leaflet.Marker | null = null;
  private routeLine: Leaflet.Polyline | null = null;
  private originIcon: Leaflet.DivIcon | null = null;
  private destIcon: Leaflet.DivIcon | null = null;

  /** Aparece/desaparece con el *ngIf del contenedor (form abierto/cerrado). */
  @ViewChild('mapEl')
  set mapElRef(ref: ElementRef<HTMLDivElement> | undefined) {
    if (ref) {
      this.initMap(ref.nativeElement);
    } else {
      this.destroyMap();
    }
  }

  /** Carga leaflet bajo demanda (una sola vez por sesión de página, cacheada). */
  private loadLeaflet(): Promise<typeof Leaflet> {
    if (!this.leafletModulePromise) {
      this.leafletModulePromise = import('leaflet').then((mod) => (mod as any).default ?? mod);
    }
    return this.leafletModulePromise;
  }

  /** ¿Hay algo que mostrar en el mini-mapa? (origen, destino o buscando). */
  showMapPreview(): boolean {
    return !!(this.originCoords || this.destCoords || this.geocoding);
  }

  /** Captura la ubicación GPS del comerciante como punto de RECOGIDA (origen). */
  useMyLocation(): void {
    if (!navigator?.geolocation) {
      Swal.fire('No disponible', 'Tu navegador no permite geolocalización.', 'info');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.originCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.drawRoute();
        Swal.fire({ icon: 'success', title: 'Punto de recogida capturado', timer: 1200, showConfirmButton: false });
      },
      () => Swal.fire('Error', 'No se pudo obtener tu ubicación.', 'error'),
    );
  }

  /** Debounce: geocodifica la dirección de entrega ~700ms después de dejar de escribir. */
  onAddressChange(): void {
    this.destCoords = null;
    this.geocodeFailed = false;
    if (this.geocodeTimer) clearTimeout(this.geocodeTimer);
    const address = this.form.address?.trim();
    if (!address || address.length < 6) {
      this.drawRoute(); // limpia el marcador/ruta de destino si ya no aplica
      return;
    }
    this.geocodeTimer = setTimeout(() => this.geocodeAddress(address), 700);
  }

  /**
   * Geocodifica la dirección de entrega con Nominatim (OpenStreetMap) para
   * ubicarla en el mini-mapa y obtener las coordenadas reales que se envían
   * al backend. Usa fetch() nativo (no HttpClient) a propósito: así evita el
   * AuthInterceptor de InOut, que le adjuntaría el token/tenant de InOut a un
   * servicio externo. Si falla o no encuentra nada, no bloquea el envío: el
   * texto de la dirección siempre se manda tal cual lo escribió el usuario.
   *
   * Nota: el servidor público de Nominatim limita a ~1 req/seg de uso; el
   * debounce de onAddressChange es suficiente para un formulario manual. Si el
   * volumen crece, migrar a un geocodificador comercial (Google/Mapbox).
   */
  private geocodeAddress(address: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.geocoding = true;
    this.geocodeFailed = false;
    const q = encodeURIComponent(`${address}, Colombia`);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((results: Array<{ lat: string; lon: string }>) => {
        this.geocoding = false;
        const hit = results?.[0];
        this.destCoords = hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) } : null;
        this.geocodeFailed = !hit;
        this.drawRoute();
      })
      .catch(() => {
        this.geocoding = false;
        this.geocodeFailed = true;
        this.destCoords = null;
        this.drawRoute();
      });
  }

  private initMap(container: HTMLDivElement): void {
    if (!isPlatformBrowser(this.platformId) || this.map) return;
    this.mapContainer = container;
    this.loadLeaflet().then((L) => {
      // El form pudo cerrarse (destroyMap) mientras el chunk de leaflet cargaba.
      if (this.mapContainer !== container) return;
      this.L = L;
      this.originIcon = L.divIcon({
        className: 'route-pin route-pin-origin',
        html: '🏪',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      this.destIcon = L.divIcon({
        className: 'route-pin route-pin-dest',
        html: '📍',
        iconSize: [28, 36],
        iconAnchor: [14, 32],
      });
      this.map = L.map(container, { zoomControl: false, attributionControl: false }).setView([4.6097, -74.0817], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);
      L.control.attribution({ prefix: false }).addTo(this.map).addAttribution('© OpenStreetMap contributors');
      this.drawRoute();
    });
  }

  private destroyMap(): void {
    this.mapContainer = null;
    this.map?.remove();
    this.map = null;
    this.originMarker = null;
    this.destMarker = null;
    this.routeLine = null;
  }

  /** Dibuja/actualiza los marcadores de origen y destino y reencuadra el mapa. */
  private drawRoute(): void {
    if (!this.map || !this.L) return;
    const L = this.L;

    if (this.originCoords) {
      const pos: Leaflet.LatLngExpression = [this.originCoords.lat, this.originCoords.lng];
      if (this.originMarker) this.originMarker.setLatLng(pos);
      else this.originMarker = L.marker(pos, { icon: this.originIcon!, title: 'Punto de recogida' }).addTo(this.map);
    } else if (this.originMarker) {
      this.originMarker.remove();
      this.originMarker = null;
    }

    if (this.destCoords) {
      const pos: Leaflet.LatLngExpression = [this.destCoords.lat, this.destCoords.lng];
      if (this.destMarker) this.destMarker.setLatLng(pos);
      else this.destMarker = L.marker(pos, { icon: this.destIcon!, title: 'Dirección de entrega' }).addTo(this.map);
    } else if (this.destMarker) {
      this.destMarker.remove();
      this.destMarker = null;
    }

    this.fitAndRoute();
  }

  /** Encuadra los puntos disponibles y, si hay ambos, pide la ruta real (OSRM). */
  private fitAndRoute(): void {
    if (!this.map || !this.L) return;
    if (this.routeLine) {
      this.routeLine.remove();
      this.routeLine = null;
    }

    const points: Leaflet.LatLngExpression[] = [];
    if (this.originCoords) points.push([this.originCoords.lat, this.originCoords.lng]);
    if (this.destCoords) points.push([this.destCoords.lat, this.destCoords.lng]);

    if (points.length === 0) return;
    if (points.length === 1) {
      this.map.setView(points[0], 15);
      return;
    }

    this.map.fitBounds(this.L.latLngBounds(points), { padding: [24, 24] });
    this.fetchRoute();
  }

  /** Ruta real por vías entre origen y destino, vía el servidor público de OSRM. */
  private fetchRoute(): void {
    if (!this.originCoords || !this.destCoords) return;
    const { lat: oLat, lng: oLng } = this.originCoords;
    const { lat: dLat, lng: dLng } = this.destCoords;
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometry=geojson`;

    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: any) => {
        const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
        if (!this.map || !this.L || !coords?.length) return this.drawStraightLine();
        const latLngs: Leaflet.LatLngExpression[] = coords.map(([lng, lat]) => [lat, lng]);
        this.routeLine = this.L.polyline(latLngs, { color: '#dc2626', weight: 4, opacity: 0.85 }).addTo(this.map);
      })
      .catch(() => this.drawStraightLine());
  }

  /** Respaldo si OSRM falla: línea recta punteada entre origen y destino. */
  private drawStraightLine(): void {
    if (!this.map || !this.L || !this.originCoords || !this.destCoords) return;
    const latLngs: Leaflet.LatLngExpression[] = [
      [this.originCoords.lat, this.originCoords.lng],
      [this.destCoords.lat, this.destCoords.lng],
    ];
    this.routeLine = this.L.polyline(latLngs, { color: '#dc2626', weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(
      this.map,
    );
  }

  canSubmit(): boolean {
    return (
      !!this.form.categoryId &&
      !!this.form.title?.trim() &&
      !!this.form.description?.trim() &&
      !!this.form.address?.trim()
    );
  }

  submit(): void {
    if (!this.canSubmit() || this.submitting) return;
    this.submitting = true;

    // Normalizar payload: no enviar campos vacíos.
    const payload: CreateShotraRequest = {
      categoryId: this.form.categoryId,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      address: this.form.address?.trim(),
      isUrgent: !!this.form.isUrgent,
    };
    if (this.form.budgetMin != null) payload.budgetMin = Number(this.form.budgetMin);
    if (this.form.budgetMax != null) payload.budgetMax = Number(this.form.budgetMax);
    // Coordenadas del DESTINO (geocodificadas desde la dirección de entrega),
    // nunca las del origen/GPS: así lat/lng siempre coinciden con `address`.
    if (this.destCoords) {
      payload.latitude = this.destCoords.lat;
      payload.longitude = this.destCoords.lng;
    }
    // Origen del trayecto (punto de recogida, capturado por GPS): ahora sí se
    // envía al backend, que lo persiste si la categoría tiene requiresRoute.
    if (this.originCoords) {
      payload.originLatitude = this.originCoords.lat;
      payload.originLongitude = this.originCoords.lng;
      payload.originAddress = 'Punto de recogida (GPS)';
    }
    if (this.form.scheduledAt) payload.scheduledAt = new Date(this.form.scheduledAt).toISOString();

    this.shotra.createRequest(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.showForm = false;
        Swal.fire({
          icon: 'success',
          title: 'Solicitud publicada',
          text: 'Los domiciliarios de Shotra ya pueden enviarte ofertas.',
          timer: 1800,
          showConfirmButton: false,
        });
        this.loadRequests();
      },
      error: (err) => {
        this.submitting = false;
        Swal.fire('Error', this.readError(err, 'No se pudo publicar la solicitud.'), 'error');
      },
    });
  }

  // ─── Detalle / Ofertas ──────────────────────────────────────────────────────

  openDetail(req: ShotraRequest): void {
    this.loadingDetail = true;
    this.selectedRequest = null;
    this.contract = null;
    this.showConfirmForm = false;
    this.closeChat();
    this.chatMessages = [];
    this.shotra.getRequest(req.id).subscribe({
      next: (detail) => {
        this.selectedRequest = detail;
        this.loadingDetail = false;
        // Si ya hay contrato (oferta aceptada), traer su detalle para el cierre.
        if (detail.contract?.id) {
          this.loadContract(detail.contract.id);
        }
      },
      error: (err) => {
        this.loadingDetail = false;
        Swal.fire('Error', this.readError(err, 'No se pudo abrir la solicitud.'), 'error');
      },
    });
  }

  private loadContract(contractId: string): void {
    this.shotra.getContract(contractId).subscribe({
      next: (c) => (this.contract = c),
      error: () => (this.contract = null),
    });
  }

  closeDetail(): void {
    this.selectedRequest = null;
    this.contract = null;
    this.showConfirmForm = false;
    this.closeChat();
  }

  // ─── Chat ────────────────────────────────────────────────────────────────

  /**
   * El chat se muestra desde que ambas partes firman el contrato (así se ve
   * el botón aunque luego se deshabilite, en vez de desaparecer de golpe).
   * Ver isContractClosed() para cuándo queda deshabilitado (Completado/Evaluado).
   */
  canChat(): boolean {
    return !!(this.contract?.requesterSignedAt && this.contract?.providerSignedAt);
  }

  openChat(): void {
    if (!this.selectedRequest || !this.canChat() || this.isContractClosed()) return;
    this.showChat = true;
    this.loadChatMessages();
    this.stopChatPolling();
    this.chatPollTimer = setInterval(() => this.loadChatMessages(true), this.CHAT_POLL_MS);
  }

  closeChat(): void {
    this.showChat = false;
    this.stopChatPolling();
  }

  private stopChatPolling(): void {
    if (this.chatPollTimer) {
      clearInterval(this.chatPollTimer);
      this.chatPollTimer = null;
    }
  }

  private loadChatMessages(silent = false): void {
    if (!this.selectedRequest) return;
    if (!silent) this.loadingChat = true;
    this.shotra.getMessages(this.selectedRequest.id).subscribe({
      next: (msgs) => {
        this.chatMessages = msgs || [];
        this.loadingChat = false;
        // getMessages marca como leídos en el backend: refrescar el badge ya.
        this.refreshNotifications();
      },
      error: () => {
        this.loadingChat = false;
      },
    });
  }

  /** ¿El mensaje lo envié yo (el comerciante = siempre el solicitante en esta extensión)? */
  isMyMessage(msg: ShotraMessage): boolean {
    return !!this.contract && msg.senderId === this.contract.requesterId;
  }

  sendChatMessage(): void {
    const content = this.chatText.trim();
    if (!content || this.sendingChat || !this.selectedRequest) return;
    this.sendingChat = true;
    this.chatText = '';
    this.shotra.sendMessage(this.selectedRequest.id, content).subscribe({
      next: (msg) => {
        this.chatMessages = [...this.chatMessages, msg];
        this.sendingChat = false;
      },
      error: (err) => {
        this.sendingChat = false;
        this.chatText = content;
        Swal.fire('Error', this.readError(err, 'No se pudo enviar el mensaje.'), 'error');
      },
    });
  }

  // ─── Cierre del trabajo: confirmar recepción + declarar pago ────────────────

  /** ¿Se puede cerrar (confirmar recepción + pago)? Requiere contrato activo. */
  canConfirmReceipt(): boolean {
    const s = this.contract?.status;
    return s === 'SIGNED' || s === 'IN_PROGRESS' || s === 'PENDING_CONFIRMATION';
  }

  /** ¿El trabajo ya está cerrado/completado? */
  isContractClosed(): boolean {
    const s = this.contract?.status;
    return s === 'COMPLETED' || s === 'EVALUATED';
  }

  openConfirmForm(): void {
    this.payment = { method: 'CASH', amount: this.contract?.agreedPrice, note: '', voucherUrl: undefined };
    this.showConfirmForm = true;
  }

  closeConfirmForm(): void {
    this.showConfirmForm = false;
  }

  // ─── Evaluación del domiciliario ────────────────────────────────────────────

  /** ¿Ya evalué (como solicitante) este contrato? */
  hasRated(): boolean {
    const c = this.contract;
    if (!c?.ratings || !c.requesterId) return false;
    return c.ratings.some((r) => r.authorId === c.requesterId);
  }

  /** ¿Se puede evaluar? Solo con el trabajo completado/evaluado y sin haber evaluado. */
  canRate(): boolean {
    const s = this.contract?.status;
    return (s === 'COMPLETED' || s === 'EVALUATED') && !this.hasRated();
  }

  openRatingForm(): void {
    this.ratingForm = { score: 5, comment: '' };
    this.showRatingForm = true;
  }

  closeRatingForm(): void {
    this.showRatingForm = false;
  }

  setScore(n: number): void {
    this.ratingForm.score = n;
  }

  submitRating(): void {
    if (!this.contract || this.rating) return;
    this.rating = true;
    const dto = {
      contractId: this.contract.id,
      score: this.ratingForm.score,
      ...(this.ratingForm.comment?.trim() ? { comment: this.ratingForm.comment.trim() } : {}),
    };
    this.shotra.rateContract(dto).subscribe({
      next: () => {
        this.rating = false;
        this.showRatingForm = false;
        Swal.fire({
          icon: 'success',
          title: '¡Gracias por tu evaluación!',
          timer: 1800,
          showConfirmButton: false,
        });
        if (this.selectedRequest) this.openDetail(this.selectedRequest);
        this.loadRequests();
      },
      error: (err) => {
        this.rating = false;
        Swal.fire('Error', this.readError(err, 'No se pudo enviar la evaluación.'), 'error');
      },
    });
  }

  /** Sube el comprobante de pago (imagen/PDF) a Shotra y guarda su URL. */
  onVoucherSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingVoucher = true;
    this.shotra.uploadVoucher(file).subscribe({
      next: (res) => {
        this.payment.voucherUrl = res?.url;
        this.uploadingVoucher = false;
      },
      error: (err) => {
        this.uploadingVoucher = false;
        Swal.fire('Error', this.readError(err, 'No se pudo subir el comprobante.'), 'error');
      },
    });
  }

  submitConfirmReceipt(): void {
    if (!this.contract || this.confirming) return;
    this.confirming = true;
    const dto = {
      method: this.payment.method,
      ...(this.payment.amount != null ? { amount: Number(this.payment.amount) } : {}),
      ...(this.payment.note?.trim() ? { note: this.payment.note.trim() } : {}),
      ...(this.payment.voucherUrl ? { voucherUrl: this.payment.voucherUrl } : {}),
    };
    this.shotra.confirmReceipt(this.contract.id, dto).subscribe({
      next: () => {
        this.confirming = false;
        this.showConfirmForm = false;
        Swal.fire({
          icon: 'success',
          title: 'Trabajo cerrado',
          text: 'Confirmaste la recepción y registraste el pago. La solicitud quedó completada.',
          timer: 2200,
          showConfirmButton: false,
        });
        // Refrescar detalle + contrato + lista.
        if (this.selectedRequest) this.openDetail(this.selectedRequest);
        this.loadRequests();
      },
      error: (err) => {
        this.confirming = false;
        Swal.fire('Error', this.readError(err, 'No se pudo cerrar el trabajo.'), 'error');
      },
    });
  }

  acceptProposal(proposal: ShotraProposal): void {
    Swal.fire({
      title: '¿Aceptar esta oferta?',
      html: `Domiciliario: <b>${proposal.provider?.displayName || 'N/D'}</b><br>Precio: <b>${this.formatCurrency(proposal.price)}</b>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, aceptar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.shotra.acceptProposal(proposal.id).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Oferta aceptada',
            text: 'El contrato quedó firmado por tu parte. Cuando recibas el servicio, ciérralo confirmando el pago.',
            timer: 2400,
            showConfirmButton: false,
          });
          if (this.selectedRequest) this.openDetail(this.selectedRequest);
          this.loadRequests();
        },
        error: (err) => Swal.fire('Error', this.readError(err, 'No se pudo aceptar la oferta.'), 'error'),
      });
    });
  }

  rejectProposal(proposal: ShotraProposal): void {
    this.shotra.rejectProposal(proposal.id).subscribe({
      next: () => {
        if (this.selectedRequest) this.openDetail(this.selectedRequest);
      },
      error: (err) => Swal.fire('Error', this.readError(err, 'No se pudo rechazar la oferta.'), 'error'),
    });
  }

  cancelRequest(req: ShotraRequest): void {
    Swal.fire({
      title: '¿Cancelar solicitud?',
      text: 'Dejará de recibir ofertas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
      confirmButtonColor: '#dc2626',
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.shotra.cancelRequest(req.id).subscribe({
        next: () => {
          this.closeDetail();
          this.loadRequests();
        },
        error: (err) => Swal.fire('Error', this.readError(err, 'No se pudo cancelar.'), 'error'),
      });
    });
  }

  // ─── Helpers de presentación ─────────────────────────────────────────────

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      PUBLISHED: 'Publicada',
      IN_PROPOSALS: 'Con ofertas',
      ACCEPTED: 'Oferta aceptada',
      IN_PROGRESS: 'En curso',
      COMPLETED: 'Completada',
      EVALUATED: 'Evaluada',
      CANCELLED: 'Cancelada',
      EXPIRED: 'Expirada',
    };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      DRAFT: '#6b7280',
      PUBLISHED: '#2563eb',
      IN_PROPOSALS: '#d97706',
      ACCEPTED: '#16a34a',
      IN_PROGRESS: '#0d9488',
      COMPLETED: '#7c3aed',
      EVALUATED: '#7c3aed',
      CANCELLED: '#dc2626',
      EXPIRED: '#9ca3af',
    };
    return colors[status] || '#6b7280';
  }

  getProposalStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      ACCEPTED: 'Aceptada',
      REJECTED: 'Rechazada',
      WITHDRAWN: 'Retirada',
    };
    return labels[status] || status;
  }

  proposalCount(req: ShotraRequest): number {
    return req._count?.proposals ?? 0;
  }

  // ─── Badge de novedad por solicitud ─────────────────────────────────────────

  /**
   * Descriptor visual de la "novedad" de una solicitud: etiqueta, color del
   * badge redondo y si es un estado de cierre (fondo diferencial).
   * Combina el estado de la solicitud con si tiene ofertas.
   */
  /**
   * Badge del detalle: prefiere el estado del CONTRATO cuando existe (más preciso
   * y actualizado que request.status, que puede ir un paso atrás).
   */
  getDetailBadge(req: ShotraRequest): { label: string; color: string; closed: boolean; pulse: boolean } {
    // En el detalle preferimos el contrato COMPLETO ya cargado (this.contract),
    // que es el más preciso; si no, caemos a getBadge (que también mira el
    // contrato resumido del request).
    return this.contractBadge(this.contract?.status) || this.getBadge(req);
  }

  /** Mapea un estado de CONTRATO a badge. null si no aplica. */
  private contractBadge(status?: string): { label: string; color: string; closed: boolean; pulse: boolean } | null {
    switch (status) {
      case 'PENDING':
        return { label: 'Pendiente de firma', color: '#d97706', closed: false, pulse: true };
      case 'SIGNED':
      case 'IN_PROGRESS':
        return { label: 'En curso', color: '#0d9488', closed: false, pulse: false };
      case 'PENDING_CONFIRMATION':
        return { label: 'Por confirmar', color: '#d97706', closed: false, pulse: true };
      case 'COMPLETED':
        return { label: 'Completada', color: '#16a34a', closed: true, pulse: false };
      case 'EVALUATED':
        return { label: 'Finalizada', color: '#16a34a', closed: true, pulse: false };
      case 'CANCELLED':
        return { label: 'Cancelada', color: '#9ca3af', closed: true, pulse: false };
      default:
        return null;
    }
  }

  getBadge(req: ShotraRequest): { label: string; color: string; closed: boolean; pulse: boolean } {
    // Preferir el estado del contrato (más avanzado/real) cuando la solicitud ya
    // tiene uno. Cae al estado del request si no hay contrato.
    const fromContract = this.contractBadge(req.contract?.status);
    if (fromContract) return fromContract;

    const status = req.status;
    const offers = this.proposalCount(req);

    switch (status) {
      case 'PUBLISHED':
        return offers > 0
          ? { label: 'Con ofertas', color: '#d97706', closed: false, pulse: true }
          : { label: 'Esperando ofertas', color: '#2563eb', closed: false, pulse: false };
      case 'IN_PROPOSALS':
        return { label: 'Con ofertas', color: '#d97706', closed: false, pulse: true };
      case 'ACCEPTED':
        // Oferta aceptada: contrato en curso (firma ya dada al aceptar).
        return { label: 'En proceso', color: '#0d9488', closed: false, pulse: false };
      case 'IN_PROGRESS':
        return { label: 'En curso', color: '#0d9488', closed: false, pulse: false };
      case 'COMPLETED':
        return { label: 'Completada', color: '#16a34a', closed: true, pulse: false };
      case 'EVALUATED':
        return { label: 'Evaluada', color: '#16a34a', closed: true, pulse: false };
      case 'CANCELLED':
        return { label: 'Cancelada', color: '#9ca3af', closed: true, pulse: false };
      case 'EXPIRED':
        return { label: 'Expirada', color: '#9ca3af', closed: true, pulse: false };
      case 'DRAFT':
        return { label: 'Borrador', color: '#6b7280', closed: false, pulse: false };
      default:
        return { label: this.getStatusLabel(status), color: '#6b7280', closed: false, pulse: false };
    }
  }

  canManageProposals(): boolean {
    const s = this.selectedRequest?.status;
    return s === 'PUBLISHED' || s === 'IN_PROPOSALS';
  }

  openImagePreview(url: string): void {
    this.previewImageUrl = url;
  }

  closeImagePreview(): void {
    this.previewImageUrl = null;
  }

  formatCurrency(value: number | undefined): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value || 0);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private readError(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
  }
}
