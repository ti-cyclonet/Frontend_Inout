import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { splitPlanLabel } from '../order-tracking/order-labels';
import {
  DEFAULT_THANKS_MESSAGES, THANKS_MAX_LENGTH, THANKS_STYLES, ThanksMessages, ThanksTextKey, fillThanks, isThanksStyle, loadThanksFonts,
} from '../order-tracking/thanks-messages';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** WhatsApp y mensaje de bienvenida de la tienda (marketplace-config/:tenantId/store-info). */
interface StoreInfo {
  whatsapp: string;
  welcomeMessage: string;
}

/** Igual que WELCOME_MAX_LENGTH del backend (store-info.ts). */
const WELCOME_MAX_LENGTH = 300;

/**
 * Configuración de ventas del MarketPlace (modo administrador): datos de la
 * tienda (WhatsApp y bienvenida), formas de pago
 * que ofrece la tienda, pedidos programados (horario de entregas y franjas) y
 * los textos del agradecimiento al entregar el pedido.
 * El backend normaliza y valida los rangos (payment-plans.ts / scheduling.ts).
 */
@Component({
  selector: 'app-marketplace-sales-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marketplace-sales-settings.component.html',
  styleUrls: ['./marketplace-sales-settings.component.css'],
})
export class MarketplaceSalesSettingsComponent implements OnChanges {
  @Input() tenantId = '';

  payments: any = null;
  scheduling: any = null;
  savingPayments = false;
  savingScheduling = false;
  thanks: ThanksMessages | null = null;
  savingThanks = false;
  maxLen = THANKS_MAX_LENGTH;
  thanksStyles = THANKS_STYLES;
  tagName = '{nombre}';
  tagOrder = '{pedido}';
  /** Datos de ejemplo para la vista previa. */
  previewName = 'Laura';
  previewCode = 'P-00042';
  storeInfo: StoreInfo | null = null;
  savingStoreInfo = false;
  welcomeMax = WELCOME_MAX_LENGTH;
  open: 'store' | 'payments' | 'scheduling' | 'thanks' | null = null;
  days = DAYS;
  splitPlanLabel = splitPlanLabel;

  private base = `${environment.apiUrl}/marketplace-config`;

  constructor(private http: HttpClient) {}

  ngOnChanges(): void {
    if (!this.tenantId) return;
    this.http.get<StoreInfo>(`${this.base}/${this.tenantId}/store-info`).subscribe({
      next: (i) => (this.storeInfo = { whatsapp: this.formatPhone(i?.whatsapp || ''), welcomeMessage: i?.welcomeMessage || '' }),
      error: () => (this.storeInfo = { whatsapp: '', welcomeMessage: '' }),
    });
    this.http.get<any>(`${this.base}/${this.tenantId}/payment-options`).subscribe({ next: (p) => (this.payments = p), error: () => {} });
    this.http.get<any>(`${this.base}/${this.tenantId}/scheduling`).subscribe({ next: (s) => (this.scheduling = s), error: () => {} });
    this.http.get<ThanksMessages>(`${this.base}/${this.tenantId}/thanks-messages`).subscribe({
      next: (t) => (this.thanks = { ...DEFAULT_THANKS_MESSAGES, ...t, style: isThanksStyle(t?.style) ? t.style : 'clasico' }),
      error: () => (this.thanks = { ...DEFAULT_THANKS_MESSAGES }),
    });
  }

  toggle(section: 'store' | 'payments' | 'scheduling' | 'thanks'): void {
    this.open = this.open === section ? null : section;
    if (this.open === 'thanks') loadThanksFonts();
  }

  /** Dígitos del WhatsApp sin indicativo (+57). */
  private phoneDigits(value: string): string {
    const d = (value || '').replace(/\D/g, '');
    return d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
  }

  /** 3001205337 → "300 120 5337" (lo demás se deja como lo escribió). */
  private formatPhone(value: string): string {
    const d = this.phoneDigits(value);
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : value;
  }

