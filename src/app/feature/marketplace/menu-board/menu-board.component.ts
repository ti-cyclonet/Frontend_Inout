import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, QueryList, ViewChild, ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCop } from '../../../shared/utils/currency.util';
import { EMPTY_MENU_EXTRAS, MenuExtras, extraThumb, joinZones } from './menu-extras';

/** Diseños del menú de restaurante (valor guardado en marketplace_config.displayMode). */
export type MenuVariant = 'menu' | 'menu-chalk' | 'menu-clean';

export const MENU_VARIANTS: { value: MenuVariant; label: string; hint: string }[] = [
  { value: 'menu', label: 'Póster', hint: 'Colores cálidos y letras grandes, como un menú impreso' },
  { value: 'menu-chalk', label: 'Pizarra', hint: 'Pizarra verde con marco de madera y letra de tiza' },
  { value: 'menu-clean', label: 'Elegante', hint: 'Fondo oscuro con dorado y tipografía clásica' },
];

export function isMenuMode(mode: string | null | undefined): boolean {
  return !!mode && MENU_VARIANTS.some((v) => v.value === mode);
}

interface MenuSection {
  name: string;
  items: any[];
  /** Combos y promociones: tarjetas con foto en vez de renglones. */
  featured: boolean;
}

/**
 * Vista pública del MarketPlace como menú de restaurante (reemplaza la vitrina
 * de tarjetas). Solo presenta: el carrito, el stock y el checkout siguen en el
 * MarketplaceComponent, que recibe los eventos.
 */
