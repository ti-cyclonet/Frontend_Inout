import { Component, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom, forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { ProductsService, SellableItem } from '../../services/products.service';
import { BarcodeItemType, BarcodesService } from '../../services/barcodes.service';
import { barcodeModules, barcodeSvg, newStoreEan13 } from '../../utils/barcode-svg';

/** Formatos de impresión (medidas en mm). */
export interface LabelFormat {
  id: string;
  label: string;
  page: { w: number; h: number };
  label_: { w: number; h: number };
  cols: number;
  rows: number;
  margin: { top: number; left: number };
  gap: { x: number; y: number };
}

export const LABEL_FORMATS: LabelFormat[] = [
  { id: 'carta30', label: 'Hoja carta · 30 etiquetas (3 × 10, 66,7 × 25,4 mm)', page: { w: 215.9, h: 279.4 }, label_: { w: 66.7, h: 25.4 }, cols: 3, rows: 10, margin: { top: 12.7, left: 4.8 }, gap: { x: 3.2, y: 0 } },
  { id: 'carta65', label: 'Hoja carta · 65 etiquetas (5 × 13, 38,1 × 21,2 mm)', page: { w: 215.9, h: 279.4 }, label_: { w: 38.1, h: 21.2 }, cols: 5, rows: 13, margin: { top: 2, left: 6.5 }, gap: { x: 2.5, y: 0 } },
  { id: 'rollo50x25', label: 'Rollo 50 × 25 mm (impresora de etiquetas)', page: { w: 50, h: 25 }, label_: { w: 50, h: 25 }, cols: 1, rows: 1, margin: { top: 0, left: 0 }, gap: { x: 0, y: 0 } },
];

interface Row {
  item: SellableItem;
  itemType: BarcodeItemType;
  code: string | null;
  selected: boolean;
  copies: number;
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const money = (n: number) => '$ ' + Math.round(n || 0).toLocaleString('es-CO');

/**
 * Etiquetas con código de barras para pegar a los productos: se escogen los
 * ítems y cuántas de cada uno, el formato (hoja carta o rollo) y si llevan
 * precio. A los que no tienen código se les crea uno (EAN-13 de uso interno)
 * y se guarda, para que el lector los reconozca en la venta.
 */
@Component({
  selector: 'app-label-printer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lp-backdrop" *ngIf="open" (click)="close()">
      <section class="lp" role="dialog" aria-modal="true" aria-labelledby="lp-title" (click)="$event.stopPropagation()">
        <div class="lp-head">
          <h2 id="lp-title">Imprimir etiquetas</h2>
          <button type="button" class="lp-x" (click)="close()" aria-label="Cerrar">
            <svg aria-hidden="true"><use href="./assets/icons/bootstrap-icons.svg#x-lg" /></svg>
          </button>
        </div>

        <div class="lp-body">
          <div class="lp-left">
            <input type="search" class="form-control" placeholder="Buscar producto, marca o código…" [(ngModel)]="query" aria-label="Buscar">
            <div class="lp-tools">
              <span>{{ selectedRows.length }} seleccionado(s)</span>
              <button type="button" class="lp-link" (click)="selectAll(true)">Seleccionar los visibles</button>
              <button type="button" class="lp-link" (click)="selectAll(false)">Quitar todos</button>
            </div>
            <p class="lp-muted" *ngIf="loading">Cargando productos…</p>
            <ul class="lp-list" *ngIf="!loading">
              <li *ngFor="let r of visibleRows" [class.on]="r.selected">
                <label>
                  <input type="checkbox" [(ngModel)]="r.selected">
                  <span class="lp-name">
                    <b>{{ r.item.name }}</b>
                    <small>{{ r.item.brand ? r.item.brand + ' · ' : '' }}{{ money(r.item.price) }} · {{ r.code || 'sin código: se creará uno' }}</small>
                  </span>
                </label>
                <input type="number" min="1" max="500" class="form-control lp-copies" [(ngModel)]="r.copies" [disabled]="!r.selected"
                  [attr.aria-label]="'Cantidad de etiquetas de ' + r.item.name">
              </li>
              <li class="lp-muted" *ngIf="!visibleRows.length">No hay productos con esa búsqueda.</li>
            </ul>
          </div>

          <div class="lp-right">
            <label class="lp-field">Formato
              <select class="form-select" [(ngModel)]="formatId">
                <option *ngFor="let f of formats" [value]="f.id">{{ f.label }}</option>
              </select>
            </label>
            <label class="lp-check"><input type="checkbox" [(ngModel)]="showPrice"> Mostrar el precio</label>
            <div class="lp-preview-wrap">
              <small>Vista previa</small>
              <div class="lp-preview" *ngIf="previewHtml; else noPreview" [innerHTML]="previewHtml"></div>
              <ng-template #noPreview><p class="lp-muted">Escoge un producto para ver la etiqueta.</p></ng-template>
            </div>
            <p class="lp-note" *ngIf="missingCodes">{{ missingCodes }} producto(s) sin código: InOut les creará uno y lo guardará, para que el lector los reconozca.</p>
            <p class="lp-note"><b>Imprimir</b> va directo a tu impresora. <b>Descargar PDF</b> sirve para llevarlo a imprimir afuera. En los dos casos imprime a escala <b>100 %</b> («Tamaño real»).</p>
          </div>
        </div>

        <div class="lp-foot">
          <button type="button" class="btn btn-outline-secondary me-auto" (click)="close()">Cancelar</button>
          <button type="button" class="btn btn-outline-primary" (click)="downloadPdf()" [disabled]="!totalLabels || printing">
            Descargar PDF
          </button>
          <button type="button" class="btn btn-primary" (click)="print()" [disabled]="!totalLabels || printing">
            {{ printing ? 'Preparando…' : 'Imprimir ' + totalLabels + ' etiqueta' + (totalLabels === 1 ? '' : 's') }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .lp-backdrop { position: fixed; inset: 0; z-index: 1900; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, .55); }
    .lp { width: min(980px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 24px 60px rgba(0, 0, 0, .3); overflow: hidden; }
    .lp-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e5e7eb; }
    .lp-head h2 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    .lp-x { border: 0; background: transparent; padding: 6px; border-radius: 50%; cursor: pointer; }
    .lp-x:hover { background: #f1f5f9; }
    .lp-x svg { width: 16px; height: 16px; fill: currentColor; display: block; }
    .lp-body { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; padding: 16px 18px; overflow: auto; }
    .lp-tools { display: flex; align-items: center; gap: 12px; margin: 8px 0; font-size: .82rem; color: #64748b; }
    .lp-link { border: 0; background: none; padding: 0; color: #0c4fca; font-size: .82rem; cursor: pointer; }
    .lp-list { list-style: none; margin: 0; padding: 0; max-height: 46vh; overflow: auto; border: 1px solid #e5e7eb; border-radius: 10px; }
    .lp-list li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .lp-list li.on { background: #f0f7ff; }
    .lp-list label { flex: 1; display: flex; align-items: center; gap: 10px; margin: 0; min-width: 0; cursor: pointer; }
    .lp-name { display: grid; min-width: 0; }
    .lp-name b { font-size: .88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lp-name small { color: #64748b; font-size: .76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lp-copies { width: 72px; flex: none; }
    .lp-field { display: grid; gap: 4px; font-weight: 600; font-size: .85rem; }
    .lp-check { display: flex; align-items: center; gap: 8px; margin: 12px 0; font-size: .88rem; }
    .lp-preview-wrap small { color: #64748b; }
    .lp-preview { margin-top: 6px; padding: 14px; background: #f1f5f9; border-radius: 10px; display: grid; place-items: center; }
    .lp-note { font-size: .8rem; color: #475569; margin: 10px 0 0; }
    .lp-muted { color: #64748b; font-size: .85rem; padding: 10px; margin: 0; }
    .lp-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #e5e7eb; }
    @media (max-width: 768px) { .lp-body { grid-template-columns: 1fr; } .lp-list { max-height: 36vh; } }
  `],
})
export class LabelPrinterComponent implements OnDestroy {
  open = false;
  loading = false;
  printing = false;
  query = '';
  rows: Row[] = [];
  formats = LABEL_FORMATS;
  formatId = 'carta30';
  showPrice = true;
  money = money;

  constructor(private products: ProductsService, private barcodes: BarcodesService, private sanitizer: DomSanitizer, private host: ElementRef<HTMLElement>) {}

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
  }

  get format(): LabelFormat {
    return this.formats.find((f) => f.id === this.formatId) || this.formats[0];
  }

  get visibleRows(): Row[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter((r) => r.item.name.toLowerCase().includes(q) || (r.item.brand || '').toLowerCase().includes(q) || (r.code || '').includes(q));
  }

  get selectedRows(): Row[] {
    return this.rows.filter((r) => r.selected);
  }

  get totalLabels(): number {
    return this.selectedRows.reduce((s, r) => s + Math.max(0, Math.min(500, Math.floor(Number(r.copies) || 0))), 0);
  }

  get missingCodes(): number {
    return this.selectedRows.filter((r) => !r.code).length;
  }

  get previewHtml(): SafeHtml | null {
    const r = this.selectedRows[0];
    if (!r) return null;
    const f = this.format;
    const html = `<div style="width:${f.label_.w * 3.2}px;height:${f.label_.h * 3.2}px;background:#fff;border:1px dashed #94a3b8;border-radius:4px;overflow:hidden">${this.labelHtml(r, r.code || newStoreEan13(() => 0.5), 3.2)}</div>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /** Abre la ventana; con `itemIds` llegan ya escogidos. */
  show(itemIds: string[] = []): void {
    // Al <body>: dentro de la barra de una lista la ventana quedaría recortada
    if (this.host.nativeElement.parentElement !== document.body) document.body.appendChild(this.host.nativeElement);
    this.open = true;
    this.query = '';
    this.loading = true;
    forkJoin([this.products.getSellableItems(), this.barcodes.getAll()]).subscribe({
      next: ([items, codes]) => {
        const first = new Map<string, string>();
        for (const c of codes) if (!first.has(c.itemId)) first.set(c.itemId, c.code);
        this.rows = items
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((item) => ({
            item,
            itemType: (item.itemType === 'kit' ? 'combo' : item.itemType) as BarcodeItemType,
            code: first.get(item.id) || null,
            selected: itemIds.includes(item.id),
            copies: 1,
          }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        Swal.fire('No se pudieron cargar los productos', 'Intenta de nuevo.', 'error');
      },
    });
  }

  close(): void {
    if (!this.printing) this.open = false;
  }

  selectAll(on: boolean): void {
    (on ? this.visibleRows : this.rows).forEach((r) => (r.selected = on));
  }

  async print(): Promise<void> {
    if (!this.totalLabels || this.printing) return;
    this.printing = true;
    if (await this.ensureCodes()) this.printDocument(this.documentHtml());
    this.printing = false;
  }

  /** PDF para imprimir por fuera (papelería): mismas medidas, barras vectoriales. */
  async downloadPdf(): Promise<void> {
    if (!this.totalLabels || this.printing) return;
    this.printing = true;
    try {
      if (!(await this.ensureCodes())) return;
      const { default: jsPDF } = await import('jspdf');
      const f = this.format;
      const doc = new jsPDF({ unit: 'mm', format: [f.page.w, f.page.h], orientation: f.page.w > f.page.h ? 'landscape' : 'portrait' });
      const perPage = f.cols * f.rows;
      this.labelQueue().forEach((r, i) => {
        if (i && i % perPage === 0) doc.addPage([f.page.w, f.page.h], f.page.w > f.page.h ? 'landscape' : 'portrait');
        const slot = i % perPage;
        const x = f.margin.left + (slot % f.cols) * (f.label_.w + f.gap.x);
        const y = f.margin.top + Math.floor(slot / f.cols) * (f.label_.h + f.gap.y);
        this.drawLabel(doc, r, x, y);
      });
      doc.save(`etiquetas-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      Swal.fire('No se pudo generar el PDF', 'Intenta de nuevo.', 'error');
    } finally {
      this.printing = false;
    }
  }

  /** Crea los códigos que falten; avisa y devuelve false si no se pudo. */
  private async ensureCodes(): Promise<boolean> {
    try {
      for (const r of this.selectedRows.filter((x) => !x.code)) r.code = await this.createCode(r);
      return true;
    } catch (err: any) {
      Swal.fire('No se pudo crear el código', typeof err?.error?.message === 'string' ? err.error.message : 'Revisa tu conexión e intenta de nuevo.', 'error');
      return false;
    }
  }

  /** Una fila por etiqueta, en orden. */
  private labelQueue(): Row[] {
    const out: Row[] = [];
    for (const r of this.selectedRows) {
      const n = Math.max(0, Math.min(500, Math.floor(Number(r.copies) || 0)));
      for (let i = 0; i < n; i++) out.push(r);
    }
    return out;
  }

  /** Dibuja una etiqueta en el PDF con las mismas proporciones que la impresa. */
  private drawLabel(doc: any, r: Row, x: number, y: number): void {
    const f = this.format;
    const small = f.label_.h < 24;
    const pad = small ? 1.2 : 1.8;
    const pt = (mm: number) => mm / 0.3528;
    const nameSize = small ? 2.3 : 2.8;
    const priceSize = small ? 2.8 : 3.4;
    const digitsSize = small ? 2 : 2.4;
    const w = f.label_.w - pad * 2;
    let top = y + pad;
    let nameW = w;
    if (this.showPrice) {
      const price = money(r.item.price);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(pt(priceSize));
      const pw = doc.getTextWidth(price);
      doc.text(price, x + pad + w, top + priceSize * 0.8, { align: 'right' });
      nameW = w - pw - 1;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(pt(nameSize));
    const lines = doc.splitTextToSize(r.item.name, nameW).slice(0, 2);
    doc.text(lines, x + pad, top + nameSize * 0.8, { lineHeightFactor: 1.15 });
    top += nameSize * 2.3 + (this.showPrice ? 0.4 : 0);
    const bottomDigits = y + f.label_.h - pad;
    const barH = Math.max(6, bottomDigits - digitsSize * 1.4 - top);
    const { bits, quietLeft, total } = barcodeModules(r.code!);
    const m = w / total;
    doc.setFillColor(0, 0, 0);
    for (let i = 0; i < bits.length; ) {
      if (bits[i] !== '1') { i++; continue; }
      let j = i;
      while (bits[j] === '1') j++;
      doc.rect(x + pad + (quietLeft + i) * m, top, (j - i) * m, barH, 'F');
      i = j;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(pt(digitsSize));
    doc.text(r.code!, x + f.label_.w / 2, bottomDigits, { align: 'center', charSpace: 0.15 });
  }

  /** Código nuevo para el ítem, guardado junto a los que ya tuviera (reintenta si choca). */
  private async createCode(r: Row): Promise<string> {
    const current = await firstValueFrom(this.barcodes.forItem(r.itemType, r.item.id));
    if (current.length) return current[0];
    for (let attempt = 0; ; attempt++) {
      const code = newStoreEan13();
      try {
        await firstValueFrom(this.barcodes.set(r.itemType, r.item.id, [code]));
        return code;
      } catch (err: any) {
        if (err?.status !== 409 || attempt >= 3) throw err;
      }
    }
  }

  /** Contenido de una etiqueta; `px` = píxeles por mm (vista previa) o 0 para imprimir en mm. */
  private labelHtml(r: Row, code: string, px = 0): string {
    const u = (mm: number) => (px ? `${(mm * px).toFixed(1)}px` : `${mm}mm`);
    const f = this.format;
    const small = f.label_.h < 24;
    const pad = small ? 1.2 : 1.8;
    const nameSize = small ? 2.3 : 2.8;
    const priceSize = small ? 2.8 : 3.4;
    const digitsSize = small ? 2 : 2.4;
    const barH = f.label_.h - pad * 2 - nameSize * 2.3 - digitsSize * 1.4 - (this.showPrice ? 0.4 : 0);
    const name = esc(r.item.name);
    return `
      <div style="box-sizing:border-box;width:100%;height:100%;padding:${u(pad)};display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif;color:#000">
        <div style="display:flex;align-items:flex-start;gap:${u(1)};line-height:1.15">
          <div style="flex:1;min-width:0;font-size:${u(nameSize)};font-weight:700;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${name}</div>
          ${this.showPrice ? `<div style="flex:none;font-size:${u(priceSize)};font-weight:800">${esc(money(r.item.price))}</div>` : ''}
        </div>
        <div style="flex:1;display:flex;align-items:flex-end;min-height:${u(Math.max(6, barH))}">
          <div style="width:100%;height:${u(Math.max(6, barH))}">${barcodeSvg(code).replace('<svg ', '<svg style="width:100%;height:100%;display:block" ')}</div>
        </div>
        <div style="text-align:center;font-size:${u(digitsSize)};letter-spacing:.06em;line-height:1.2">${esc(code)}</div>
      </div>`;
  }

  private documentHtml(): string {
    const f = this.format;
    const labels = this.labelQueue().map((r) => this.labelHtml(r, r.code!));
    const perPage = f.cols * f.rows;
    const pages: string[] = [];
    for (let i = 0; i < labels.length; i += perPage) {
      const cells = labels.slice(i, i + perPage).map((l) => `<div class="cell">${l}</div>`).join('');
      pages.push(`<section class="page">${cells}</section>`);
    }
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas</title><style>
      @page { size: ${f.page.w}mm ${f.page.h}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { width: ${f.page.w}mm; height: ${f.page.h}mm; padding: ${f.margin.top}mm 0 0 ${f.margin.left}mm; display: grid;
        grid-template-columns: repeat(${f.cols}, ${f.label_.w}mm); grid-auto-rows: ${f.label_.h}mm; column-gap: ${f.gap.x}mm; row-gap: ${f.gap.y}mm;
        align-content: start; page-break-after: always; break-after: page; overflow: hidden; }
      .page:last-child { page-break-after: auto; break-after: auto; }
      .cell { width: ${f.label_.w}mm; height: ${f.label_.h}mm; overflow: hidden; }
    </style></head><body>${pages.join('')}</body></html>`;
  }

  /** Imprime en un iframe oculto (sin abrir ventanas nuevas). */
  private printDocument(html: string): void {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 60000);
    }, 300);
  }
}
