import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { TenantBrandingService } from './tenant-branding.service';
import { CustomersService } from './customers.service';
import { paymentMethodLabel } from './credit.service';
import { DisplayLine, groupComboLines } from '../utils/combo-lines.util';
import { fechaVenta } from '../utils/fecha-venta';

/** Preferencias de la tiquetera, por equipo (cada caja tiene su impresora). */
export interface ReceiptSettings {
  /** Al confirmar cada venta: imprimir el tiquete… */
  autoPrint: boolean;
  /** …enviarlo por WhatsApp… */
  autoWhatsapp: boolean;
  /** …y/o por correo. */
  autoEmail: boolean;
  /** Ancho del rollo en mm. */
  width: 80 | 58;
}

export interface TicketData {
  name: string;
  info: string[];
  code: string;
  customer: string;
  dateText: string;
  voided: boolean;
  lines: DisplayLine[];
  subtotal: number;
  discount: number;
  tax: number;
  taxLabel: string;
  total: number;
  payment: string;
  units: number;
  /** Nota del negocio al pie. */
  note: string;
}

const SETTINGS_KEY = 'inout_receipt_settings';
/** Ancho que imprime cada rollo (la TM-T88V imprime 72 mm en rollo de 80). */
const PRINTABLE_MM: Record<ReceiptSettings['width'], number> = { 80: 72, 58: 48 };

