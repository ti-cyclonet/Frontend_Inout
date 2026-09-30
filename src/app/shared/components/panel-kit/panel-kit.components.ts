import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * Kit visual de los paneles de InOut (mismo lenguaje que el Dashboard):
 * encabezado "En vivo", tarjetas de indicador, indicadores secundarios,
 * "Requiere atención" y barras de ranking. Paleta: azul #0057B8 + degradados.
 */

export type PkTone = 'violet' | 'green' | 'rose' | 'blue' | 'orange' | 'gray';
const ICON = './assets/icons/bootstrap-icons.svg#';

// ─── Encabezado "En vivo" ────────────────────────────────────────────────────
@Component({
  selector: 'app-pk-live',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pk-live">
      <span class="pill" [class.stale]="stale" [title]="stale ? 'No se pudo actualizar; se reintentará' : 'Se actualiza solo'">
        <span class="dot"></span>{{ stale ? 'Sin conexión' : 'En vivo' }}
      </span>
      <span class="upd" *ngIf="updatedAt">Actualizado {{ label }}</span>
      <button type="button" class="pk-refresh" (click)="refresh.emit()" [disabled]="refreshing" title="Actualizar ahora">
        <svg viewBox="0 0 16 16" [class.spin]="refreshing"><use [attr.xlink:href]="icon + 'arrow-clockwise'"/></svg>
      </button>
    </div>`,
  styles: [`
    .pk-live { display: flex; align-items: center; gap: 0.65rem; }
    .pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.7rem; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 0.76rem; font-weight: 600; border: 1px solid #a7f3d0; }
    .pill.stale { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
    .pill.stale .dot { animation: none; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.45); } 70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
    .upd { color: #64748b; font-size: 0.78rem; white-space: nowrap; }
    .pk-refresh { width: 32px; height: 32px; border-radius: 10px; border: 1px solid #e6eaf2; background: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .pk-refresh svg { width: 15px; height: 15px; fill: #0b2545; }
    .pk-refresh:disabled { opacity: .6; cursor: default; }
    .spin { animation: spin .9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PkLiveComponent implements OnInit, OnDestroy {
  @Input() updatedAt: Date | null = null;
  @Input() stale = false;
  @Input() refreshing = false;
  @Output() refresh = new EventEmitter<void>();
  readonly icon = ICON;
  private now = Date.now();
  private timer: any;
  constructor(private zone: NgZone) {}
  ngOnInit(): void {
    this.zone.runOutsideAngular(() => { this.timer = setInterval(() => this.zone.run(() => (this.now = Date.now())), 5000); });
  }
  ngOnDestroy(): void { clearInterval(this.timer); }
  get label(): string {
    if (!this.updatedAt) return '';
    const s = Math.max(0, Math.round((this.now - this.updatedAt.getTime()) / 1000));
    return s < 10 ? 'justo ahora' : s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
  }
}

// ─── Variación ───────────────────────────────────────────────────────────────
@Component({
  selector: 'app-pk-delta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="chip" *ngIf="value === null" title="Sin datos del periodo anterior">Nuevo</span>
    <span class="chip" *ngIf="value !== null" [class.up]="value > 0" [class.down]="value < 0">{{ value > 0 ? '▲ +' : value < 0 ? '▼ ' : '• ' }}{{ value }}%</span>`,
  styles: [`
    .chip { display: inline-flex; padding: 0.12rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; background: #f1f5f9; color: #475569; white-space: nowrap; }
    .up { background: #ecfdf5; color: #047857; } .down { background: #fef2f2; color: #b91c1c; }
  `],
})
export class PkDeltaComponent {
  @Input() value: number | null = 0;
}

// ─── Tarjeta de indicador ────────────────────────────────────────────────────
@Component({
  selector: 'app-pk-kpi',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="kpi" [class.alert]="alert">
      <div class="top">
        <span class="ic" [ngClass]="'g-' + tone"><svg viewBox="0 0 16 16"><use [attr.xlink:href]="iconBase + icon"/></svg></span>
        <span class="lbl">{{ label }}</span>
      </div>
      <div class="val" [title]="title || ''">{{ value }}</div>
      <div class="foot"><ng-content></ng-content></div>
    </article>`,
  styles: [`
    :host { display: block; min-width: 0; }
    .kpi { position: relative; overflow: hidden; height: 100%; box-sizing: border-box; background: #fff; border: 1px solid #e6eaf2; border-radius: 16px; padding: 1.05rem 1.15rem 0.95rem; box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.05); transition: transform .2s, box-shadow .2s; }
    .kpi:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(15,23,42,.08); }
    .kpi::after { content: ''; position: absolute; right: -40px; top: -40px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(0,87,184,.07), transparent 70%); pointer-events: none; }
    .kpi.alert { border-color: #fecdd3; }
    .top { display: flex; align-items: center; gap: 0.6rem; }
    .ic { width: 34px; height: 34px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 6px 14px rgba(0,87,184,.18); }
    .ic svg { width: 16px; height: 16px; fill: #fff; }
    .lbl { font-size: 0.8rem; font-weight: 600; color: #64748b; }
    .val { margin: 0.75rem 0 0.5rem; font-size: clamp(1.4rem, 2.1vw, 1.85rem); font-weight: 700; letter-spacing: -0.02em; color: #0b2545; font-variant-numeric: tabular-nums; }
    .foot { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; font-size: 0.75rem; color: #64748b; min-height: 1.1rem; }
    .g-violet { background: linear-gradient(135deg,#667eea,#764ba2); } .g-green { background: linear-gradient(135deg,#11998e,#38ef7d); }
    .g-rose { background: linear-gradient(135deg,#f093fb,#f5576c); } .g-blue { background: linear-gradient(135deg,#4facfe,#0057b8); }
    .g-orange { background: linear-gradient(135deg,#ffb347,#ff7000); } .g-gray { background: linear-gradient(135deg,#94a3b8,#64748b); }
  `],
})
export class PkKpiComponent {
  @Input() icon = 'bar-chart';
  @Input() tone: PkTone = 'blue';
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() title?: string;
  @Input() alert = false;
  readonly iconBase = ICON;
}

// ─── Indicador secundario ────────────────────────────────────────────────────
@Component({
  selector: 'app-pk-mini',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mini">
      <div class="ring" *ngIf="ring !== undefined; else ic" [style.--p]="ring ?? 0"><span>{{ ring === null ? '—' : ring + '%' }}</span></div>
      <ng-template #ic><span class="ic" [ngClass]="'g-' + tone"><svg viewBox="0 0 16 16"><use [attr.xlink:href]="iconBase + icon"/></svg></span></ng-template>
      <div class="txt"><strong>{{ title }}</strong><small>{{ sub }}</small></div>
    </div>`,
  styles: [`
    :host { display: block; min-width: 0; }
    .mini { display: flex; align-items: center; gap: 0.75rem; height: 100%; box-sizing: border-box; background: #fff; border: 1px solid #e6eaf2; border-radius: 14px; padding: 0.8rem 0.95rem; }
    .txt { min-width: 0; } .txt strong { display: block; font-size: 0.9rem; color: #0b2545; } .txt small { display: block; color: #64748b; font-size: 0.74rem; margin-top: 0.1rem; }
    .ic { width: 36px; height: 36px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ic svg { width: 16px; height: 16px; fill: #fff; }
    .ring { --p: 0; width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: conic-gradient(#38ef7d calc(var(--p) * 1%), #eef1f6 0); }
    .ring span { width: 34px; height: 34px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-size: 0.68rem; font-weight: 700; color: #0b2545; }
    .g-violet { background: linear-gradient(135deg,#667eea,#764ba2); } .g-green { background: linear-gradient(135deg,#11998e,#38ef7d); }
    .g-rose { background: linear-gradient(135deg,#f093fb,#f5576c); } .g-blue { background: linear-gradient(135deg,#4facfe,#0057b8); }
    .g-orange { background: linear-gradient(135deg,#ffb347,#ff7000); } .g-gray { background: linear-gradient(135deg,#94a3b8,#64748b); }
  `],
})
export class PkMiniComponent {
  @Input() icon = 'info-circle';
  @Input() tone: PkTone = 'blue';
  /** Porcentaje para mostrar un anillo en vez de ícono (null = sin dato). */
  @Input() ring?: number | null;
  @Input() title = '';
  @Input() sub = '';
  readonly iconBase = ICON;
}

// ─── Requiere atención ───────────────────────────────────────────────────────
export interface PkAttention {
  icon: string;
  tone: 'danger' | 'warning' | 'info';
  count: number;
  label: string;
  detail: string;
  /** Ruta, o acción (click) si no hay ruta. */
  link?: string;
  query?: Record<string, string>;
  action?: () => void;
}
export interface PkRow { tone: 'danger' | 'warning' | 'info'; main: string; meta: string }

@Component({
  selector: 'app-pk-attention',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ul class="attn" *ngIf="items.length; else ok">
      <li *ngFor="let a of items; trackBy: byLabel" [ngClass]="'t-' + a.tone">
        <a *ngIf="a.link; else btn" [routerLink]="a.link" [queryParams]="a.query">
          <ng-container *ngTemplateOutlet="row; context: { $implicit: a }"></ng-container>
        </a>
        <ng-template #btn><button type="button" (click)="a.action && a.action()"><ng-container *ngTemplateOutlet="row; context: { $implicit: a }"></ng-container></button></ng-template>
      </li>
    </ul>
    <ng-template #row let-a>
      <span class="ic"><svg viewBox="0 0 16 16"><use [attr.xlink:href]="iconBase + a.icon"/></svg></span>
      <span class="body"><strong>{{ a.label }}</strong><small>{{ a.detail }}</small></span>
      <span class="count">{{ a.count }}</span>
    </ng-template>
    <ng-template #ok>
      <div class="ok">
        <svg viewBox="0 0 16 16"><use [attr.xlink:href]="iconBase + 'check-circle-fill'"/></svg>
        <strong>Todo al día</strong><small>{{ emptyText }}</small>
      </div>
    </ng-template>
    <div class="rows" *ngIf="rows.length">
      <div class="r" *ngFor="let r of rows"><span class="d" [ngClass]="'d-' + r.tone"></span><span class="m">{{ r.main }}</span><span class="x">{{ r.meta }}</span></div>
    </div>`,
  styles: [`
    .attn { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .attn a, .attn button { width: 100%; display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0.7rem; border-radius: 12px; text-decoration: none; color: inherit; border: 1px solid transparent; background: none; text-align: left; cursor: pointer; font: inherit; }
    .attn a:hover, .attn button:hover { background: #f7f9fc; border-color: #e6eaf2; }
    .ic { width: 32px; height: 32px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ic svg { width: 15px; height: 15px; fill: currentColor; }
    .t-danger .ic { background: #fff1f2; color: #e11d48; } .t-warning .ic { background: #fff7ed; color: #ea7a0b; } .t-info .ic { background: #eef4fc; color: #0057b8; }
    .body { flex: 1; min-width: 0; } .body strong { display: block; font-size: 0.86rem; color: #0b2545; } .body small { display: block; color: #64748b; font-size: 0.74rem; }
    .count { font-weight: 800; font-size: 1.02rem; color: #0b2545; font-variant-numeric: tabular-nums; } .t-danger .count { color: #e11d48; }
    .ok { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.3rem; padding: 1.4rem 1rem; }
    .ok svg { width: 34px; height: 34px; fill: #11998e; } .ok strong { color: #0b2545; } .ok small { color: #64748b; max-width: 280px; }
    .rows { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed #e6eaf2; display: flex; flex-direction: column; gap: 0.4rem; }
    .r { display: flex; align-items: center; gap: 0.5rem; font-size: 0.77rem; }
    .m { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #0b2545; } .x { color: #64748b; white-space: nowrap; }
    .d { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; } .d-danger { background: #e11d48; } .d-warning { background: #f5a623; } .d-info { background: #0057b8; }
  `],
})
export class PkAttentionComponent {
  @Input() items: PkAttention[] = [];
  @Input() rows: PkRow[] = [];
  @Input() emptyText = 'No hay nada pendiente.';
  readonly iconBase = ICON;
  byLabel = (_: number, a: PkAttention) => a.label;
}

// ─── Barras de ranking ───────────────────────────────────────────────────────
export interface PkBar { name: string; value: number; share: number; label?: string; sub?: string }

@Component({
  selector: 'app-pk-bars',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul class="bars" *ngIf="items.length; else none">
      <li *ngFor="let b of items; let i = index; trackBy: byName">
        <span class="rank">{{ i + 1 }}</span>
        <span class="body">
          <span class="name">{{ b.name }}<small *ngIf="b.sub"> · {{ b.sub }}</small></span>
          <span class="track"><span [style.width.%]="b.share" [ngClass]="'g-' + tone"></span></span>
        </span>
        <span class="val">{{ b.label ?? b.value }}</span>
      </li>
    </ul>
    <ng-template #none><p class="empty">{{ emptyText }}</p></ng-template>`,
  styles: [`
    .bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
    .bars li { display: flex; align-items: center; gap: 0.6rem; }
    .rank { width: 24px; height: 24px; border-radius: 8px; background: #eef4fc; color: #0057b8; font-size: 0.74rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .name { font-size: 0.81rem; font-weight: 600; color: #0b2545; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .name small { color: #64748b; font-weight: 500; }
    .track { height: 7px; border-radius: 999px; background: #f1f4f9; overflow: hidden; } .track span { display: block; height: 100%; border-radius: 999px; transition: width .6s ease; }
    .val { font-size: 0.81rem; font-weight: 700; color: #0b2545; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .empty { color: #64748b; font-size: 0.84rem; margin: 1.2rem 0; text-align: center; }
    .g-violet { background: linear-gradient(90deg,#667eea,#764ba2); } .g-green { background: linear-gradient(90deg,#11998e,#38ef7d); }
    .g-rose { background: linear-gradient(90deg,#f093fb,#f5576c); } .g-blue { background: linear-gradient(90deg,#4facfe,#0057b8); }
    .g-orange { background: linear-gradient(90deg,#ffb347,#ff7000); } .g-gray { background: linear-gradient(90deg,#94a3b8,#64748b); }
  `],
})
export class PkBarsComponent {
  @Input() items: PkBar[] = [];
  @Input() tone: PkTone = 'green';
  @Input() emptyText = 'Sin datos todavía.';
  byName = (_: number, b: PkBar) => b.name;
}

/** Todo el kit, para importar de una vez en los paneles. */
export const PANEL_KIT = [PkLiveComponent, PkDeltaComponent, PkKpiComponent, PkMiniComponent, PkAttentionComponent, PkBarsComponent] as const;
