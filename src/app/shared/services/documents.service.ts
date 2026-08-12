import { Injectable } from '@angular/core';

/**
 * Servicio unificado de generación de documentos PDF para InOut.
 * Todos los documentos usan import dinámico de jsPDF para compatibilidad SSR.
 * 
 * Documentos disponibles:
 * - Factura de venta (desde pedido)
 * - Comprobante de compra
 * - Orden de pedido / Comanda
 * - Remisión / Nota de entrega
 * - Reporte de inventario valorizado
 * - Cotización
 * - Nota de ajuste de inventario
 */
@Injectable({
  providedIn: 'root'
})
export class DocumentsService {

  private businessName = 'Mi Negocio';
  private businessNit = '';
  private businessAddress = '';
  private businessPhone = '';

  constructor() {
    // Cargar datos del negocio desde sessionStorage si están disponibles
    if (typeof window !== 'undefined') {
      this.businessName = sessionStorage.getItem('user_displayName') || sessionStorage.getItem('user_name') || 'Mi Negocio';
    }
  }

  // ═══════════════════════════════════════════════════════
  // COMPROBANTE DE COMPRA
  // ═══════════════════════════════════════════════════════
  async generatePurchaseReceipt(data: {
    document: string;
    date: string;
    supplier: string;
    items: { materialName: string; materialCode: string; quantity: number; unitPrice: number; total: number }[];
    grandTotal: number;
  }): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    this.drawHeader(doc, 'COMPROBANTE DE COMPRA', data.document);

    // Info
    let y = 55;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(`Proveedor: ${data.supplier}`, 15, y);
    doc.text(`Fecha: ${this.formatDate(data.date)}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
    doc.text(`Documento soporte: ${data.document}`, 15, y);

    // Table
    const tableData = data.items.map((item, i) => [
      (i + 1).toString(),
      item.materialCode,
      item.materialName,
      item.quantity.toString(),
      this.formatCurrency(item.unitPrice),
      this.formatCurrency(item.total)
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [['#', 'Código', 'Material', 'Cantidad', 'V. Unitario', 'Total']],
      body: tableData,
      ...this.getTableStyles(),
    });

    this.drawTotals(doc, [
      { label: 'Total Compra:', value: this.formatCurrency(data.grandTotal) }
    ]);

    this.drawFooter(doc);
    doc.save(`Compra_${data.document}.pdf`);
  }

  // ═══════════════════════════════════════════════════════
  // ORDEN DE PEDIDO / COMANDA
  // ═══════════════════════════════════════════════════════
  async generateOrderTicket(data: {
    orderCode: string;
    customerName: string;
    date: string;
    deliveryDate?: string;
    items: { productName: string; quantity: number; notes?: string }[];
    notes?: string;
    status: string;
  }): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    this.drawHeader(doc, 'ORDEN DE PEDIDO', data.orderCode);

    let y = 55;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(`Cliente: ${data.customerName}`, 15, y);
    doc.text(`Fecha: ${this.formatDate(data.date)}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
    if (data.deliveryDate) {
      doc.text(`Fecha de entrega: ${this.formatDate(data.deliveryDate)}`, 15, y);
      y += 6;
    }
    doc.text(`Estado: ${data.status}`, 15, y);

    // Items table (simplified for kitchen/production)
    const tableData = data.items.map((item, i) => [
      (i + 1).toString(),
      item.productName,
      `x${item.quantity}`,
      item.notes || ''
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [['#', 'Producto', 'Cant.', 'Observaciones']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        2: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
      },
      margin: { left: 15, right: 15 }
    });

    // Notes
    if (data.notes) {
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Notas:', 15, finalY);
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(data.notes, pageWidth - 30);
      doc.text(splitNotes, 15, finalY + 6);
    }

    this.drawFooter(doc);
    doc.save(`Pedido_${data.orderCode}.pdf`);
  }

  // ═══════════════════════════════════════════════════════
  // REMISIÓN / NOTA DE ENTREGA
  // ═══════════════════════════════════════════════════════
  async generateDeliveryNote(data: {
    orderCode: string;
    customerName: string;
    date: string;
    items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
    subtotal: number;
    tax: number;
    total: number;
  }): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    this.drawHeader(doc, 'REMISIÓN', data.orderCode);