/** Número para wa.me: solo dígitos; a uno de 10 dígitos (Colombia) se le pone el 57. */
export function whatsappNumber(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return '57' + digits;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

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

  constructor(private http: HttpClient, private branding: TenantBrandingService, private customers: CustomersService) {}

  get settings(): ReceiptSettings {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { autoPrint: !!s.autoPrint, autoWhatsapp: !!s.autoWhatsapp, autoEmail: !!s.autoEmail, width: s.width === 58 ? 58 : 80 };
    } catch {
      return { autoPrint: false, autoWhatsapp: false, autoEmail: false, width: 80 };
    }
  }

  saveSettings(patch: Partial<ReceiptSettings>): void {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...this.settings, ...patch })); } catch { /* sin almacenamiento */ }
  }

  /** Imprime el tiquete de una venta (la que devuelve el backend o la de la lista). */
  async print(sale: any): Promise<void> {
    const [business, branding] = await Promise.all([this.loadBusiness(), this.branding.load().catch(() => null)]);
    const html = this.ticketHtml(sale, business, branding?.logoPdfUrl || branding?.logoUrl || null, this.settings.width, branding?.receiptNote || null);
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

  /** Lo que muestra el comprobante (tiquete, PDF y texto de WhatsApp). */
  ticketData(sale: any, business: Record<string, any>, note: string | null = null): TicketData {
    let items: any[] = [];
    try { items = typeof sale?.items === 'string' ? JSON.parse(sale.items) : sale?.items || []; } catch { items = []; }
    const lines = groupComboLines(items);
    const when = fechaVenta(sale) || new Date();
    const created = sale?.dtmCreationDate ? new Date(sale.dtmCreationDate) : new Date();
    const sameDay = when.toDateString() === created.toDateString();
    // Mismo criterio que TaxService: el INC (restaurantes) manda sobre el IVA
    const inc = Number(business['INC_PORCENTAJE']) || 0;
    const taxPct = inc > 0 ? inc : Number(business['IVA_PORCENTAJE']) || 0;
    return {
      name: String(business['NEGOCIO_NOMBRE'] || '').trim() || sessionStorage.getItem('user_displayName') || 'Mi negocio',
      info: [
        business['NEGOCIO_NIT'] ? `NIT ${business['NEGOCIO_NIT']}` : '',
        business['NEGOCIO_DIRECCION'] || '',
        business['NEGOCIO_TELEFONO'] ? `Tel. ${business['NEGOCIO_TELEFONO']}` : '',
      ].filter(Boolean),
      code: sale?.strInvoiceCode || '—',
      customer: sale?.customerName || 'Cliente mostrador',
      dateText: sameDay
        ? created.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : when.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      voided: !!sale?.dtmVoidedAt,
      lines,
      subtotal: Number(sale?.subtotal) || 0,
      discount: Number(sale?.discount) || 0,
      tax: Number(sale?.tax) || 0,
      taxLabel: `${inc > 0 ? 'INC' : 'IVA'}${taxPct ? ` ${String(taxPct).replace('.', ',')}%` : ''}`,
      total: Number(sale?.total) || 0,
      payment: String(sale?.paymentType || '').toUpperCase() === 'CREDITO' ? 'Crédito' : `Contado · ${paymentMethodLabel(sale?.paymentMethod || 'EFECTIVO')}`,
      units: lines.reduce((t, l) => t + (Number(l.quantity) || 0), 0),
      note: String(note || '').trim(),
    };
  }

  ticketHtml(sale: any, business: Record<string, any>, logoUrl: string | null, width: ReceiptSettings['width'], note: string | null = null): string {
    const mm = PRINTABLE_MM[width];
    const small = width === 58;
    const { name, info, dateText, lines, taxLabel, payment, units, note: noteText } = this.ticketData(sale, business, note);

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
      .note { font-size: ${small ? 9.5 : 10.5}px; text-align: center; font-weight: 600; }
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
      ${Number(sale?.tax) > 0 ? `<div class="row"><span>${taxLabel}</span><span>${money(sale.tax)}</span></div>` : ''}
      <div class="row tot"><span>TOTAL</span><span>${money(sale?.total)}</span></div>
      <div class="row muted"><span>${units} unidad(es)</span><span>${esc(payment)}</span></div>
      <div class="hr"></div>
      ${noteText ? `<div class="note">${esc(noteText).replace(/\n/g, '<br>')}</div><div class="hr"></div>` : ''}
      <div class="c">¡Gracias por tu compra!</div>
      <div class="c muted">Generado con InOut · cyclonet.com.co/inout</div>
    </div></body></html>`;
  }

  // ── PDF ──────────────────────────────────────────────────────────────

  /** El tiquete en PDF (mismo ancho del rollo, alto a la medida, texto vectorial). */
  async pdf(sale: any): Promise<{ blob: Blob; filename: string }> {
    const [business, logo, branding] = await Promise.all([this.loadBusiness(), this.branding.getPdfLogo().catch(() => null), this.branding.load().catch(() => null)]);
    const data = this.ticketData(sale, business, branding?.receiptNote || null);
    const { default: jsPDF } = await import('jspdf');
    const width = this.settings.width;
    // Primero se mide (alto) y luego se dibuja en una página de ese alto
    const probe = new jsPDF({ unit: 'mm', format: [width, 1000] });
    const height = this.drawTicket(probe, data, logo, width) + 6;
    const doc = new jsPDF({ unit: 'mm', format: [width, Math.max(height, 60)] });
    this.drawTicket(doc, data, logo, width);
    return { blob: doc.output('blob'), filename: `Comprobante ${data.code}.pdf` };
  }

  async downloadPdf(sale: any): Promise<void> {
    const { blob, filename } = await this.pdf(sale);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /** Dibuja el tiquete; devuelve hasta dónde llegó (mm). */
  private drawTicket(doc: any, d: TicketData, logo: { dataUrl: string; ratio: number } | null, width: number): number {
    const m = (width - PRINTABLE_MM[width as ReceiptSettings['width']]) / 2 + 1;
    const right = width - m, cx = width / 2, w = right - m;
    const small = width === 58;
    const pt = (n: number) => (small ? n - 1 : n);
    let y = 5;
    const font = (size: number, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(pt(size)); };
    const lh = (size: number) => pt(size) * 0.3528 * 1.25;
    const center = (t: string, size: number, bold = false) => {
      font(size, bold);
      for (const line of doc.splitTextToSize(t, w)) { y += lh(size); doc.text(line, cx, y, { align: 'center' }); }
    };
    const pair = (l: string, r: string, size = 9, bold = false) => {
      font(size, bold); y += lh(size); doc.text(l, m, y); doc.text(r, right, y, { align: 'right' });
    };
    const dash = () => { y += 2; doc.setLineDashPattern([0.8, 0.8], 0); doc.setLineWidth(0.2); doc.line(m, y, right, y); doc.setLineDashPattern([], 0); y += 1; };

    if (logo?.dataUrl) {
      const lw = Math.min(small ? 26 : 32, 18 * (logo.ratio || 1)), lhh = lw / (logo.ratio || 1);
      try { doc.addImage(logo.dataUrl, cx - lw / 2, y, lw, lhh); y += lhh + 1; } catch { /* sin logo */ }
    }
    center(d.name, 12, true);
    d.info.forEach((i) => center(i, 8));
    dash();
    center('COMPROBANTE DE VENTA', 9.5, true);
    pair('N°', d.code, 9, true);
    pair('Fecha', d.dateText);
    pair('Cliente', d.customer.length > 28 ? d.customer.slice(0, 27) + '…' : d.customer);
    if (d.voided) {
      y += 2; doc.setLineWidth(0.6); doc.rect(m, y, w, 8); font(13, true); doc.text('ANULADA', cx, y + 5.8, { align: 'center' }); y += 9;
    }
    dash();
    for (const l of d.lines) {
      font(9, true);
      for (const line of doc.splitTextToSize(l.name, w)) { y += lh(9); doc.text(line, m, y); }
      const detail = [...(l.components || []), ...(l.options || []), ...(l.promotionName ? [l.promotionName] : [])];
      if (detail.length) { font(8); for (const line of doc.splitTextToSize(detail.join(' · '), w)) { y += lh(8); doc.text(line, m, y); } }
      pair(`${l.quantity} × ${money(l.unitPrice)}`, money(l.subtotal));
      y += 1;
    }
    dash();
    pair('Subtotal', money(d.subtotal));
    if (d.discount > 0) pair('Descuento', '-' + money(d.discount));
    if (d.tax > 0) pair(d.taxLabel, money(d.tax));
    y += 1;
    pair('TOTAL', money(d.total), 13, true);
    pair(`${d.units} unidad(es)`, d.payment, 8);
    dash();
    if (d.note) { d.note.split('\n').forEach((line) => center(line, 8.5, true)); dash(); }
    center('¡Gracias por tu compra!', 9);
    center('Generado con InOut · cyclonet.com.co/inout', 7.5);
    return y;
  }

  // ── WhatsApp y correo ────────────────────────────────────────────────

  /** Resumen en texto para WhatsApp. */
  whatsappText(d: TicketData): string {
    const out = [`*${d.name}*`, `Comprobante de venta ${d.code}`, d.dateText, ''];
    if (d.voided) out.push('*ANULADA*', '');
    for (const l of d.lines) out.push(`${l.quantity} × ${l.name} — ${money(l.subtotal)}`);
    out.push('');
    if (d.discount > 0) out.push(`Descuento: -${money(d.discount)}`);
    if (d.tax > 0) out.push(`${d.taxLabel}: ${money(d.tax)}`);
    out.push(`*Total: ${money(d.total)}*`, d.payment, '');
    if (d.note) out.push(`_${d.note}_`, '');
    out.push('¡Gracias por tu compra!');
    return out.join('\n');
  }

  /**
   * Envía el comprobante por WhatsApp. En el celular comparte el PDF (WhatsApp
   * lo recibe como archivo); en el computador abre WhatsApp con el resumen
   * escrito y el número del cliente.
   */
  async shareWhatsapp(sale: any, phone?: string | null): Promise<void> {
    const [business, branding] = await Promise.all([this.loadBusiness(), this.branding.load().catch(() => null)]);
    const d = this.ticketData(sale, business, branding?.receiptNote || null);
    const text = this.whatsappText(d);
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mobile && 'canShare' in navigator) {
      try {
        const { blob, filename } = await this.pdf(sale);
        const file = new File([blob], filename, { type: 'application/pdf' });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({ files: [file], text: `${d.name} · Comprobante ${d.code}` });
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    const contact = phone ?? (await this.contactOf(sale)).phone;
    const { value, isConfirmed } = await Swal.fire({
      title: 'Enviar por WhatsApp',
      html: `Escribe el celular de <b>${esc(d.customer)}</b>. Se abre WhatsApp con el comprobante ${esc(d.code)} escrito; solo pulsas enviar.`,
      input: 'tel',
      inputValue: contact || '',
      inputPlaceholder: '300 123 4567',
      showCancelButton: true,
      confirmButtonText: 'Abrir WhatsApp',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => (whatsappNumber(v) ? null : 'Escribe un celular válido (10 dígitos o con indicativo).'),
    });
    if (!isConfirmed) return;
    window.open(`https://wa.me/${whatsappNumber(value)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  /** Envía el comprobante por correo, con el PDF adjunto (lo envía InOut). */
  async sendEmail(sale: any, email?: string | null): Promise<void> {
    if (!sale?.strId) return;
    const contact = email ?? (await this.contactOf(sale)).email;
    const { value, isConfirmed } = await Swal.fire({
      title: 'Enviar por correo',
      html: `El cliente recibe el comprobante <b>${esc(sale.strInvoiceCode || '')}</b> con el PDF adjunto.`,
      input: 'email',
      inputValue: contact || '',
      inputPlaceholder: 'cliente@correo.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      validationMessage: 'Escribe un correo válido.',
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async (to: string) => {
        try {
          const { blob } = await this.pdf(sale);
          const pdfBase64 = await blobToBase64(blob);
          return await firstValueFrom(this.http.post<{ to: string }>(`${environment.apiUrl}/sales/${sale.strId}/receipt-email`, { email: to, pdfBase64 }));
        } catch (err: any) {
          Swal.showValidationMessage(typeof err?.error?.message === 'string' ? err.error.message : 'No se pudo enviar. Intenta de nuevo.');
          return false;
        }
      },
    });
    if (isConfirmed && value) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Comprobante enviado a ${value.to}`, timer: 2500, showConfirmButton: false });
    }
  }

  /** Celular y correo del cliente de la venta (si es un cliente registrado). */
  private async contactOf(sale: any): Promise<{ phone: string | null; email: string | null }> {
    if (!sale?.strCustomerId) return { phone: null, email: null };
    try {
      const list = await firstValueFrom(this.customers.getCustomers());
      const c: any = list.find((x: any) => x.id === sale.strCustomerId);
      return { phone: c?.phone || null, email: c?.email || null };
    } catch {
      return { phone: null, email: null };
    }
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
