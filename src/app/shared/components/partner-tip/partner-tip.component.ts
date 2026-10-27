import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PartnerOffer, PartnersService } from '../../services/partners.service';

/** «No por ahora» oculta la sugerencia de esa pantalla por 30 días en este equipo. */
const DISMISS_DAYS = 30;

/**
 * Sugerencia discreta de un servicio recomendado en una pantalla de InOut
 * (ventas, cartera, inicio…). Solo para el administrador del negocio y solo
 * si hay un aliado configurado para esa pantalla en Authoriza.
 */
@Component({
  selector: 'app-partner-tip',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <aside class="pt" *ngIf="offer" aria-label="Servicio recomendado">
      <img *ngIf="offer.logoUrl" [src]="offer.logoUrl" alt="" loading="lazy">
      <div class="pt-body">
        <small>Recomendado para tu negocio</small>
        <b>{{ offer.name }}<span class="pt-benefit" *ngIf="offer.benefit"> · {{ offer.benefit }}</span></b>
        <span class="pt-desc">{{ offer.description }}</span>
      </div>
      <div class="pt-actions">
        <a class="pt-btn" [href]="goUrl" target="_blank" rel="noopener sponsored">Conocer más</a>
        <a class="pt-link" routerLink="/servicios">Ver todos</a>
        <button type="button" class="pt-link" (click)="dismiss()">No por ahora</button>
      </div>
    </aside>
  `,
  styles: [`
    .pt { display: flex; gap: 12px; align-items: center; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 10px 14px; margin: 10px 0; }
    .pt img { width: 38px; height: 38px; border-radius: 8px; object-fit: contain; background: #fff; flex: none; }
    .pt-body { display: grid; gap: 1px; flex: 1; min-width: 0; }
    .pt-body small { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: #c2410c; font-weight: 700; }
    .pt-body b { font-size: .92rem; color: #0f172a; }
    .pt-benefit { color: #166534; font-weight: 600; }
    .pt-desc { font-size: .82rem; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pt-actions { display: flex; gap: 10px; align-items: center; flex: none; }
    .pt-btn { background: #e65c00; color: #fff; border-radius: 8px; padding: 6px 12px; font-weight: 600; font-size: .82rem; text-decoration: none; }
    .pt-btn:hover { color: #fff; background: #cc5200; }
    .pt-link { border: 0; background: none; padding: 0; color: #64748b; font-size: .8rem; text-decoration: underline; cursor: pointer; }
    @media (max-width: 640px) { .pt { flex-wrap: wrap; } .pt-desc { white-space: normal; } .pt-actions { width: 100%; } }
  `],
})
export class PartnerTipComponent implements OnInit {
  @Input({ required: true }) placement!: string;
  private partners = inject(PartnersService);
  offer: PartnerOffer | null = null;
  goUrl = '';

  private get key(): string { return `inout-partner-tip-${this.placement}`; }

  ngOnInit(): void {
    if (!this.partners.canSee || this.dismissed()) return;
    this.partners.forPlacement(this.placement).subscribe((items) => {
      if (!items.length) return;
      // Rota a diario entre los servicios de la pantalla
      const day = Math.floor(Date.now() / 86400000);
      this.offer = items[day % items.length];
      this.goUrl = this.partners.goUrl(this.offer, this.placement);
    });
  }

  dismiss(): void {
    this.offer = null;
    try { localStorage.setItem(this.key, String(Date.now() + DISMISS_DAYS * 86400000)); } catch { /* sin almacenamiento */ }
  }

  private dismissed(): boolean {
    try { return Number(localStorage.getItem(this.key) || 0) > Date.now(); } catch { return false; }
  }
}
