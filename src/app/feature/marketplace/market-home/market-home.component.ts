import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
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
}

export interface HomeSector {
  value: string;
  label: string;
  count: number;
}

export interface HomeItem {
  strId: string;
  strName: string;
  fltPrice: number;
  image?: string | null;
  strTenantId?: string;
  sales?: number;
}

const SECTOR_LOOK: Record<string, { emoji: string; hue: string }> = {
  '23': { emoji: '🍲', hue: 'food' },
  '24': { emoji: '👗', hue: 'fashion' },
  '25': { emoji: '🔧', hue: 'tools' },
  '26': { emoji: '🏡', hue: 'home' },
  '27': { emoji: '⚽', hue: 'sport' },
  '28': { emoji: '🛠️', hue: 'services' },
};

/** Palabras del titular por sector (las que haya en la vitrina; si no, todas). */
const SECTOR_WORDS: Record<string, string> = {
  '23': 'comida casera', '24': 'moda local', '25': 'ferretería', '26': 'hogar y salud', '27': 'deporte', '28': 'servicios',
};

/**
 * Vitrina de CycloNet Market (/marketplace/home) con identidad propia, distinta
 * de las tiendas de cada negocio: portada "aurora" animada con titular que
 * rota, buscador grande y collage flotante de productos; cinta de tiendas,
 * cifras, sectores, tiendas y lo más pedido. Solo presenta: buscar, filtrar,
 * abrir una tienda o un producto los resuelve el MarketPlace (eventos).
 * `section="cta"` pinta la franja para vendedores (va después del catálogo).
 */
@Component({
  selector: 'app-market-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RevealDirective],
  templateUrl: './market-home.component.html',
  styleUrls: ['./market-home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketHomeComponent implements OnInit, AfterViewInit, OnDestroy {
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

  @ViewChild('hero') heroRef?: ElementRef<HTMLElement>;
  @ViewChild('stats') statsRef?: ElementRef<HTMLElement>;

  term = '';
  wordIndex = 0;
  counters = { stores: 0, products: 0, sectors: 0 };
  private wordTimer: any;
  private statsIo?: IntersectionObserver;
  private raf = 0;
  private readonly reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(private cdr: ChangeDetectorRef, private zone: NgZone) {}

  get words(): string[] {
    const present = this.sectors.map((s) => SECTOR_WORDS[s.value]).filter(Boolean);
    return present.length >= 2 ? present : Object.values(SECTOR_WORDS);
  }

  /** Hasta 5 productos con foto para el collage de la portada. */
  get collage(): HomeItem[] {
    return this.products.filter((p) => p.image).slice(0, 5);
  }

  /** Cinta de tiendas: una fila de al menos 8 nombres, duplicada (se mueve -50% y empieza otra vez sin salto). */
  get marqueeStores(): HomeStore[] {
    if (!this.stores.length) return [];
    let row = [...this.stores];
    while (row.length < 8) row = [...row, ...this.stores];
    return [...row, ...row];
  }

  look(value: string) {
    return SECTOR_LOOK[value] || { emoji: '🛍️', hue: 'all' };
  }

  ngOnInit(): void {
    if (this.section !== 'main' || this.reduced) return;
    this.zone.runOutsideAngular(() => {
      this.wordTimer = setInterval(() => this.zone.run(() => {
        this.wordIndex = (this.wordIndex + 1) % Math.max(1, this.words.length);
        this.cdr.markForCheck();
      }), 2600);
    });
  }

  ngAfterViewInit(): void {
    if (this.section !== 'main') return;
    const target = { stores: this.stores.length, products: this.products.length, sectors: this.sectors.length };
    if (this.reduced || typeof IntersectionObserver === 'undefined' || !this.statsRef) {
      this.counters = target;
      this.cdr.markForCheck();
      return;
    }
    this.statsIo = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      this.statsIo?.disconnect();
      this.countUp(target);
    }, { threshold: 0.4 });
    this.statsIo.observe(this.statsRef.nativeElement);
  }

  ngOnDestroy(): void {
    clearInterval(this.wordTimer);
    this.statsIo?.disconnect();
    cancelAnimationFrame(this.raf);
  }

  private countUp(target: { stores: number; products: number; sectors: number }): void {
    const t0 = performance.now();
    const dur = 1400;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.counters = {
        stores: Math.round(target.stores * e),
        products: Math.round(target.products * e),
        sectors: Math.round(target.sectors * e),
      };
      this.cdr.markForCheck();
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame((n) => this.zone.run(() => step(n)))));
  }

  /** El collage sigue al mouse (variables CSS, sin detección de cambios). */
  onHeroMove(ev: MouseEvent): void {
    if (this.reduced || !this.heroRef) return;
    const el = this.heroRef.nativeElement;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((ev.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--my', ((ev.clientY - r.top) / r.height - 0.5).toFixed(3));
  }

  onHeroLeave(): void {
    this.heroRef?.nativeElement.style.setProperty('--mx', '0');
    this.heroRef?.nativeElement.style.setProperty('--my', '0');
  }

  submitSearch(): void {
    this.search.emit(this.term.trim());
  }

  money(v: number): string {
    return '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
  }

  pad(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  trackById = (_: number, p: HomeItem) => p.strId;
  trackByTenant = (_: number, s: HomeStore) => s.tenantId;
  trackByValue = (_: number, s: HomeSector) => s.value;
  trackByIndex = (i: number) => i;
}