    let y = 55;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(`Cliente: ${data.customerName}`, 15, y);
    doc.text(`Fecha despacho: ${this.formatDate(data.date)}`, pageWidth - 15, y, { align: 'right' });

    const tableData = data.items.map((item, i) => [
      (i + 1).toString(),
      item.productName,
      item.quantity.toString(),
      this.formatCurrency(item.unitPrice),
      this.formatCurrency(item.subtotal)
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [['#', 'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
      body: tableData,
      ...this.getTableStyles(),
    });

    this.drawTotals(doc, [
      { label: 'Subtotal:', value: this.formatCurrency(data.subtotal) },
      { label: 'IVA (19%):', value: this.formatCurrency(data.tax) },
      { label: 'TOTAL:', value: this.formatCurrency(data.total), bold: true },
    ]);

    // Signature lines
    const sigY = doc.internal.pageSize.getHeight() - 40;
    doc.setDrawColor(0, 0, 0);
    doc.line(15, sigY, 85, sigY);
    doc.line(pageWidth - 85, sigY, pageWidth - 15, sigY);
    doc.setFontSize(8);
    doc.text('Entregado por', 50, sigY + 5, { align: 'center' });
    doc.text('Recibido por', pageWidth - 50, sigY + 5, { align: 'center' });

    this.drawFooter(doc);
    doc.save(`Remision_${data.orderCode}.pdf`);
  }

  // ═══════════════════════════════════════════════════════
  // COTIZACIÓN
  // ═══════════════════════════════════════════════════════
  async generateQuote(data: {
    quoteNumber: string;
    customerName: string;
    date: string;
    validUntil: string;
    items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    notes?: string;
  }): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    this.drawHeader(doc, 'COTIZACIÓN', data.quoteNumber);

    let y = 55;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(`Cliente: ${data.customerName}`, 15, y);
    doc.text(`Fecha: ${this.formatDate(data.date)}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
    doc.text(`Válida hasta: ${this.formatDate(data.validUntil)}`, 15, y);

    const tableData = data.items.map((item, i) => [
      (i + 1).toString(),
      item.productName,
      item.quantity.toString(),
      this.formatCurrency(item.unitPrice),
      this.formatCurrency(item.subtotal)
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [['#', 'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
      body: tableData,
      ...this.getTableStyles(),
    });

    const totals = [
      { label: 'Subtotal:', value: this.formatCurrency(data.subtotal) },
      { label: 'IVA (19%):', value: this.formatCurrency(data.tax) },
    ];
    if (data.discount > 0) {
      totals.push({ label: 'Descuento:', value: `-${this.formatCurrency(data.discount)}` });
    }
    totals.push({ label: 'TOTAL:', value: this.formatCurrency(data.total), bold: true } as any);

    this.drawTotals(doc, totals);

    if (data.notes) {
      const finalY = (doc as any).lastAutoTable.finalY + 55;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(107, 114, 128);
      doc.text('Condiciones: ' + data.notes, 15, finalY);
    }

    this.drawFooter(doc);
    doc.save(`Cotizacion_${data.quoteNumber}.pdf`);
  }

  // ═══════════════════════════════════════════════════════
  // REPORTE DE INVENTARIO VALORIZADO
  // ═══════════════════════════════════════════════════════
  async generateInventoryReport(data: {
    date: string;
    items: { code: string; name: string; category: string; stock: number; unit: string; unitPrice: number; totalValue: number }[];
    totalValue: number;
    totalItems: number;
  }): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header for landscape
    doc.setFillColor(0, 102, 204);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE INVENTARIO VALORIZADO', 15, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de corte: ${this.formatDate(data.date)}`, 15, 23);
    doc.text(`${this.businessName}`, pageWidth - 15, 15, { align: 'right' });
    doc.text(`Total items: ${data.totalItems} | Valor total: ${this.formatCurrency(data.totalValue)}`, pageWidth - 15, 23, { align: 'right' });

    const tableData = data.items.map((item, i) => [
      (i + 1).toString(),
      item.code,
      item.name,
      item.category || '-',
      `${item.stock} ${item.unit}`,
      this.formatCurrency(item.unitPrice),
      this.formatCurrency(item.totalValue)
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Código', 'Nombre', 'Categoría', 'Stock', 'Valor Unit.', 'Valor Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 10, right: 10 }
    });

