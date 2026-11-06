import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantBrandingService } from './tenant-branding.service';
import { paymentMethodLabel } from './credit.service';
import { groupComboLines } from '../utils/combo-lines.util';
import { fechaVenta } from '../utils/fecha-venta';

/** Preferencias de la tiquetera, por equipo (cada caja tiene su impresora). */
export interface ReceiptSettings {
  /** Imprimir el tiquete al confirmar cada venta. */
  autoPrint: boolean;
  /** Ancho del rollo en mm. */
  width: 80 | 58;
}

const SETTINGS_KEY = 'inout_receipt_settings';
/** Ancho que imprime cada rollo (la TM-T88V imprime 72 mm en rollo de 80). */
const PRINTABLE_MM: Record<ReceiptSettings['width'], number> = { 80: 72, 58: 48 };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const money = (n: unknown) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

/**
 * Tiquete de venta para impresoras térmicas de rollo (Epson TM-T88, etc.).
 * Se imprime con el navegador y el controlador de la impresora: el alto de la
 * página se ajusta al contenido para que la impresora corte al final.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private business: Record<string, any> | null = null;

  constructor(private http: HttpClient, private branding: TenantBrandingService) {}

  get settings(): ReceiptSettings {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { autoPrint: !!s.autoPrint, width: s.width === 58 ? 58 : 80 };
    } catch {
      return { autoPrint: false, width: 80 };
    }
  }

  saveSettings(patch: Partial<ReceiptSettings>): void {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...this.settings, ...patch })); } catch { /* sin almacenamiento */ }
  }

  /** Imprime el tiquete de una venta (la que devuelve el backend o la de la lista). */
  async print(sale: any): Promise<void> {
    const [business, branding] = await Promise.all([this.loadBusiness(), this.branding.load().catch(() => null)]);
    const html = this.ticketHtml(sale, business, branding?.logoPdfUrl || branding?.logoUrl || null, this.settings.width);
    await this.printHtml(html, this.settings.width);
  }

  private async loadBusiness(): Promise<Record<string, any>> {
    if (this.business) return this.business;
    try {
      this.business = (await firstValueFrom(this.http.get<Record<string, any>>(`${environment.apiUrl}/business-params`))) || {};
    } catch {
      this.business = {};
    }
    return this.business;
  }

  ticketHtml(sale: any, business: Record<string, any>, logoUrl: string | null, width: ReceiptSettings['width']): string {
    const mm = PRINTABLE_MM[width];
    const small = width === 58;
    let items: any[] = [];
    try { items = typeof sale?.items === 'string' ? JSON.parse(sale.items) : sale?.items || []; } catch { items = []; }
    const lines = groupComboLines(items);
    const name = String(business['NEGOCIO_NOMBRE'] || '').trim() || sessionStorage.getItem('user_displayName') || 'Mi negocio';
    const info = [
      business['NEGOCIO_NIT'] ? `NIT ${business['NEGOCIO_NIT']}` : '',
      business['NEGOCIO_DIRECCION'] || '',
      business['NEGOCIO_TELEFONO'] ? `Tel. ${business['NEGOCIO_TELEFONO']}` : '',
    ].filter(Boolean);
    const when = fechaVenta(sale) || new Date();
    const created = sale?.dtmCreationDate ? new Date(sale.dtmCreationDate) : new Date();
    const sameDay = when.toDateString() === created.toDateString();
    const dateText = sameDay
      ? created.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : when.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    // Mismo criterio que TaxService: el INC (restaurantes) manda sobre el IVA
    const inc = Number(business['INC_PORCENTAJE']) || 0;
    const taxLabel = inc > 0 ? 'INC' : 'IVA';
    const taxPct = inc > 0 ? inc : Number(business['IVA_PORCENTAJE']) || 0;
    const payment = String(sale?.paymentType || '').toUpperCase() === 'CREDITO' ? 'Crédito' : `Contado · ${paymentMethodLabel(sale?.paymentMethod || 'EFECTIVO')}`;
    const units = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

    const rows = lines.map((l) => {
      const detail = [...(l.components || []), ...(l.options || [])];
      return `<div class="it">
        <div class="nm">${esc(l.name)}</div>
        ${detail.length ? `<div class="sub">${detail.map(esc).join(' · ')}</div>` : ''}
        ${l.promotionName ? `<div class="sub">${esc(l.promotionName)}</div>` : ''}
        <div class="row"><span>${esc(l.quantity)} × ${money(l.unitPrice)}</span><b>${money(l.subtotal)}</b></div>
      </div>`;
    }).join('');

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tiquete ${esc(sale?.strInvoiceCode || '')}</title><style>
      @page { size: ${width}mm 200mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      body { width: ${width}mm; font-family: Arial, Helvetica, sans-serif; font-size: ${small ? 10 : 11.5}px; line-height: 1.3; }
      .t { width: ${mm}mm; margin: 0 auto; padding: 3mm 0 6mm; }
      .c { text-align: center; }
      .logo { display: block; max-width: ${small ? 30 : 38}mm; max-height: 22mm; margin: 0 auto 2mm; filter: grayscale(1); }
      .biz { font-size: ${small ? 13 : 15}px; font-weight: 800; }
      .muted { font-size: ${small ? 9 : 10.5}px; }
      .hr { border-top: 1px dashed #000; margin: 2mm 0; }
      .row { display: flex; justify-content: space-between; gap: 2mm; }
      .it { margin: 0 0 1.5mm; }
      .nm { font-weight: 700; }
      .sub { font-size: ${small ? 9 : 10}px; }
      .tot { font-size: ${small ? 14 : 17}px; font-weight: 800; }
      .void { border: 2px solid #000; text-align: center; font-weight: 800; font-size: ${small ? 14 : 17}px; padding: 1mm; margin: 2mm 0; letter-spacing: .15em; }
    </style></head><body><div class="t">
      ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="">` : ''}
      <div class="c biz">${esc(name)}</div>
      ${info.map((i) => `<div class="c muted">${esc(i)}</div>`).join('')}
      <div class="hr"></div>
      <div class="c"><b>COMPROBANTE DE VENTA</b></div>
      <div class="row"><span>N°</span><b>${esc(sale?.strInvoiceCode || '—')}</b></div>
      <div class="row"><span>Fecha</span><span>${esc(dateText)}</span></div>
      <div class="row"><span>Cliente</span><span>${esc(sale?.customerName || 'Cliente mostrador')}</span></div>
      ${sale?.dtmVoidedAt ? '<div class="void">ANULADA</div>' : ''}
      <div class="hr"></div>
      ${rows || '<div class="c muted">Sin productos</div>'}
      <div class="hr"></div>
      <div class="row"><span>Subtotal</span><span>${money(sale?.subtotal)}</span></div>
      ${Number(sale?.discount) > 0 ? `<div class="row"><span>Descuento</span><span>-${money(sale.discount)}</span></div>` : ''}
      ${Number(sale?.tax) > 0 ? `<div class="row"><span>${taxLabel}${taxPct ? ` ${String(taxPct).replace('.', ',')}%` : ''}</span><span>${money(sale.tax)}</span></div>` : ''}
      <div class="row tot"><span>TOTAL</span><span>${money(sale?.total)}</span></div>
      <div class="row muted"><span>${units} unidad(es)</span><span>${esc(payment)}</span></div>
      <div class="hr"></div>
      <div class="c">¡Gracias por tu compra!</div>
      <div class="c muted">Generado con InOut · cyclonet.com.co/inout</div>
    </div></body></html>`;
  }

  /**
   * Imprime en un iframe oculto. Ajusta el alto de la página al del tiquete
   * (la impresora corta al final) y espera a que cargue el logo.
   */
  private printHtml(html: string, width: number): Promise<void> {
    return new Promise((resolve) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:80mm;height:10px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(frame);
      const doc = frame.contentDocument!;
      doc.open(); doc.write(html); doc.close();
      const go = () => {
        const body = doc.body;
        const heightMm = Math.ceil((body.scrollHeight * 25.4) / 96) + 2;
        const style = doc.createElement('style');
        style.textContent = `@page { size: ${width}mm ${heightMm}mm; margin: 0; }`;
        doc.head.appendChild(style);
        frame.contentWindow!.focus();
        frame.contentWindow!.print();
        setTimeout(() => frame.remove(), 60000);
        resolve();
      };
      const img = doc.querySelector('img');
      if (img && !img.complete) {
        const t = setTimeout(go, 2500);
        img.onload = img.onerror = () => { clearTimeout(t); go(); };
      } else {
        setTimeout(go, 150);
      }
    });
  }
}
