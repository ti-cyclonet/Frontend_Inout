import { Directive, HostListener, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

/**
 * Base de los paneles de módulo "en vivo" (mismo comportamiento que el
 * Dashboard): carga al entrar, se refresca cada `refreshMs` solo con la
 * pestaña visible, se pone al día al volver a la pestaña y conserva los datos
 * si una actualización falla (queda "Sin conexión" hasta el siguiente ciclo).
 */
@Directive()
export abstract class LivePanel<T> implements OnInit, OnDestroy {
  data: T | null = null;
  loading = true;
  refreshing = false;
  stale = false;
  error: string | null = null;
  lastUpdated: Date | null = null;

  protected refreshMs = 60_000;
  protected zone = inject(NgZone);
  private timer: any;
  private sub?: Subscription;

  /** Consulta del resumen del panel. */
  protected abstract fetch(): Observable<T>;
  /** Se llama con cada respuesta nueva (para derivar listas, gráficas, etc.). */
  protected onData(_data: T): void {}

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    this.refresh();
    this.timer = setInterval(() => { if (!document.hidden) this.refresh(); }, this.refreshMs);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.sub?.unsubscribe();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden && this.lastUpdated && Date.now() - this.lastUpdated.getTime() > 15_000) this.refresh();
  }

  refresh(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    this.sub?.unsubscribe();
    this.sub = this.fetch().subscribe({
      next: (d) => {
        this.data = d;
        this.onData(d);
        this.lastUpdated = new Date();
        this.loading = this.refreshing = this.stale = false;
        this.error = null;
      },
      error: () => {
        this.loading = this.refreshing = false;
        if (this.data) this.stale = true;
        else this.error = 'No se pudo cargar el resumen. Se reintentará automáticamente.';
      },
    });
  }

  /** Variación porcentual contra el periodo anterior (null si no hay base). */
  delta(current: number, previous: number): number | null {
    if (!previous) return current ? null : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  compactMoney(value: number): string {
    const v = Math.round(value || 0);
    if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
    if (Math.abs(v) >= 10_000) return '$' + Math.round(v / 1000).toLocaleString('es-CO') + ' mil';
    return '$' + v.toLocaleString('es-CO');
  }

  money(value: number): string {
    return '$' + Math.round(value || 0).toLocaleString('es-CO');
  }

  relativeTime(iso: string | Date): string {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  /** Barras de ranking: agrega `share` (0-100) respecto al mayor. */
  withShare<I extends { value: number }>(items: I[]): (I & { share: number })[] {
    const max = Math.max(1, ...items.map((i) => i.value));
    return items.map((i) => ({ ...i, share: Math.round((i.value / max) * 100) }));
  }
}
