import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';

/**
 * Aparición al hacer scroll: agrega la clase `is-in` cuando el elemento entra
 * en pantalla (una sola vez). `mhReveal` es el retraso en ms para escalonar.
 * Sin IntersectionObserver (o con "reducir movimiento") se muestra de una.
 */
@Directive({ selector: '[mhReveal]', standalone: true })
export class RevealDirective implements AfterViewInit, OnDestroy {
  @Input() mhReveal: number | string = 0;
  private io?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    node.classList.add('mh-reveal');
    node.style.setProperty('--mh-delay', `${Number(this.mhReveal) || 0}ms`);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof IntersectionObserver === 'undefined' || reduced) {
      node.classList.add('is-in');
      return;
    }
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          node.classList.add('is-in');
          this.io?.disconnect();
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    this.io.observe(node);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }
}
