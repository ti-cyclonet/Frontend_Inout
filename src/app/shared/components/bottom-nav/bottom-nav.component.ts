import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { OptionMenu } from '../../model/option_menu';
import { StockAlertsService } from '../../services/stock-alerts.service';

/** Accesos que van en la barra (2 a cada lado del botón central). */
const BAR_SLOTS = 4;

/**
 * Menú inferior para móvil (tercer estilo de menú, junto a Lateral y Lista),
 * al estilo de Kiri: 4 accesos directos y un botón central que abre el menú
 * completo del módulo en una hoja desde abajo.
 */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.css'],
})
export class BottomNavComponent implements OnInit, OnDestroy {
  @Input() set optionsMenu(options: OptionMenu[]) {
    this.mainOptions = (options || [])
      .filter((o) => o.type === 'main_menu' && !!o.url)
      .sort((a, b) => (parseInt(a.order, 10) || 99) - (parseInt(b.order, 10) || 99));
  }

  mainOptions: OptionMenu[] = [];
  sheetOpen = false;
  materialAlertCount = 0;
  productAlertCount = 0;
  private alertsSub?: Subscription;

  constructor(private stockAlertsService: StockAlertsService) {}

  ngOnInit(): void {
    this.alertsSub = this.stockAlertsService.alerts$.subscribe((response) => {
      this.materialAlertCount = response.data.filter((a) => a.type === 'material').length;
      this.productAlertCount = response.data.filter((a) => a.type === 'product').length;
    });
  }

  ngOnDestroy(): void {
    this.alertsSub?.unsubscribe();
  }

  get leftItems(): OptionMenu[] {
    return this.mainOptions.slice(0, BAR_SLOTS / 2);
  }

  get rightItems(): OptionMenu[] {
    return this.mainOptions.slice(BAR_SLOTS / 2, BAR_SLOTS);
  }

  /** Hay alertas de stock en opciones que no caben en la barra: se marca el botón central. */
  get hasHiddenAlerts(): boolean {
    return this.mainOptions.slice(BAR_SLOTS).some((o) => this.alertCount(o) > 0);
  }

  alertCount(option: OptionMenu): number {
    const url = option.url || '';
    if (url.includes('material')) return this.materialAlertCount;
    if (url.includes('product')) return this.productAlertCount;
    return 0;
  }

  toggleSheet(): void {
    this.sheetOpen = !this.sheetOpen;
  }

  closeSheet(): void {
    this.sheetOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSheet();
  }
}
