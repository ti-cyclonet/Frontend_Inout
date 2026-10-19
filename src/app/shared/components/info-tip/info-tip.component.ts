import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Ícono ⓘ con una explicación en un cuadro flotante: aparece al pasar el
 * mouse, al enfocarlo con el teclado o al tocarlo (móvil). El cuadro se mueve
 * al <body> y usa posición fija calculada al abrir: así no lo recortan modales
 * con scroll ni lo desplazan contenedores con transform. El texto va como contenido: <app-info-tip>Explicación…</app-info-tip>
 */
@Component({
  selector: 'app-info-tip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button #trigger type="button" class="info-tip-btn" [attr.aria-label]="label" [attr.aria-expanded]="open"
      (mouseenter)="show()" (mouseleave)="hide()" (focus)="show()" (blur)="hide()"
      (click)="toggle($event)">
      <svg viewBox="0 0 16 16" aria-hidden="true"><use xlink:href="./assets/icons/bootstrap-icons.svg#info-circle" /></svg>
    </button>
    <span #bubble class="info-tip-bubble" role="tooltip" [class.open]="open">
      <ng-content></ng-content>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; vertical-align: middle; margin-left: 0.3rem; }
    .info-tip-btn { border: 0; background: transparent; padding: 0; line-height: 1; color: #94a3b8; cursor: help; display: inline-flex; }
    .info-tip-btn:hover, .info-tip-btn:focus-visible, .info-tip-btn[aria-expanded="true"] { color: #f97316; outline: none; }
    .info-tip-btn svg { width: 15px; height: 15px; fill: currentColor; }
    .info-tip-bubble {
      position: fixed; z-index: 2000; width: max-content; max-width: min(300px, calc(100vw - 32px));
      background: #1f2937; color: #f9fafb; font: 400 0.78rem/1.4 var(--bs-body-font-family, system-ui, sans-serif) !important;
      text-align: left; text-transform: none; letter-spacing: normal; white-space: normal;
      padding: 0.55rem 0.7rem; border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0.12s ease;
    }
    .info-tip-bubble.open { opacity: 1; visibility: visible; }
    .info-tip-bubble ::ng-deep strong { font-weight: 700; }
  `],
})
export class InfoTipComponent implements AfterViewInit, OnDestroy {
  /** Texto para lectores de pantalla. */
  @Input() label = 'Más información';
  @ViewChild('trigger', { static: true }) trigger!: ElementRef<HTMLElement>;
  @ViewChild('bubble', { static: true }) bubble!: ElementRef<HTMLElement>;
  private readonly onAnyScroll = () => this.close();

  open = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    document.body.appendChild(this.bubble.nativeElement);
    // Cualquier scroll (también el de un modal) cierra el cuadro
    window.addEventListener('scroll', this.onAnyScroll, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onAnyScroll, true);
    this.bubble.nativeElement.remove();
  }

  show(): void {
    this.open = true;
    // Funciona también dentro de componentes OnPush (cierre por scroll o clic afuera)
    this.cdr.markForCheck();
    // Medir el cuadro ya con su contenido y ubicarlo debajo (o arriba si no cabe)
    requestAnimationFrame(() => this.place());
  }

  hide(): void {
    this.open = false;
    this.cdr.markForCheck();
  }

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.open ? this.hide() : this.show();
  }

  @HostListener('document:click')
  close(): void {
    if (this.open) this.hide();
  }

  private place(): void {
    const btn = this.trigger.nativeElement.getBoundingClientRect();
    const b = this.bubble.nativeElement.getBoundingClientRect();
    const gap = 8;
    const margin = 16;
    let top = btn.bottom + gap;
    if (top + b.height > window.innerHeight - margin) top = Math.max(margin, btn.top - gap - b.height);
    let left = btn.left + btn.width / 2 - b.width / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - margin - b.width);
    // Directo en el elemento: no depende de un ciclo de detección de cambios
    const el = this.bubble.nativeElement;
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }
}
