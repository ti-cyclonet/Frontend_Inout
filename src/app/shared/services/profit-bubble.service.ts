import { Injectable } from '@angular/core';
import { formatCop } from '../utils/currency.util';

/** Ganancia que devuelve el backend al registrar una venta o facturar un pedido (common/sale-profit.ts). */
export interface SaleProfit {
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number | null;
  costIncomplete: boolean;
}

const SOUND_KEY = 'inout.profitSound';
const VISIBLE_MS = 7000;

/**
 * Burbuja temporal con la ganancia de la venta recién facturada, con un
 * "cha-ching" sintetizado (Web Audio, sin archivos). El sonido se puede
 * silenciar desde la misma burbuja (preferencia del navegador).
 */
@Injectable({ providedIn: 'root' })
export class ProfitBubbleService {
  private host: HTMLElement | null = null;
  private timer: any = null;
  private audio: AudioContext | null = null;

  get soundOn(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  private setSound(on: boolean): void {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {}
  }

  /** Muestra la burbuja (si la respuesta trae la ganancia). */
  show(profit: SaleProfit | null | undefined, label: string): void {
    if (!profit || typeof profit.profit !== 'number') return;
    this.close();
    const loss = profit.profit < 0;
    const el = document.createElement('div');
    el.className = 'profit-bubble' + (loss ? ' profit-bubble--loss' : '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      <style>
        .profit-bubble { position: fixed; right: 20px; bottom: 24px; z-index: 2000; max-width: 320px; padding: 14px 16px 12px;
          border-radius: 18px; background: linear-gradient(135deg, #16a34a, #0d9488); color: #fff; font-family: inherit;
          box-shadow: 0 12px 32px rgba(13, 148, 136, 0.35); animation: pb-in 0.45s cubic-bezier(0.22, 1, 0.36, 1); cursor: pointer; }
        .profit-bubble--loss { background: linear-gradient(135deg, #dc2626, #b45309); box-shadow: 0 12px 32px rgba(220, 38, 38, 0.3); }
        .profit-bubble .pb-top { display: flex; align-items: center; gap: 10px; }
        .profit-bubble .pb-icon { font-size: 1.9rem; line-height: 1; animation: pb-bounce 0.9s ease 0.2s 2; }
        .profit-bubble .pb-label { font-size: 0.78rem; opacity: 0.9; }
        .profit-bubble .pb-amount { font-size: 1.45rem; font-weight: 800; letter-spacing: -0.01em; }
        .profit-bubble .pb-detail { margin-top: 6px; font-size: 0.76rem; opacity: 0.92; line-height: 1.35; }
        .profit-bubble .pb-warn { margin-top: 6px; font-size: 0.72rem; background: rgba(255,255,255,0.18); border-radius: 8px; padding: 4px 7px; }
        .profit-bubble .pb-sound { position: absolute; top: 6px; right: 8px; border: none; background: transparent; color: #fff;
          font-size: 0.95rem; cursor: pointer; opacity: 0.85; padding: 2px; }
        .profit-bubble .pb-bar { height: 3px; margin-top: 9px; border-radius: 3px; background: rgba(255,255,255,0.75);
          transform-origin: left; animation: pb-bar ${VISIBLE_MS}ms linear forwards; }
        @keyframes pb-in { from { opacity: 0; transform: translateY(24px) scale(0.92); } }
        @keyframes pb-bounce { 50% { transform: translateY(-6px) rotate(-8deg); } }
        @keyframes pb-bar { to { transform: scaleX(0); } }
        @media (max-width: 480px) { .profit-bubble { left: 16px; right: 16px; max-width: none; } }
        @media (prefers-reduced-motion: reduce) { .profit-bubble, .profit-bubble .pb-icon { animation: none; } }
      </style>
      <button type="button" class="pb-sound" aria-label="${this.soundOn ? 'Silenciar' : 'Activar sonido'}">${this.soundOn ? '🔊' : '🔇'}</button>
      <div class="pb-top">
        <span class="pb-icon" aria-hidden="true">${loss ? '📉' : '💰'}</span>
        <div>
          <div class="pb-label">${loss ? 'Pérdida en' : 'Ganaste en'} ${this.esc(label)}</div>
          <div class="pb-amount">${loss ? '−' : '+'}${formatCop(Math.abs(profit.profit))}</div>
        </div>
      </div>
      <div class="pb-detail">Vendido ${formatCop(profit.revenue)} · costo ${formatCop(profit.cost)}${
        profit.marginPercent !== null ? ` · margen ${profit.marginPercent}%` : ''
      }</div>
      ${profit.costIncomplete ? '<div class="pb-warn">⚠ Algún producto no tiene costo registrado: la ganancia real puede ser menor.</div>' : ''}
      <div class="pb-bar"></div>`;

    el.querySelector('.pb-sound')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const on = !this.soundOn;
      this.setSound(on);
      const btn = ev.currentTarget as HTMLButtonElement;
      btn.textContent = on ? '🔊' : '🔇';
      btn.setAttribute('aria-label', on ? 'Silenciar' : 'Activar sonido');
      if (on) this.playSound(loss);
    });
    el.addEventListener('click', () => this.close());

    document.body.appendChild(el);
    this.host = el;
    this.timer = setTimeout(() => this.close(), VISIBLE_MS);
    if (this.soundOn) this.playSound(loss);
  }

  close(): void {
    clearTimeout(this.timer);
    this.host?.remove();
    this.host = null;
  }

  /** "Cha-ching": dos campanadas ascendentes (o una descendente si hubo pérdida). */
  private playSound(loss: boolean): void {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.audio = this.audio || new Ctx();
      const ctx = this.audio!;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const notes = loss ? [[440, 0], [330, 0.16]] : [[1318.5, 0], [1760, 0.11], [2637, 0.22]];
      for (const [freq, at] of notes) {
        const start = ctx.currentTime + at;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = loss ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      }
    } catch {
      // Sin audio disponible: la burbuja se muestra igual
    }
  }

  private esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }
}
