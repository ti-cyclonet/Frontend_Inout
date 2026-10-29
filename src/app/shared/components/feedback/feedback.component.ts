import { Component, HostListener, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const HIGHLIGHTS: [string, string][] = [
  ['inventario', 'Inventario'], ['productos', 'Productos'], ['ventas', 'Ventas'], ['pedidos', 'Pedidos'], ['market', 'Market'],
  ['cartera', 'Cartera'], ['domicilios', 'Domicilios'], ['reportes', 'Reportes'], ['soporte', 'Soporte'],
];
/** «Ahora no» oculta la invitación por 30 días en este equipo. */
const DISMISS_DAYS = 30;
/** Otras pantallas abren la ventana con `window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT))`. */
export const OPEN_FEEDBACK_EVENT = 'inout:open-feedback';

/**
 * «Danos tu opinión»: ventana para calificar InOut (también se abre desde el
 * menú del usuario) y una invitación discreta en los buenos momentos (un mes
 * de uso, 100 ventas o el primer pedido del Market).
 */
@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Invitación -->
    <div class="fb-invite" *ngIf="invite && !show" role="dialog" aria-label="Invitación a opinar">
      <button type="button" class="fb-x" (click)="dismiss()" aria-label="Cerrar">×</button>
      <b>{{ invite }}</b>
      <p>¿Cómo te ha ido? Tu opinión nos ayuda a mejorar y, si quieres, a que otros negocios conozcan InOut.</p>
      <div class="fb-row">
        <button type="button" class="fb-btn" (click)="open()">Dar mi opinión</button>
        <button type="button" class="fb-link" (click)="dismiss()">Ahora no</button>
      </div>
    </div>

    <!-- Ventana -->
    <div class="fb-backdrop" *ngIf="show" (click)="close()"></div>
    <div class="fb-modal" *ngIf="show" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <button type="button" class="fb-x" (click)="close()" aria-label="Cerrar">×</button>

      <ng-container *ngIf="!result">
        <h3 id="fb-title">¿Cómo te ha ido con InOut?</h3>
        <div class="fb-stars" role="radiogroup" aria-label="Calificación">
          <button type="button" *ngFor="let n of [1,2,3,4,5]" [class.on]="n <= (hover || rating)" (mouseenter)="hover = n" (mouseleave)="hover = 0"
                  (click)="rating = n" role="radio" [attr.aria-checked]="rating === n" [attr.aria-label]="n + ' estrellas'">★</button>
        </div>
        <p class="fb-hint">{{ ratingText }}</p>

        <label class="fb-label">Cuéntanos tu experiencia
          <textarea rows="4" [(ngModel)]="comment" maxlength="1000" placeholder="¿Qué te ha servido? ¿Qué mejorarías?"></textarea>
        </label>

        <p class="fb-label">¿Qué te ha ayudado más? <small>(opcional)</small></p>
        <div class="fb-chips">
          <button type="button" *ngFor="let h of highlights" [class.on]="picked.has(h[0])" (click)="toggle(h[0])">{{ h[1] }}</button>
        </div>

        <div class="fb-two">
          <label class="fb-label">Tu nombre<input type="text" [(ngModel)]="authorName" maxlength="120"></label>
          <label class="fb-label">Ciudad <small>(opcional)</small><input type="text" [(ngModel)]="city" maxlength="80"></label>
        </div>

        <label class="fb-check"><input type="checkbox" [(ngModel)]="consentPublish">
          Autorizo a CycloNet a publicar mi opinión con mi nombre, el de mi negocio y mi ciudad en sus páginas web.</label>
        <label class="fb-check" [class.off]="!consentPublish"><input type="checkbox" [(ngModel)]="consentLogo" [disabled]="!consentPublish">
          También pueden mostrar el logo de mi negocio.</label>
        <p class="fb-legal">Puedes pedir que la retiremos cuando quieras. Ver el <a href="https://cyclonet.com.co/legal/tratamiento-datos.html" target="_blank" rel="noopener">tratamiento de datos</a>.</p>

        <p class="fb-error" *ngIf="error">{{ error }}</p>
        <button type="button" class="fb-btn fb-send" [disabled]="sending" (click)="send()">{{ sending ? 'Enviando…' : 'Enviar opinión' }}</button>
      </ng-container>

      <div class="fb-done" *ngIf="result">
        <div class="fb-ok">✓</div>
        <h3>¡Gracias, {{ firstName }}!</h3>
        <p *ngIf="rating >= 4">Recibimos tu opinión. {{ consentPublish ? 'La revisaremos antes de publicarla.' : '' }}</p>
        <p *ngIf="rating < 4">Lamentamos que no haya sido la mejor experiencia. Nuestro equipo te va a contactar para entender qué pasó y ayudarte.</p>
        <a *ngIf="result.googleReviewUrl" class="fb-btn" [href]="result.googleReviewUrl" target="_blank" rel="noopener">¿Nos dejas también una reseña en Google?</a>
        <button type="button" class="fb-link" (click)="close()">Cerrar</button>
      </div>
    </div>
  `,
  styles: [`
    .fb-invite { position: fixed; left: 18px; bottom: 18px; z-index: 1040; width: min(340px, calc(100vw - 36px)); background: #fff; border-radius: 14px;
      box-shadow: 0 10px 30px rgba(15,23,42,.18); padding: 16px 18px; border-left: 4px solid #f59e0b; font-size: .9rem; }
    /* Con el menú inferior en móvil, la invitación va por encima de la barra y del botón de Domicilios */
    :host-context(body.inout-bottom-nav) .fb-invite { bottom: calc(140px + env(safe-area-inset-bottom, 0px)); max-height: calc(100vh - 220px); overflow-y: auto; }
    .fb-invite b { display: block; margin-bottom: 4px; color: #0f172a; }
    .fb-invite p { margin: 0 0 10px; color: #475569; }
    .fb-row { display: flex; gap: 10px; align-items: center; }
    .fb-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 1060; }
    .fb-modal { position: fixed; z-index: 1061; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 24px));
      max-height: calc(100vh - 24px); overflow: auto; background: #fff; border-radius: 16px; padding: 22px 24px; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
    .fb-modal h3 { margin: 0 0 8px; font-size: 1.25rem; }
    .fb-x { position: absolute; right: 10px; top: 6px; border: 0; background: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer; }
    .fb-stars { display: flex; gap: 4px; }
    .fb-stars button { border: 0; background: none; font-size: 2.1rem; line-height: 1; color: #e2e8f0; cursor: pointer; padding: 0 2px; }
    .fb-stars button.on { color: #f59e0b; }
    .fb-hint { margin: 2px 0 12px; color: #64748b; font-size: .85rem; min-height: 1.2em; }
    .fb-label { display: grid; gap: 4px; font-size: .85rem; font-weight: 600; color: #334155; margin: 0 0 10px; }
    .fb-label small { font-weight: 400; color: #94a3b8; }
    .fb-label textarea, .fb-label input { font: inherit; font-weight: 400; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 10px; }
    .fb-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 12px; }
    .fb-chips button { border: 1px solid #cbd5e1; background: #fff; border-radius: 999px; padding: 4px 11px; font-size: .8rem; cursor: pointer; }
    .fb-chips button.on { background: #ede9fe; border-color: #8b5cf6; color: #5b21b6; }
    .fb-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .fb-check { display: flex; gap: 8px; align-items: flex-start; font-size: .82rem; color: #334155; margin: 4px 0; }
    .fb-check.off { opacity: .5; }
    .fb-legal { font-size: .75rem; color: #94a3b8; margin: 6px 0 10px; }
    .fb-error { color: #b91c1c; font-size: .85rem; }
    .fb-btn { display: inline-block; border: 0; border-radius: 10px; padding: 9px 16px; background: #e65c00; color: #fff; font-weight: 600; cursor: pointer; text-decoration: none; }
    .fb-btn:disabled { opacity: .6; }
    .fb-send { width: 100%; }
    .fb-link { border: 0; background: none; color: #64748b; cursor: pointer; text-decoration: underline; font-size: .85rem; }
    .fb-done { text-align: center; display: grid; gap: 10px; justify-items: center; padding: 8px 0; }
    .fb-done p { margin: 0; color: #475569; }
    .fb-ok { width: 54px; height: 54px; border-radius: 50%; background: #dcfce7; color: #166534; font-size: 1.8rem; display: grid; place-items: center; }
    @media (max-width: 520px) { .fb-two { grid-template-columns: 1fr; } }
  `],
})
export class FeedbackComponent implements OnInit {
  @Input() userName: string | null = null;

  readonly highlights = HIGHLIGHTS;
  show = false;
  invite: string | null = null;
  rating = 0;
  hover = 0;
  comment = '';
  picked = new Set<string>();
  authorName = '';
  city = '';
  consentPublish = false;
  consentLogo = false;
  sending = false;
  error = '';
  result: { status: string; googleReviewUrl?: string | null } | null = null;

  constructor(private http: HttpClient) {}

  private get dismissKey(): string { return `inout_feedback_dismissed_${sessionStorage.getItem('user_id') || ''}`; }

  ngOnInit(): void {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem('user_rol') === 'clienteInout') return;
    try {
      const at = Number(localStorage.getItem(this.dismissKey) || 0);
      if (at && Date.now() - at < DISMISS_DAYS * 86400000) return;
    } catch { /* sin almacenamiento: se consulta igual */ }
    this.http.get<{ invite: boolean; reason: string | null }>(`${environment.apiUrl}/feedback/invitation`).subscribe({
      next: (r) => { this.invite = r?.invite ? r.reason : null; },
      error: () => { this.invite = null; },
    });
  }

  get firstName(): string { return (this.authorName || '').trim().split(' ')[0] || ''; }
  get ratingText(): string {
    return ['Toca las estrellas para calificar', 'Muy mala', 'Mala', 'Regular', 'Buena', '¡Excelente!'][this.hover || this.rating];
  }

  @HostListener('window:' + OPEN_FEEDBACK_EVENT)
  open(): void {
    this.authorName = this.authorName || this.userName || sessionStorage.getItem('user_displayName') || sessionStorage.getItem('user_name') || '';
    this.result = null;
    this.error = '';
    this.show = true;
  }

  close(): void {
    this.show = false;
    if (this.result) this.invite = null;
  }

  dismiss(): void {
    this.invite = null;
    try { localStorage.setItem(this.dismissKey, String(Date.now())); } catch { /* sin almacenamiento */ }
  }

  toggle(h: string): void { this.picked.has(h) ? this.picked.delete(h) : this.picked.add(h); }

  send(): void {
    this.error = '';
    if (!this.rating) { this.error = 'Elige de 1 a 5 estrellas.'; return; }
    if (this.comment.trim().length < 10) { this.error = 'Cuéntanos un poco más (mínimo 10 caracteres).'; return; }
    this.sending = true;
    this.http.post<any>(`${environment.apiUrl}/feedback`, {
      rating: this.rating,
      comment: this.comment.trim(),
      highlights: [...this.picked],
      authorName: this.authorName.trim(),
      city: this.city.trim(),
      consentPublish: this.consentPublish,
      consentLogo: this.consentPublish && this.consentLogo,
    }).subscribe({
      next: (r) => { this.sending = false; this.result = r || { status: 'PENDIENTE' }; },
      error: (err) => {
        this.sending = false;
        const msg = err?.error?.message;
        this.error = Array.isArray(msg) ? msg[0] : msg || 'No se pudo enviar tu opinión. Intenta de nuevo.';
      },
    });
  }
}
