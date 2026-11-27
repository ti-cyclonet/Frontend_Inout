import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductReviewsApi, PublicReview, RatingSummary, REVIEW_LIMITS, apiError, averageText, dayText, starsText } from './product-reviews.api';

/**
 * Opiniones de un ítem en el detalle de la tienda: promedio, las publicadas
 * (con la respuesta de la tienda) y el formulario para dejar una. No se
 * muestra nada si la tienda no tiene las opiniones activas.
 */
@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-reviews.component.html',
  styleUrls: ['./product-reviews.component.css'],
})
export class ProductReviewsComponent implements OnChanges {
  @Input() tenantId: string | null = null;
  @Input() itemId: string | null = null;

  enabled = false;
  loading = false;
  summary: RatingSummary = { average: 0, count: 0 };
  reviews: PublicReview[] = [];

  formOpen = false;
  sending = false;
  error = '';
  /** Mensaje tras enviar ("ya está publicada" / "se publicará cuando la revisen"). */
  sentMessage = '';
  hoverRating = 0;
  draft = { rating: 0, authorName: '', comment: '', authorPhone: '', consentPublish: false };

  limits = REVIEW_LIMITS;
  stars = starsText;
  average = averageText;
  day = dayText;
  readonly scale = [1, 2, 3, 4, 5];
  private readonly ratingWords = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

  constructor(private api: ProductReviewsApi) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tenantId'] || changes['itemId']) {
      this.resetForm();
      this.sentMessage = '';
      this.load();
    }
  }

  load(): void {
    this.enabled = false;
    this.reviews = [];
    if (!this.tenantId || !this.itemId) return;
    this.loading = true;
    this.api.list(this.tenantId, this.itemId).subscribe({
      next: (r) => {
        this.enabled = !!r?.enabled;
        this.summary = r?.summary || { average: 0, count: 0 };
        this.reviews = r?.reviews || [];
        this.loading = false;
      },
      error: () => {
        this.enabled = false;
        this.loading = false;
      },
    });
  }

  ratingWord(n: number): string {
    return this.ratingWords[n] || '';
  }

  setRating(n: number): void {
    this.draft.rating = n;
    this.error = '';
  }

  get canSend(): boolean {
    const d = this.draft;
    return d.rating >= 1 && d.authorName.trim().length >= 2 && d.comment.trim().length >= 3 && d.consentPublish && !this.sending;
  }

  send(): void {
    if (!this.tenantId || !this.itemId) return;
    if (!this.canSend) {
      this.error = !this.draft.rating ? 'Elige de 1 a 5 estrellas.'
        : this.draft.authorName.trim().length < 2 ? 'Escribe tu nombre.'
        : this.draft.comment.trim().length < 3 ? 'Escribe tu opinión.'
        : 'Acepta que tu opinión se publique en la tienda.';
      return;
    }
    this.sending = true;
    this.error = '';
    const d = this.draft;
    this.api.create(this.tenantId, this.itemId, {
      rating: d.rating,
      comment: d.comment.trim(),
      authorName: d.authorName.trim(),
      authorPhone: d.authorPhone.trim() || undefined,
      consentPublish: d.consentPublish,
    }).subscribe({
      next: (r) => {
        this.sending = false;
        this.sentMessage = r?.message || '¡Gracias por tu opinión!';
        this.formOpen = false;
        this.resetForm();
        if (r?.status === 'PUBLISHED') this.load();
      },
      error: (err) => {
        this.sending = false;
        this.error = apiError(err, 'No se pudo enviar tu opinión. Intenta de nuevo.');
      },
    });
  }

  openForm(): void {
    this.formOpen = true;
    this.sentMessage = '';
  }

  cancel(): void {
    this.formOpen = false;
    this.resetForm();
  }

  private resetForm(): void {
    this.draft = { rating: 0, authorName: '', comment: '', authorPhone: '', consentPublish: false };
    this.hoverRating = 0;
    this.error = '';
  }

  trackById = (_: number, r: PublicReview) => r.id;
}