    // Footer with total
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 102, 204);
    doc.text(`VALOR TOTAL DEL INVENTARIO: ${this.formatCurrency(data.totalValue)}`, pageWidth - 10, finalY, { align: 'right' });

    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generado: ${new Date().toLocaleString('es-CO')} | InOut by CycloNet`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

    doc.save(`Inventario_Valorizado_${data.date}.pdf`);
  }

  // ═══════════════════════════════════════════════════════
  // NOTA DE AJUSTE DE INVENTARIO
  // ═══════════════════════════════════════════════════════
  async generateAdjustmentNote(data: {
    adjustmentCode: string;
    date: string;
    reason: string;
    items: { code: string; name: string; previousStock: number; newStock: number; difference: number; unit: string }[];
    authorizedBy: string;
    notes?: string;
  }): Promise<void> {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    this.drawHeader(doc, 'NOTA DE AJUSTE DE INVENTARIO', data.adjustmentCode);

    let y = 55;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(`Fecha: ${this.formatDate(data.date)}`, 15, y);
    doc.text(`Autorizado por: ${data.authorizedBy}`, pageWidth - 15, y, { align: 'right' });
    y += 6;
    doc.text(`Motivo: ${data.reason}`, 15, y);

    const tableData = data.items.map((item, i) => [
      (i + 1).toString(),
      item.code,
      item.name,
      `${item.previousStock} ${item.unit}`,
      `${item.newStock} ${item.unit}`,
      `${item.difference > 0 ? '+' : ''}${item.difference} ${item.unit}`
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [['#', 'Código', 'Material', 'Stock Anterior', 'Stock Nuevo', 'Diferencia']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 15, right: 15 }
    });

    if (data.notes) {
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Observaciones:', 15, finalY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.notes, 15, finalY + 6);
    }

    // Signature
    const sigY = doc.internal.pageSize.getHeight() - 35;
    doc.setDrawColor(0, 0, 0);
    doc.line(15, sigY, 95, sigY);
    doc.setFontSize(8);
    doc.text('Firma del responsable', 55, sigY + 5, { align: 'center' });

    this.drawFooter(doc);
    doc.save(`Ajuste_${data.adjustmentCode}.pdf`);
  }

  // ═══════════════════════════════════════════════════════
  // HELPERS COMPARTIDOS
  // ═══════════════════════════════════════════════════════

  private drawHeader(doc: any, title: string, code: string): void {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(0, 102, 204);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${code}`, 15, 28);

    doc.setFontSize(9);
    doc.text(this.businessName, pageWidth - 15, 15, { align: 'right' });
    doc.text('InOut - Sistema de Gestión', pageWidth - 15, 23, { align: 'right' });
    doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, pageWidth - 15, 31, { align: 'right' });
  }

  private drawTotals(doc: any, rows: { label: string; value: string; bold?: boolean }[]): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const boxX = pageWidth - 90;
    const boxWidth = 75;

    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(boxX, finalY, boxWidth, 10 + rows.length * 12, 3, 3, 'FD');

    let yPos = finalY + 10;
    rows.forEach(row => {
      doc.setFontSize(row.bold ? 11 : 9);
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
      doc.setTextColor(row.bold ? 0 : 107, row.bold ? 102 : 114, row.bold ? 204 : 128);
      doc.text(row.label, boxX + 5, yPos);
      doc.text(row.value, boxX + boxWidth - 5, yPos, { align: 'right' });
      yPos += 12;
    });
  }

  private drawFooter(doc: any): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const footerY = doc.internal.pageSize.getHeight() - 12;
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'normal');
    doc.text('Documento generado por InOut | CycloNet S.A.S.', pageWidth / 2, footerY, { align: 'center' });
  }

  private getTableStyles(): any {
    return {
      theme: 'striped',
      headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: { 0: { halign: 'center', cellWidth: 15 } },
      margin: { left: 15, right: 15 }
    };
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
