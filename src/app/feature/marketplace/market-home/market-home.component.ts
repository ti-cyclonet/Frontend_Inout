import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RevealDirective } from './reveal.directive';

/** Tienda que aparece en la vitrina (la arma el MarketPlace con su contrato y su configuración). */
export interface HomeStore {
  tenantId: string;
  slug: string;
  name: string;
  logo: string | null;
  sectorLabel: string;
  count: number;
  cover: string | null;
  /** Compró "Destacado en CycloNet Market": sale primero y con insignia. */
  promoted?: boolean;
}

export interface HomeSector {
  value: string;
  label: string;
  count: number;
  /** Foto del primer producto del sector (círculos de la portada). */
  image?: string | null;
}

export interface HomeItem {
  strId: string;
  strName: string;
  fltPrice: number;
  image?: string | null;
  strTenantId?: string;
  sales?: number;
}

/** Emoji de respaldo del círculo de un sector sin foto. */
const SECTOR_EMOJI: Record<string, string> = {
  '23': '🍲', '24': '👗', '25': '🔧', '26': '🏡', '27': '⚽', '28': '🛠️', '29': '🛍️', '30': '🏭', '31': '🏪',
};

/** Diapositiva del banner principal. */
export type HomeSlide =
  | { kind: 'welcome' }
  | { kind: 'store'; store: HomeStore }
  | { kind: 'product'; item: HomeItem; storeName: string | null };

const SLIDE_MS = 7000;

/**
 * Vitrina de CycloNet Market (/marketplace/home): portada sobria de comercio
 * en línea. Sectores en círculos con foto, banner principal con carrusel
 * (bienvenida y buscador, tiendas destacadas, lo más pedido), franja de
 * beneficios, tiendas y productos en tarjetas limpias. Solo presenta: buscar,
 * filtrar, abrir una tienda o un producto los resuelve el MarketPlace
 * (eventos). `section="cta"` pinta la franja para vendedores (va después del
 * catálogo).
 */
@Component({
  selector: 'app-market-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RevealDirective],
  templateUrl: './market-home.component.html',
  styleUrls: ['./market-home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketHomeComponent implements OnInit, OnChanges, OnDestroy {
  @Input() section: 'main' | 'cta' = 'main';
  @Input() products: HomeItem[] = [];
  @Input() featured: HomeItem[] = [];
  @Input() stores: HomeStore[] = [];
  @Input() sectors: HomeSector[] = [];
  @Input() sellerUrl = 'https://cyclonet.com.co/inout';

  @Output() search = new EventEmitter<string>();
  @Output() sector = new EventEmitter<string>();
  @Output() store = new EventEmitter<HomeStore>();
  @Output() product = new EventEmitter<HomeItem>();

  term = '';
  slides: HomeSlide[] = [{ kind: 'welcome' }];
  slideIndex = 0;
  private timer: any;
  private paused = false;
  private readonly reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  readonly benefits = [
    { icon: 'bag-check', title: 'Pide en línea', text: 'Arma tu pedido en la tienda que prefieras' },
    { icon: 'whatsapp', title: 'Confirmación por WhatsApp', text: 'La tienda te confirma y resuelve tus dudas' },
    { icon: 'credit-card', title: 'Paga como prefieras', text: 'Contado, contra entrega o en cuotas' },
    { icon: 'truck', title: 'Domicilio o recoge', text: 'Según lo que ofrezca cada tienda' },
  ];

  constructor(private cdr: ChangeDetectorRef, private zone: NgZone) {}

  ngOnInit(): void {
    if (this.section === 'main') this.startAutoplay();
  }

  ngOnChanges(): void {
    if (this.section !== 'main') return;
    this.slides = this.buildSlides();
    if (this.slideIndex >= this.slides.length) this.slideIndex = 0;
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  /** Bienvenida, hasta 2 tiendas destacadas y el producto más pedido. */
  private buildSlides(): HomeSlide[] {
    const slides: HomeSlide[] = [{ kind: 'welcome' }];
    for (const s of this.stores.filter((x) => x.promoted).slice(0, 2)) slides.push({ kind: 'store', store: s });
    const top = this.featured.find((p) => p.image) || null;
    if (top) slides.push({ kind: 'product', item: top, storeName: this.storeNameOf(top) });
    return slides;
  }

  /** La diapositiva visible es oscura (tienda destacada): los puntos se aclaran. */
  get darkSlide(): boolean {
    return this.slides[this.slideIndex]?.kind === 'store';
  }

  /** Hasta 4 fotos para el mosaico de la bienvenida. */
  get mosaic(): HomeItem[] {
    return this.products.filter((p) => p.image).slice(0, 4);
  }

  /** Lo más pedido (con foto primero), hasta 8 para la grilla. */
  get topProducts(): HomeItem[] {
    const list = this.featured.length ? this.featured : this.products;
    return [...list.filter((p) => p.image), ...list.filter((p) => !p.image)].slice(0, 8);
  }

  storeNameOf(p: HomeItem): string | null {
    return this.stores.find((s) => s.tenantId === p.strTenantId)?.name || null;
  }

  emoji(value: string): string {
    return SECTOR_EMOJI[value] || '🛍️';
  }

  // ── Carrusel ──

  goSlide(i: number): void {
    const n = this.slides.length;
    this.slideIndex = ((i % n) + n) % n;
    this.startAutoplay();
    this.cdr.markForCheck();
  }

  pause(on: boolean): void {
    this.paused = on;
  }

  private startAutoplay(): void {
    clearInterval(this.timer);
    if (this.reduced) return;
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        if (this.paused || this.slides.length < 2) return;
        this.zone.run(() => {
          this.slideIndex = (this.slideIndex + 1) % this.slides.length;
          this.cdr.markForCheck();
        });
      }, SLIDE_MS);
    });
  }

  submitSearch(): void {
    this.search.emit(this.term.trim());
  }

  money(v: number): string {
    return '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
  }

  trackById = (_: number, p: HomeItem) => p.strId;
  trackByTenant = (_: number, s: HomeStore) => s.tenantId;
  trackByValue = (_: number, s: HomeSector) => s.value;
  trackByIndex = (i: number) => i;
}
