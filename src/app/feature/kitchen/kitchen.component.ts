import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { BusinessModules, BusinessModulesService } from '../../shared/services/business-modules.service';
import { PermissionsService } from '../../shared/services/permissions.service';
import { KitchenOrder, KitchenTimer, channelLabel, isWaitingSchedule, kitchenAction, kitchenTimer, scheduleStartsAt } from './kitchen.util';

interface KitchenResponse {
  serverTime: string;
  stageDurations: Record<string, number>;
  orders: KitchenOrder[];
}

/** Cada cuánto se consultan los pedidos y cada cuánto avanza el reloj. */
const REFRESH_MS = 15_000;
const CLOCK_MS = 5_000;
const SOUND_KEY = 'inout_kitchen_sound';

/**
 * Pantalla de preparación (Cocina / Producción / Alistamiento): los pedidos
 * por preparar a pantalla completa, con tiempos, alertas de atraso y un toque
 * para avanzarlos. Pensada para una tablet o TV en la cocina.
 */
@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './kitchen.component.html',
  styleUrls: ['./kitchen.component.css'],
})
export class KitchenComponent implements OnInit, OnDestroy {
  modules: BusinessModules | null = null;
  enabled = true;
  title = 'Cocina';
  loading = true;
  error = '';

  orders: KitchenOrder[] = [];
  stageDurations: Record<string, number> = {};
  now = Date.now();
  /** Diferencia entre el reloj del servidor y el del equipo. */
  private skew = 0;

  soundOn = false;
  fullscreen = false;
  busy = new Set<string>();

  private known: Set<string> | null = null;
  private lateAlerted = new Set<string>();
  private freshUntil = new Map<string, number>();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private wakeLock: any = null;
  private audio: AudioContext | null = null;
  private modulesSub?: { unsubscribe(): void };
  private onVisible = () => {
    if (document.visibilityState === 'visible') { this.load(); this.keepAwake(); }
  };
  private onFullscreen = () => { this.fullscreen = !!document.fullscreenElement; };

  readonly channelLabel = channelLabel;

  constructor(
    private http: HttpClient,
    private businessModules: BusinessModulesService,
    public permissions: PermissionsService,
    private host: ElementRef<HTMLElement>,
    private router: Router,
  ) {}

  /** Admin y operador, o el usuario de cocina. */
  get canAdvance(): boolean {
    return this.permissions.canEdit || this.permissions.isKitchen;
  }

  /** El usuario de cocina no tiene el resto del panel: sale cerrando sesión. */
  logout(): void {
    sessionStorage.clear();
    this.router.navigate(['/login']).then(() => setTimeout(() => window.location.reload(), 100));
  }

  ngOnInit(): void {
    try { this.soundOn = localStorage.getItem(SOUND_KEY) === '1'; } catch { /* sin almacenamiento */ }
    this.modulesSub = this.businessModules.modules$.subscribe((m) => {
      if (!m) return;
      this.modules = m;
      this.enabled = this.businessModules.isOn('kitchen', m);
      this.title = m.kitchenLabel;
    });
    this.load();
    this.refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') this.load(); }, REFRESH_MS);
    this.clockTimer = setInterval(() => this.tick(), CLOCK_MS);
    document.addEventListener('visibilitychange', this.onVisible);
    document.addEventListener('fullscreenchange', this.onFullscreen);
    this.keepAwake();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    this.modulesSub?.unsubscribe();
    this.wakeLock?.release?.().catch(() => {});
    this.audio?.close().catch(() => {});
  }

  // ─── Datos ───

  load(): void {
    this.http.get<KitchenResponse>(`${environment.apiUrl}/orders/kitchen`).subscribe({
      next: (res) => {
        this.loading = false;
        this.error = '';
        this.skew = res.serverTime ? new Date(res.serverTime).getTime() - Date.now() : 0;
        this.stageDurations = res.stageDurations || {};
        this.receive(res.orders || []);
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudieron cargar los pedidos. Reintentando…';
      },
    });
  }

  /** Pedidos nuevos: se resaltan y suenan (no en la primera carga). */
  private receive(orders: KitchenOrder[]): void {
    const now = Date.now();
    if (this.known) {
      const fresh = orders.filter((o) => !this.known!.has(o.id) && o.status !== 'READY');
      fresh.forEach((o) => this.freshUntil.set(o.id, now + 60_000));
      if (fresh.length) this.beep('new');
    }
    this.known = new Set(orders.map((o) => o.id));
    this.orders = orders;
    this.tick();
  }

