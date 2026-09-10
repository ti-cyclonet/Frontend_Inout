import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import {
  ShotraService,
  ShotraCategory,
  ShotraRequest,
  ShotraRequestDetail,
  ShotraProposal,
  ShotraContract,
  ShotraPaymentMethod,
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

  // ─── Polling de ofertas en tiempo (casi) real ───────────────────────────────
  // Mientras el panel está abierto, se refresca la lista periódicamente. Si el
  // total de ofertas aumenta respecto al último conteo conocido, suena una alerta.
  private pollTimer: any = null;
  private readonly POLL_MS = 12000; // cada 12s
  private lastProposalTotal = 0;
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

  // Contrato de la solicitud abierta (si existe) + flujo de cierre
  contract: ShotraContract | null = null;
  showConfirmForm = false;
  confirming = false;
  uploadingVoucher = false;
  payment: { method: ShotraPaymentMethod; amount?: number; note?: string; voucherUrl?: string } = { method: 'CASH' };

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

  constructor(private shotra: ShotraService, private uiPrefs: UiPrefsService, private sanitizer: DomSanitizer) {
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
    this.stopPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.prefSub?.unsubscribe();
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
   * Refresca la lista SIN mostrar el spinner (para no parpadear en cada poll) y,
   * si el total de ofertas aumentó, suena una alerta.
   */
  private refreshRequestsSilently(): void {
    this.shotra.getMyRequests().subscribe({
      next: (reqs) => {
        this.requests = reqs || [];
        this.error = null;
        this.detectNewProposals();
      },
      error: () => {
        // Silencioso: un fallo de poll no debe romper la vista.
      },
    });
  }

  /** Suma total de ofertas actuales; si subió, emite sonido. */
  private detectNewProposals(): void {
    const total = this.requests.reduce((sum, r) => sum + this.proposalCount(r), 0);
    if (total > this.lastProposalTotal) {
      this.playNotification();
    }
    this.lastProposalTotal = total;
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
      },
      error: (err) => {
        this.loading = false;
        this.error = this.readError(err, 'No se pudo conectar con Shotra. Verifica que tengas acceso.');
      },
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
        // Baseline inicial: registrar el total actual SIN sonar (evita beep al
        // abrir por primera vez). El polling posterior sí detecta incrementos.
        this.lastProposalTotal = this.requests.reduce((sum, r) => sum + this.proposalCount(r), 0);
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
    this.updateMapUrl(); // limpia el mapa (form sin coordenadas aún)
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

  /** Rellena lat/lng con la ubicación del navegador (opcional). */
  useMyLocation(): void {
    if (!navigator?.geolocation) {
      Swal.fire('No disponible', 'Tu navegador no permite geolocalización.', 'info');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.form.latitude = pos.coords.latitude;
        this.form.longitude = pos.coords.longitude;
        this.updateMapUrl(); // construir el mini-mapa una sola vez
        Swal.fire({ icon: 'success', title: 'Ubicación capturada', timer: 1200, showConfirmButton: false });
      },
      () => Swal.fire('Error', 'No se pudo obtener tu ubicación.', 'error'),
    );
  }

  // URL segura del mini-mapa (OpenStreetMap embebido). Es una PROPIEDAD, no un
  // getter: se recalcula SOLO cuando cambian las coordenadas (updateMapUrl), no
  // en cada ciclo de detección de cambios — si no, el iframe se recargaría con
  // cada mousemove/tecla porque bypassSecurityTrustResourceUrl crea un objeto
  // nuevo cada vez.
  mapUrl: SafeResourceUrl | null = null;
  private mapKey = ''; // "lat,lng" del último mapa construido, para no rehacerlo

  /** Reconstruye el mini-mapa solo si las coordenadas cambiaron. */
  private updateMapUrl(): void {
    const lat = this.form.latitude;
    const lng = this.form.longitude;
    if (lat == null || lng == null) {
      this.mapUrl = null;
      this.mapKey = '';
      return;
    }
    const key = `${lat},${lng}`;
    if (key === this.mapKey) return; // sin cambios: no recrear (evita parpadeo)
    this.mapKey = key;
    const d = 0.004; // bbox pequeño (~zoom de manzana)
    const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
    const url =
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}` +
      `&layer=mapnik&marker=${lat}%2C${lng}`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
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
    if (this.form.latitude != null) payload.latitude = Number(this.form.latitude);
    if (this.form.longitude != null) payload.longitude = Number(this.form.longitude);
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
