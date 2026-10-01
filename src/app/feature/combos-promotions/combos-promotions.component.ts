import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CombosAdminComponent } from './combos/combos-admin.component';
import { PromotionsAdminComponent } from './promotions/promotions-admin.component';

type Tab = 'combos' | 'promotions';

/**
 * Módulo "Combos y promociones" (entrada propia del menú, en Inventario y
 * Manufactura): combos virtuales, kits armados y promociones.
 * /combos abre Combos y kits; /combos?tab=promociones abre Promociones.
 */
@Component({
  selector: 'app-combos-promotions',
  standalone: true,
  imports: [CommonModule, CombosAdminComponent, PromotionsAdminComponent],
  template: `
    <div class="cp-container">
      <div class="cp-header">
        <h5 class="mb-0">Módulo <span class="text-primary fw-bold">COMBOS Y PROMOCIONES</span> <span style="color: #ff8000">●</span></h5>
      </div>
      <div class="cp-tabs">
        <button class="tab-button" [class.active]="activeTab === 'combos'" (click)="setTab('combos')">
          Combos y kits
        </button>
        <button class="tab-button" [class.active]="activeTab === 'promotions'" (click)="setTab('promotions')">
          Promociones
        </button>
      </div>

      <div class="cp-content">
        <app-combos-admin *ngIf="activeTab === 'combos'"></app-combos-admin>
        <app-promotions-admin *ngIf="activeTab === 'promotions'"></app-promotions-admin>
      </div>
    </div>
  `,
  styles: [`
    .cp-container { height: 100%; display: flex; flex-direction: column; }
    .cp-header { background: white; padding: 1rem 1.5rem; border-bottom: 1px solid orange; text-align: right; }
    .cp-tabs { display: flex; background: white; border-bottom: 1px solid #e9ecef; padding: 0 1rem; overflow-x: auto; scrollbar-width: none; }
    .cp-tabs::-webkit-scrollbar { display: none; }
    .tab-button {
      padding: 1rem 1.5rem; border: none; background: transparent; color: #6c757d; font-weight: 500;
      cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s ease; white-space: nowrap;
    }
    .tab-button:hover { color: #007bff; }
    .tab-button.active { color: #007bff; border-bottom-color: #007bff; }
    @media (max-width: 576px) {
      .cp-tabs { padding: 0 0.25rem; }
      .tab-button { padding: 0.75rem 0.6rem; font-size: 0.78rem; }
    }
    .cp-content { flex: 1; overflow: auto; }
  `],
})
export class CombosPromotionsComponent {
  activeTab: Tab = 'combos';

  constructor(private route: ActivatedRoute, private router: Router) {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'promociones' || tab === 'promotions') this.activeTab = 'promotions';
  }

  /** La pestaña queda en la URL (sirve para volver o compartir el enlace). */
  setTab(tab: Tab): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'promotions' ? 'promociones' : null },
      replaceUrl: true,
    });
  }
}