@Component({
  selector: 'app-menu-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-board.component.html',
  styleUrls: ['./menu-board.component.css'],
  host: { '[attr.data-variant]': 'variant' },
})
export class MenuBoardComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() variant: MenuVariant = 'menu';
  @Input() products: any[] = [];
  @Input() businessName = '';
  /** Logo del negocio (opcional), sobre el título del menú. */
  @Input() logoUrl: string | null = null;
  @Input() tagline = '';
  @Input() whatsapp = '';
  /** Horario de pedidos de hoy ("Pedidos hoy · 6:30 p. m. – 10:00 p. m."); null si no hay. */
  @Input() hours: { open: boolean; label: string } | null = null;
  /** Promociones en curso, ya en texto ("Hora feliz -20% · hasta las 7:00 p. m."). */
  @Input() promos: string[] = [];
  /** Información de la carta: bloques (proteínas, salsas…), subtítulo, zonas y solo domicilios. */
  @Input() extras: MenuExtras = EMPTY_MENU_EXTRAS;
  /** Cantidad en el carrito por id de producto. */
  @Input() quantities: Record<string, number> = {};
  @Input() cartCount = 0;
  @Input() cartTotal = 0;
  /** Oculta la barra del pedido (p. ej. con el checkout abierto). */
  @Input() hideCartBar = false;
  /** Etiqueta de disponibilidad ("Agotado", "Bajo pedido"), la calcula el padre. */
  @Input() tagFor: (p: any) => { text: string; cls: string } | null = () => null;

  @Output() add = new EventEmitter<any>();
  @Output() decrease = new EventEmitter<any>();
  @Output() details = new EventEmitter<any>();
  @Output() checkout = new EventEmitter<void>();

  @ViewChild('tabsNav') private tabsNav?: ElementRef<HTMLElement>;
  @ViewChildren('sectionEl') private sectionEls!: QueryList<ElementRef<HTMLElement>>;

  sections: MenuSection[] = [];
  /** Pestañas: las secciones de platos y después los bloques de información. */
  tabs: string[] = [];
  thumb = extraThumb;
  heroImage: string | null = null;
  activeSection = '';

  /** Contenedor con scroll de la página (la tienda usa .scroll-container, no window). */
  private scroller: HTMLElement | Window | null = null;
  private spyFrame = 0;
  /** Mientras dura el scroll suave de goTo(), el seguimiento no cambia la pestaña. */
  private spyLockedUntil = 0;
  private readonly onScroll = () => {
    if (this.spyFrame) return;
    this.spyFrame = requestAnimationFrame(() => { this.spyFrame = 0; this.spy(); });
  };

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngOnInit(): void {
    this.loadFonts();
  }

  ngOnChanges(): void {
    const groups = new Map<string, any[]>();
    for (const p of this.products || []) {
      const name = (p.itemType === 'combo' || p.itemType === 'kit'
        ? 'Combos'
        : p.category?.name || (p.itemType && p.itemType !== 'product' ? 'Para acompañar' : 'Nuestro menú')).trim();
      groups.set(name, [...(groups.get(name) || []), p]);
    }
    // Los combos van primero
    this.sections = [...groups.entries()]
      .map(([name, items]) => ({ name, items, featured: name === 'Combos' }))
      .sort((a, b) => Number(b.name === 'Combos') - Number(a.name === 'Combos'));
    // Promociones: los ítems con precio de promoción, también en su propia sección (después de Combos)
    const promos = (this.products || []).filter((p) => p.itemType !== 'combo' && p.itemType !== 'kit' && p.promoLabel);
    if (promos.length) {
      const at = this.sections[0]?.name === 'Combos' ? 1 : 0;
      this.sections.splice(at, 0, { name: 'Promociones', items: promos, featured: true });
    }
    // Las tarjetas con foto solo tienen sentido si los ítems tienen foto
    for (const s of this.sections) {
      if (s.featured && !s.items.some((p) => p.image)) s.featured = false;
    }
    const extras = this.extras || EMPTY_MENU_EXTRAS;
    this.tabs = [...new Set([...this.sections.map((s) => s.name), ...extras.blocks.map((b) => b.title)])];
    if (!this.tabs.includes(this.activeSection)) this.activeSection = this.tabs[0] || '';
    this.heroImage = (this.products || []).find((p) => p.image)?.image || null;
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.scroller = this.findScroller();
    // Fuera de Angular: solo se entra a la zona cuando cambia la sección
    this.zone.runOutsideAngular(() => this.scroller!.addEventListener('scroll', this.onScroll, { passive: true }));
  }

  ngOnDestroy(): void {
    this.scroller?.removeEventListener('scroll', this.onScroll);
    if (this.spyFrame) cancelAnimationFrame(this.spyFrame);
  }

  /** El logo del negocio va en el círculo del encabezado; sin logo, la foto del primer plato. */
  get circuloEsLogo(): boolean { return !!this.logoUrl; }
  get circuloSrc(): string | null { return this.logoUrl || this.heroImage; }

  get titleWords(): { first: string; rest: string } {
    const words = (this.businessName || 'Nuestro menú').trim().split(/\s+/);
    return { first: words[0], rest: words.slice(1).join(' ') };
  }

  /** Texto de la cinta: el subtítulo de la tienda, o la sección única, o "Nuestro menú". */
  get ribbon(): string {
    return this.extras?.subtitle || (this.sections.length === 1 ? this.sections[0].name : 'Nuestro menú');
  }

  get zonesText(): string {
    return joinZones(this.extras?.deliveryZones || []);
  }

  get hasFooter(): boolean {
    return !!this.whatsappLink || !!this.extras?.deliveryZones.length || !!this.extras?.deliveryOnly;
  }

  /** Bloque con alguna foto: se muestra en renglones con la foto en círculo. */
  hasPhotos(block: { items: { imageUrl: string | null }[] }): boolean {
    return block.items.some((i) => !!i.imageUrl);
  }

  get whatsappLink(): string | null {
    const digits = (this.whatsapp || '').replace(/\D/g, '');
    if (!digits) return null;
    return `https://wa.me/${digits.length === 10 ? '57' + digits : digits}`;
  }

  get whatsappLabel(): string {
    const d = (this.whatsapp || '').replace(/\D/g, '').slice(-10);
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : this.whatsapp;
  }

  qty(p: any): number {
    return this.quantities[p.strId] || 0;
  }

  price(value: number): string {
    return formatCop(value);
  }

  sectionId(name: string): string {
    return 'mb-' + name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-');
  }

  goTo(name: string): void {
    this.setActive(name);
    this.spyLockedUntil = Date.now() + 900;
    const el = this.host.nativeElement.querySelector('#' + this.sectionId(name));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  trackById(_: number, p: any): string {
    return p.strId;
  }

  trackBySection(_: number, s: MenuSection): string {
    return s.name;
  }

  trackByName(_: number, name: string): string {
    return name;
  }

  trackByTitle(_: number, b: { title: string }): string {
    return b.title;
  }

  /**
   * Pestaña activa según la sección que se está leyendo: la última cuyo título
   * ya pasó bajo las pestañas fijas. Al llegar al final de la página, la última
   * (puede ser corta y no alcanzar a subir hasta las pestañas).
   */
  private spy(): void {
    if (Date.now() < this.spyLockedUntil) return;
    const els = this.sectionEls?.toArray().map((r) => r.nativeElement) || [];
    if (!els.length) return;
    const line = (this.tabsNav?.nativeElement.getBoundingClientRect().bottom ?? 0) + 24;
    let current = els[0];
    let currentTop = -Infinity;
    for (const el of els) {
      const top = el.getBoundingClientRect().top;
      // En la grilla de 2 columnas, entre secciones de la misma fila gana la primera
      if (top <= line && top > currentTop + 1) { current = el; currentTop = top; }
    }
    if (this.atBottom()) current = els[els.length - 1];
    const name = current.getAttribute('data-section');
    if (name && name !== this.activeSection) this.zone.run(() => this.setActive(name));
  }

  private atBottom(): boolean {
    const sc = this.scroller;
    if (!sc) return false;
    if (sc instanceof Window) return sc.innerHeight + sc.scrollY >= document.documentElement.scrollHeight - 4;
    return sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4;
  }

  private findScroller(): HTMLElement | Window {
    let el = this.host.nativeElement.parentElement;
    while (el) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') return el;
      el = el.parentElement;
    }
    return window;
  }

  /** Marca la pestaña y la centra en la fila de pestañas (sin mover la página). */
  private setActive(name: string): void {
    this.activeSection = name;
    const nav = this.tabsNav?.nativeElement;
    const tab = nav?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(name)}"]`);
    if (nav && tab) nav.scrollTo({ left: tab.offsetLeft - nav.clientWidth / 2 + tab.offsetWidth / 2, behavior: 'smooth' });
  }

  /** Fuentes de los diseños del menú: se cargan solo cuando se muestra un menú. */
  private loadFonts(): void {
    if (typeof document === 'undefined' || document.getElementById('menu-board-fonts')) return;
    const link = document.createElement('link');
    link.id = 'menu-board-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@600;700&family=Pacifico&family=Playfair+Display:ital,wght@0,500;0,700;1,500&display=swap';
    document.head.appendChild(link);
  }
}
