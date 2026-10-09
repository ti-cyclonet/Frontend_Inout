import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatCop } from '../../../shared/utils/currency.util';

/** Diseños del menú de restaurante (valor guardado en marketplace_config.displayMode). */
export type MenuVariant = 'menu' | 'menu-chalk' | 'menu-clean';

export const MENU_VARIANTS: { value: MenuVariant; label: string; hint: string }[] = [
  { value: 'menu', label: 'Póster', hint: 'Colores cálidos y letras grandes, como un menú impreso' },
  { value: 'menu-chalk', label: 'Pizarra', hint: 'Fondo oscuro con letra de tiza' },
  { value: 'menu-clean', label: 'Elegante', hint: 'Claro y sobrio, tipografía clásica' },
];

export function isMenuMode(mode: string | null | undefined): boolean {
  return !!mode && MENU_VARIANTS.some((v) => v.value === mode);
}

interface MenuSection {
  name: string;
  items: any[];
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
export class MenuBoardComponent implements OnInit, OnChanges {
  @Input() variant: MenuVariant = 'menu';
  @Input() products: any[] = [];
  @Input() businessName = '';
  /** Logo del negocio (opcional), sobre el título del menú. */
  @Input() logoUrl: string | null = null;
  @Input() tagline = '';
  @Input() whatsapp = '';
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

  sections: MenuSection[] = [];
  heroImage: string | null = null;
  activeSection = '';

  constructor(private host: ElementRef<HTMLElement>) {}

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
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => Number(b.name === 'Combos') - Number(a.name === 'Combos'));
    // Promociones: los ítems con precio de promoción, también en su propia sección (después de Combos)
    const promos = (this.products || []).filter((p) => p.itemType !== 'combo' && p.itemType !== 'kit' && p.promoLabel);
    if (promos.length) {
      const at = this.sections[0]?.name === 'Combos' ? 1 : 0;
      this.sections.splice(at, 0, { name: 'Promociones', items: promos });
    }
    if (!this.sections.some((s) => s.name === this.activeSection)) this.activeSection = this.sections[0]?.name || '';
    this.heroImage = (this.products || []).find((p) => p.image)?.image || null;
  }

  /** El logo del negocio va en el círculo del encabezado; sin logo, la foto del primer plato. */
  get circuloEsLogo(): boolean { return !!this.logoUrl; }
  get circuloSrc(): string | null { return this.logoUrl || this.heroImage; }

  get titleWords(): { first: string; rest: string } {
    const words = (this.businessName || 'Nuestro menú').trim().split(/\s+/);
    return { first: words[0], rest: words.slice(1).join(' ') };
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

  goTo(section: MenuSection): void {
    this.activeSection = section.name;
    const el = this.host.nativeElement.querySelector('#' + this.sectionId(section.name));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  trackById(_: number, p: any): string {
    return p.strId;
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