  private tick(): void {
    this.now = Date.now() + this.skew;
    // Atrasos nuevos: un aviso por pedido y etapa
    for (const o of this.orders) {
      const key = `${o.id}:${o.status}`;
      if (o.status !== 'READY' && this.timer(o).level === 'late' && !this.lateAlerted.has(key)) {
        this.lateAlerted.add(key);
        this.beep('late');
      }
    }
  }

  // ─── Columnas ───

  get scheduled(): KitchenOrder[] {
    return this.orders.filter((o) => isWaitingSchedule(o, this.now))
      .sort((a, b) => scheduleStartsAt(a)!.getTime() - scheduleStartsAt(b)!.getTime());
  }
  get toPrepare(): KitchenOrder[] {
    return this.orders.filter((o) => o.status === 'CONFIRMED' && !isWaitingSchedule(o, this.now));
  }
  get preparing(): KitchenOrder[] {
    return this.orders.filter((o) => o.status === 'IN_PRODUCTION');
  }
  get ready(): KitchenOrder[] {
    return this.orders.filter((o) => o.status === 'READY');
  }
  get lateCount(): number {
    return this.orders.filter((o) => o.status !== 'READY' && !isWaitingSchedule(o, this.now) && this.timer(o).level === 'late').length;
  }

  timer(o: KitchenOrder): KitchenTimer {
    return kitchenTimer(o, this.now, this.stageDurations[o.status] || 0);
  }

  action(o: KitchenOrder) {
    return kitchenAction(o);
  }

  isFresh(o: KitchenOrder): boolean {
    return (this.freshUntil.get(o.id) || 0) > Date.now();
  }

  startsAt(o: KitchenOrder): string {
    const d = scheduleStartsAt(o);
    return d ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  }

  clock(): string {
    return new Date(this.now).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }

  trackById(_: number, o: KitchenOrder): string {
    return o.id;
  }

  // ─── Acciones ───

  advance(o: KitchenOrder): void {
    const act = kitchenAction(o);
    if (!act || !this.canAdvance || this.busy.has(o.id)) return;
    this.unlockAudio();
    this.busy.add(o.id);
    this.http.patch(`${environment.apiUrl}/orders/${o.id}/status`, { status: act.next }).subscribe({
      next: () => {
        this.busy.delete(o.id);
        this.freshUntil.delete(o.id);
        this.load();
      },
      error: (err) => {
        this.busy.delete(o.id);
        Swal.fire({ toast: true, position: 'top', icon: 'error', title: err?.error?.message || 'No se pudo actualizar el pedido', timer: 3000, showConfirmButton: false });
      },
    });
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    try { localStorage.setItem(SOUND_KEY, this.soundOn ? '1' : '0'); } catch { /* sin almacenamiento */ }
    if (this.soundOn) { this.unlockAudio(); this.beep('new'); }
  }

  toggleFullscreen(): void {
    this.unlockAudio();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else this.host.nativeElement.requestFullscreen?.().catch(() => {});
  }

  /** La pantalla no se apaga mientras esté abierta (si el navegador lo permite). */
  private async keepAwake(): Promise<void> {
    try {
      const nav: any = navigator;
      if (nav.wakeLock && !this.wakeLock) {
        this.wakeLock = await nav.wakeLock.request('screen');
        this.wakeLock.addEventListener?.('release', () => { this.wakeLock = null; });
      }
    } catch { /* no disponible */ }
  }

  // ─── Sonido ───

  /** El navegador solo deja sonar después de un toque del usuario. */
  private unlockAudio(): void {
    if (!this.soundOn) return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!this.audio && Ctx) this.audio = new Ctx();
      this.audio?.resume?.();
    } catch { /* sin audio */ }
  }

  /** Nuevo: dos tonos suaves. Atraso: tres tonos graves. */
  private beep(kind: 'new' | 'late'): void {
    if (!this.soundOn) return;
    this.unlockAudio();
    const ctx = this.audio;
    if (!ctx || ctx.state !== 'running') return;
    const notes = kind === 'new' ? [880, 1175] : [330, 330, 330];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'new' ? 'sine' : 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(kind === 'new' ? 0.25 : 0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }
}
