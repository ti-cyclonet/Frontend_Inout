import { NgZone } from '@angular/core';

/**
 * Paginación según el alto de la pantalla: cuántas filas (o tarjetas) caben en
 * el área visible de una lista sin hacer scroll.
 *
 * - `frame` (opcional) se estira hasta el borde inferior de la ventana, así la
 *   lista no deja espacio vacío abajo sea cual sea el tamaño de pantalla.
 * - `area` es la zona con scroll donde viven los ítems (debe tener alto propio:
 *   `flex: 1; min-height: 0; overflow: auto` dentro de un `frame` con alto fijo).
 * - Mide el primer ítem y cuántos hay por fila (tablas: 1; cuadrículas: N) y
 *   avisa con `onChange(cantidad)` solo cuando la cantidad cambia.
 *
 * Uso: crear en el componente, llamar `refresh()` en ngAfterViewChecked (es
 * barato: agrupa llamadas y corre fuera de Angular) y `destroy()` en ngOnDestroy.
 */
export interface FitRowsOptions {
  frame?: () => HTMLElement | null | undefined;
  area: () => HTMLElement | null | undefined;
  /** Selector de cada ítem dentro del área (p. ej. 'tbody tr' o '.customer-card'). */
  item: string;
  /** Encabezado dentro del área que también ocupa alto (p. ej. 'thead'). */
  header?: string;
  /** Alto supuesto de un ítem mientras no haya ninguno para medir. */
  fallbackItemHeight?: number;
  /**
   * Modo flujo: la tabla no vive en un contenedor de alto fijo sino que sigue
   * el flujo de la página. Cabe lo que hay desde su borde superior hasta el
   * inferior de la ventana (con la página arriba del todo), menos `reserveBelow`
   * px para lo que va debajo (barra de paginación, márgenes).
   */
  flow?: { reserveBelow: number };
  /** Mientras devuelva true no se mide (p. ej. cargando: el aviso de carga cambia el alto). */
  paused?: () => boolean;
  /** Mínimo de ítems por página. */
  min?: number;
  /** Margen libre bajo el `frame`, en px. */
  bottomGap?: number;
  /** Alto mínimo del `frame`, en px. */
  minFrameHeight?: number;
  onChange: (count: number) => void;
}

export class FitRows {
  private readonly ro: ResizeObserver | null;
  private observed: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = 0;
  private readonly onResize = () => this.refresh();

  constructor(private readonly zone: NgZone, private readonly o: FitRowsOptions) {
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.refresh()) : null;
    if (typeof window !== 'undefined') {
      this.zone.runOutsideAngular(() => window.addEventListener('resize', this.onResize));
    }
  }

  /** Recalcula en breve (agrupa varias llamadas seguidas). */
  refresh(): void {
    if (typeof window === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.fitFrame();
        this.watchArea();
        this.measure();
      }, 120);
    });
  }

  /** Olvida la última cantidad: el próximo cálculo vuelve a avisar (p. ej. al volver a "Automático"). */
  reset(): void {
    this.last = 0;
    this.refresh();
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.ro?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
  }

  private fitFrame(): void {
    const frame = this.o.frame?.();
    if (!frame || !frame.getClientRects().length) return; // oculto (otra pestaña)
    const top = frame.getBoundingClientRect().top;
    const height = Math.max(this.o.minFrameHeight ?? 320, Math.floor(window.innerHeight - top - (this.o.bottomGap ?? 12)));
    if (frame.style.height !== `${height}px`) frame.style.height = `${height}px`;
  }

  /** El área puede cambiar (tabla ↔ tarjetas, *ngIf): se observa la actual. */
  private watchArea(): void {
    const area = this.o.area() || null;
    if (area === this.observed) return;
    if (this.observed) this.ro?.unobserve(this.observed);
    this.observed = area;
    if (area) this.ro?.observe(area);
  }

  /** Alto desde el borde superior del área hasta el final de la ventana (o del contenedor con scroll). */
  private flowHeight(area: HTMLElement): number {
    let scroller: HTMLElement | null = area.parentElement;
    while (scroller && scroller !== document.body && scroller !== document.documentElement) {
      const oy = getComputedStyle(scroller).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && scroller.scrollHeight > scroller.clientHeight) break;
      scroller = scroller.parentElement;
    }
    const top = area.getBoundingClientRect().top;
    if (scroller && scroller !== document.body && scroller !== document.documentElement) {
      const box = scroller.getBoundingClientRect();
      return box.top + scroller.clientHeight - (top + scroller.scrollTop);
    }
    return window.innerHeight - (top + window.scrollY);
  }

  private measure(): void {
    const area = this.observed;
    if (!area || !area.clientHeight || this.o.paused?.()) return;
    const style = getComputedStyle(area);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const headerH = this.o.header ? area.querySelector(this.o.header)?.getBoundingClientRect().height || 0 : 0;
    const boxH = this.o.flow ? this.flowHeight(area) - this.o.flow.reserveBelow : area.clientHeight;
    const avail = boxH - padY - headerH;

    const items = area.querySelectorAll<HTMLElement>(this.o.item);
    let itemH = this.o.fallbackItemHeight ?? 40;
    if (items.length) itemH = items[0].getBoundingClientRect().height || itemH;
    // Tablas y listas: 1 por fila; cuadrículas: las columnas que pinta el navegador
    const cols = style.display.includes('grid') ? style.gridTemplateColumns.split(' ').filter(Boolean).length : 1;
    const perRow = Math.max(1, cols);
    const gap = parseFloat(style.rowGap) || 0; // cuadrículas de tarjetas
    const rows = Math.max(1, Math.floor((avail + gap) / (itemH + gap)));
    const count = Math.max(this.o.min ?? 3, rows * perRow);
    if (count === this.last) return;
    this.last = count;
    this.zone.run(() => this.o.onChange(count));
  }
}