  /** Celular colombiano válido (10 dígitos, empieza por 3) o vacío. */
  get whatsappValid(): boolean {
    const d = this.phoneDigits(this.storeInfo?.whatsapp || '');
    return !d || /^3\d{9}$/.test(d);
  }

  /** Enlace para probar el número desde el panel. */
  get whatsappTestLink(): string | null {
    const d = this.phoneDigits(this.storeInfo?.whatsapp || '');
    return /^3\d{9}$/.test(d) ? `https://wa.me/57${d}` : null;
  }

  get storeInfoSummary(): string {
    if (!this.storeInfo) return 'Cargando…';
    return this.storeInfo.whatsapp ? `WhatsApp ${this.formatPhone(this.storeInfo.whatsapp)}` : 'Sin WhatsApp';
  }

  saveStoreInfo(): void {
    if (!this.storeInfo) return;
    if (!this.whatsappValid) {
      Swal.fire({ icon: 'warning', title: 'Revisa el WhatsApp', text: 'Debe ser un celular colombiano de 10 dígitos que empiece por 3 (por ejemplo 300 120 5337).' });
      return;
    }
    this.savingStoreInfo = true;
    this.http.patch<StoreInfo>(`${this.base}/${this.tenantId}/store-info`, this.storeInfo).subscribe({
      next: (saved) => {
        this.storeInfo = { whatsapp: this.formatPhone(saved.whatsapp), welcomeMessage: saved.welcomeMessage };
        this.savingStoreInfo = false;
        Swal.fire({ icon: 'success', title: 'Datos de la tienda guardados', text: 'Recarga la tienda pública para verlos.', timer: 1800, showConfirmButton: false });
      },
      error: (err) => {
        this.savingStoreInfo = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }

  get enabledPlansCount(): number {
    const p = this.payments;
    if (!p) return 0;
    return ['contado', 'contraEntrega', 'mitadMitad', 'planSepare', 'credito'].filter((k) => p[k]?.enabled).length;
  }

  savePayments(): void {
    if (!this.enabledPlansCount) {
      Swal.fire({ icon: 'warning', title: 'Activa al menos una forma de pago', text: 'Sin formas de pago los clientes no podrán hacer pedidos.' });
      return;
    }
    this.savingPayments = true;
    this.http.patch<any>(`${this.base}/${this.tenantId}/payment-options`, this.payments).subscribe({
      next: (saved) => {
        this.payments = saved;
        this.savingPayments = false;
        Swal.fire({ icon: 'success', title: 'Formas de pago guardadas', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.savingPayments = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }

  saveScheduling(): void {
    this.savingScheduling = true;
    this.http.patch<any>(`${this.base}/${this.tenantId}/scheduling`, this.scheduling).subscribe({
      next: (saved) => {
        this.scheduling = saved;
        this.savingScheduling = false;
        Swal.fire({ icon: 'success', title: 'Programación guardada', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.savingScheduling = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }

  /** Vista previa con un cliente de ejemplo. */
  preview(key: ThanksTextKey): string {
    const value = this.thanks?.[key]?.trim() || DEFAULT_THANKS_MESSAGES[key];
    return fillThanks(value, this.previewName, this.previewCode);
  }

  resetThanks(): void {
    if (!this.thanks) return;
    this.thanks = { ...DEFAULT_THANKS_MESSAGES, enabled: this.thanks.enabled, style: this.thanks.style };
  }

  saveThanks(): void {
    if (!this.thanks) return;
    this.savingThanks = true;
    this.http.patch<ThanksMessages>(`${this.base}/${this.tenantId}/thanks-messages`, this.thanks).subscribe({
      next: (saved) => {
        this.thanks = saved;
        this.savingThanks = false;
        Swal.fire({ icon: 'success', title: 'Mensaje de agradecimiento guardado', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.savingThanks = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }
}
