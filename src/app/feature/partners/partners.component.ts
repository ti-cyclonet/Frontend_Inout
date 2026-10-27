import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PARTNER_CATEGORIES, PartnerOffer, PartnersService } from '../../shared/services/partners.service';

/** «Servicios recomendados»: aliados de CycloNet agrupados por necesidad. */
@Component({
  selector: 'app-partners',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ps-wrap">
      <header class="ps-head">
        <h1>Servicios recomendados</h1>
        <p>Herramientas de nuestros aliados que complementan a InOut. Algunas traen beneficios especiales por ser cliente de CycloNet.</p>
      </header>

      <p class="ps-muted" *ngIf="loading">Cargando…</p>
      <div class="ps-empty" *ngIf="!loading && !groups.length">
        <b>Muy pronto</b>
        <p>Estamos seleccionando aliados para facturación electrónica, datáfonos, impresoras y más. ¿Necesitas algo en particular? Cuéntanos en «Danos tu opinión».</p>
      </div>

      <section class="ps-group" *ngFor="let g of groups">
        <h2>{{ g.label }}</h2>
        <div class="ps-grid">
          <article class="ps-card" *ngFor="let o of g.items">
            <div class="ps-top">
              <img *ngIf="o.logoUrl" [src]="o.logoUrl" [alt]="o.name" loading="lazy">
              <span class="ps-ini" *ngIf="!o.logoUrl" aria-hidden="true">{{ o.name.charAt(0) }}</span>
              <b>{{ o.name }}</b>
            </div>
            <p>{{ o.description }}</p>
            <span class="ps-benefit" *ngIf="o.benefit">🎁 {{ o.benefit }}</span>
            <a class="ps-btn" [href]="goUrl(o)" target="_blank" rel="noopener sponsored">Conocer más</a>
          </article>
        </div>
      </section>

      <p class="ps-note" *ngIf="hasAffiliates">CycloNet puede recibir una comisión si contratas a través de estos enlaces. No cambia el precio para ti y solo recomendamos servicios útiles para tu negocio.</p>
    </div>
  `,
  styles: [`
    .ps-wrap { padding: 20px clamp(12px, 3vw, 28px); max-width: 1180px; }
    .ps-head h1 { font-size: 1.5rem; margin: 0 0 4px; }
    .ps-head p { color: #64748b; margin: 0 0 18px; }
    .ps-muted { color: #64748b; }
    .ps-empty { border: 1px dashed #cbd5e1; border-radius: 14px; padding: 18px 20px; background: #f8fafc; }
    .ps-empty p { margin: 4px 0 0; color: #475569; }
    .ps-group h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .06em; color: #475569; margin: 18px 0 10px; }
    .ps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .ps-card { display: flex; flex-direction: column; gap: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; }
    .ps-top { display: flex; gap: 10px; align-items: center; }
    .ps-top img, .ps-ini { width: 42px; height: 42px; border-radius: 10px; object-fit: contain; border: 1px solid #eef2f7; flex: none; }
    .ps-ini { display: grid; place-items: center; background: #e65c00; color: #fff; font-weight: 800; border: 0; }
    .ps-card p { margin: 0; color: #334155; font-size: .9rem; flex: 1; }
    .ps-benefit { align-self: flex-start; font-size: .8rem; font-weight: 600; color: #166534; background: #dcfce7; padding: 3px 9px; border-radius: 999px; }
    .ps-btn { align-self: flex-start; background: #e65c00; color: #fff; border-radius: 10px; padding: 7px 14px; font-weight: 600; text-decoration: none; font-size: .88rem; }
    .ps-btn:hover { background: #cc5200; color: #fff; }
    .ps-note { margin: 22px 0 0; font-size: .78rem; color: #94a3b8; }
  `],
})
export class PartnersComponent implements OnInit {
  private partners = inject(PartnersService);
  groups: { label: string; items: PartnerOffer[] }[] = [];
  hasAffiliates = false;
  loading = true;

  ngOnInit(): void {
    this.partners.catalog().subscribe((items) => {
      const order = Object.keys(PARTNER_CATEGORIES);
      const by = new Map<string, PartnerOffer[]>();
      for (const o of items) {
        const k = order.includes(o.category) ? o.category : 'otros';
        by.set(k, [...(by.get(k) || []), o]);
      }
      this.groups = order.filter((k) => by.has(k)).map((k) => ({ label: PARTNER_CATEGORIES[k], items: by.get(k)! }));
      this.hasAffiliates = items.some((o) => o.isAffiliate);
      this.loading = false;
    });
  }

  goUrl(o: PartnerOffer): string { return this.partners.goUrl(o); }
}
