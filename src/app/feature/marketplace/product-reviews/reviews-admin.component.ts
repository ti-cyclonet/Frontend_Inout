import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  AdminReview, ProductReviewsApi, REVIEW_LIMITS, ReviewSettings, ReviewStatus, apiError, dayText, starsText,
} from './product-reviews.api';

/**
 * Opiniones de clientes (modo administrador de la tienda): activarlas,
 * revisar las que llegan, publicarlas u ocultarlas, y responderlas.
 */
@Component({
  selector: 'app-reviews-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reviews-admin.component.html',
  styleUrls: ['./reviews-admin.component.css'],
})
export class ReviewsAdminComponent implements OnInit {
  open = false;
  settings: ReviewSettings | null = null;
  savingSettings = false;

  tab: ReviewStatus = 'PENDING';
  counts: Record<ReviewStatus, number> = { PENDING: 0, PUBLISHED: 0, HIDDEN: 0 };
  reviews: AdminReview[] = [];
  loading = false;
  /** Opinión con una acción en curso. */
  busy = '';
  /** Respuesta que se está escribiendo (por opinión). */
  replyDraft: Record<string, string> = {};
  replying = '';

  readonly tabs: { status: ReviewStatus; label: string }[] = [
    { status: 'PENDING', label: 'Por revisar' },
    { status: 'PUBLISHED', label: 'Publicadas' },
    { status: 'HIDDEN', label: 'Ocultas' },
  ];
  limits = REVIEW_LIMITS;
  stars = starsText;
  day = dayText;

  constructor(private api: ProductReviewsApi) {}

  ngOnInit(): void {
    this.api.settings().subscribe({
      next: (s) => (this.settings = s),
      error: () => (this.settings = { enabled: false, autoPublish: false }),
    });
    this.loadList();
  }

  get summary(): string {
    if (!this.settings) return 'Cargando…';
    if (!this.settings.enabled) return 'Apagadas';
    const pending = this.counts.PENDING;
    return pending ? `${pending} por revisar` : `${this.counts.PUBLISHED} publicada(s)`;
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.loadList();
  }

  saveSettings(change: Partial<ReviewSettings>): void {
    if (!this.settings) return;
    const previous = { ...this.settings };
    this.settings = { ...this.settings, ...change };
    this.savingSettings = true;
    this.api.updateSettings(change).subscribe({
      next: (s) => {
        this.settings = s;
        this.savingSettings = false;
      },
      error: (err) => {
        this.settings = previous;
        this.savingSettings = false;
        Swal.fire('No se guardó', apiError(err, 'Solo el administrador puede cambiar esta configuración.'), 'error');
      },
    });
  }

  selectTab(status: ReviewStatus): void {
    this.tab = status;
    this.loadList();
  }

  loadList(): void {
    this.loading = true;
    this.api.adminList(this.tab).subscribe({
      next: (r) => {
        const c: Partial<Record<ReviewStatus, number>> = r?.counts || {};
        this.counts = { PENDING: c.PENDING || 0, PUBLISHED: c.PUBLISHED || 0, HIDDEN: c.HIDDEN || 0 };
        this.reviews = r?.reviews || [];
        this.loading = false;
      },
      error: () => {
        this.reviews = [];
        this.loading = false;
      },
    });
  }

  setStatus(r: AdminReview, status: ReviewStatus): void {
    this.busy = r.id;
    this.api.update(r.id, { status }).subscribe({
      next: () => {
        this.busy = '';
        this.loadList();
      },
      error: (err) => {
        this.busy = '';
        Swal.fire('No se pudo cambiar', apiError(err, 'Intenta de nuevo.'), 'error');
      },
    });
  }

  startReply(r: AdminReview): void {
    this.replying = r.id;
    this.replyDraft[r.id] = r.reply || '';
  }

  saveReply(r: AdminReview): void {
    const text = (this.replyDraft[r.id] || '').trim();
    this.busy = r.id;
    this.api.update(r.id, { reply: text || null }).subscribe({
      next: (res) => {
        r.reply = res.reply;
        r.repliedAt = res.repliedAt;
        this.busy = '';
        this.replying = '';
      },
      error: (err) => {
        this.busy = '';
        Swal.fire('No se guardó la respuesta', apiError(err, 'Intenta de nuevo.'), 'error');
      },
    });
  }

  async remove(r: AdminReview): Promise<void> {
    const ok = await Swal.fire({
      title: '¿Eliminar esta opinión?',
      text: `La opinión de ${r.authorName} sobre ${r.itemName} se borra para siempre. Si solo quieres que no se vea, usa «Ocultar».`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b91c1c',
    });
    if (!ok.isConfirmed) return;
    this.busy = r.id;
    this.api.remove(r.id).subscribe({
      next: () => {
        this.busy = '';
        this.loadList();
      },
      error: (err) => {
        this.busy = '';
        Swal.fire('No se eliminó', apiError(err, 'Solo el administrador puede eliminar opiniones.'), 'error');
      },
    });
  }

  /** Enlace de WhatsApp para escribirle al cliente (Colombia por defecto). */
  whatsapp(phone: string | null): string | null {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 7) return null;
    return `https://wa.me/${digits.length === 10 ? '57' + digits : digits}`;
  }

  trackById = (_: number, r: AdminReview) => r.id;
}
