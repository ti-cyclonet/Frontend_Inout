import { Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Ícono ⓘ con una explicación en un cuadro flotante: aparece al pasar el
 * mouse, al enfocarlo con el teclado o al tocarlo (móvil). El cuadro usa
 * posición fija calculada al abrir, para no quedar recortado por modales con
 * scroll. El texto va como contenido: <app-info-tip>Explicación…</app-info-tip>
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
    <span class="info-tip-bubble" role="tooltip" [class.open]="open" [style.top.px]="top" [style.left.px]="left">
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
export class InfoTipComponent {
  /** Texto para lectores de pantalla. */
  @Input() label = 'Más información';
  @ViewChild('trigger', { static: true }) trigger!: ElementRef<HTMLElement>;

  open = false;
  top = 0;
  left = 0;

  constructor(private host: ElementRef<HTMLElement>) {}

  show(): void {
    this.open = true;
    // Medir el cuadro ya con su contenido y ubicarlo debajo (o arriba si no cabe)
    requestAnimationFrame(() => this.place());
  }

  hide(): void {
    this.open = false;
  }

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.open ? this.hide() : this.show();
  }

  @HostListener('document:click')
  @HostListener('window:scroll')
  close(): void {
    if (this.open) this.hide();
  }

  private place(): void {
    const btn = this.trigger.nativeElement.getBoundingClientRect();
    const bubble = this.host.nativeElement.querySelector('.info-tip-bubble') as HTMLElement | null;
    if (!bubble) return;
    const b = bubble.getBoundingClientRect();
    const gap = 8;
    const margin = 16;
    let top = btn.bottom + gap;
    if (top + b.height > window.innerHeight - margin) top = Math.max(margin, btn.top - gap - b.height);
    let left = btn.left + btn.width / 2 - b.width / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - margin - b.width);
    this.top = top;
    this.left = left;
  }
}
