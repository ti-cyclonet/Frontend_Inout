import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderData {
  id: string;
  orderCode: string;
  customerName: string;
  customerId?: string | null;
  items: OrderItem[];
  notes?: string;
  deliveryDate?: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  createdAt: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {

  constructor(private http: HttpClient) {}

  async generateOrderInvoice(order: OrderData): Promise<void> {
    // Fetch business params to get IVA/INC if not already applied
    let taxPercent = 0;
    let taxLabel = 'IVA';
    let tax = order.tax || 0;
    let total = order.total || 0;
    const subtotal = order.subtotal || 0;

    try {
      const params: any = await this.http.get(`${environment.apiUrl}/business-params`).toPromise();
      const ivaPercent = params?.IVA_PORCENTAJE || 0;
      const incPercent = params?.INC_PORCENTAJE || 0;
      taxPercent = incPercent > 0 ? incPercent : ivaPercent;
      taxLabel = incPercent > 0 ? 'INC' : 'IVA';
      if (taxPercent > 0 && tax === 0) {
        tax = Math.round(subtotal * (taxPercent / 100));
        total = subtotal + tax - (order.discount || 0);
      }
    } catch {}

    // Dynamic imports to avoid SSR issues with jspdf (CommonJS module)
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(0, 102, 204);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA', 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${order.orderCode}`, 15, 30);

    // Company info (right side of header)
    doc.setFontSize(9);
    doc.text('InOut - Sistema de Gestión', pageWidth - 15, 15, { align: 'right' });
    doc.text(`Fecha: ${this.formatDate(order.createdAt)}`, pageWidth - 15, 22, { align: 'right' });
    if (order.deliveryDate) {
      doc.text(`Entrega: ${this.formatDate(order.deliveryDate)}`, pageWidth - 15, 29, { align: 'right' });
    }

    // Customer section
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Facturar a:', 15, 55);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(order.customerName || 'Cliente no especificado', 15, 62);

    // Status badge
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const statusLabel = this.getStatusLabel(order.status);
    doc.text(`Estado: ${statusLabel}`, pageWidth - 15, 55, { align: 'right' });

    // Items table
    const tableData = (order.items || []).map((item, index) => [
      (index + 1).toString(),
      item.productName,
      item.quantity.toString(),
      this.formatCurrency(item.unitPrice),
      this.formatCurrency(item.subtotal)
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['#', 'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [55, 65, 81]
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 35 }
      },
      margin: { left: 15, right: 15 }
    });

    // Totals section
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals box
    const boxX = pageWidth - 90;
    const boxWidth = 75;

    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(boxX, finalY, boxWidth, 50, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);

    let yPos = finalY + 12;
    doc.text('Subtotal:', boxX + 5, yPos);
    doc.text(this.formatCurrency(subtotal), boxX + boxWidth - 5, yPos, { align: 'right' });

    yPos += 10;
    doc.text(`${taxLabel} (${taxPercent}%):`, boxX + 5, yPos);
    doc.text(this.formatCurrency(tax), boxX + boxWidth - 5, yPos, { align: 'right' });

    if (order.discount > 0) {
      yPos += 10;
      doc.text('Descuento:', boxX + 5, yPos);
      doc.text(`-${this.formatCurrency(order.discount)}`, boxX + boxWidth - 5, yPos, { align: 'right' });
    }

    yPos += 14;
    doc.setDrawColor(0, 102, 204);
    doc.line(boxX + 5, yPos - 5, boxX + boxWidth - 5, yPos - 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 204);
    doc.text('TOTAL:', boxX + 5, yPos);
    doc.text(this.formatCurrency(total), boxX + boxWidth - 5, yPos, { align: 'right' });

    // Notes section
    if (order.notes) {
      const notesY = finalY + 65;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('Notas:', 15, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      const splitNotes = doc.splitTextToSize(order.notes, pageWidth - 30);
      doc.text(splitNotes, 15, notesY + 7);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'normal');
    doc.text('Documento generado automáticamente por InOut', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageWidth / 2, footerY + 5, { align: 'center' });

    // Download
    doc.save(`Factura_${order.orderCode}.pdf`);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      CONFIRMED: 'Confirmado',
      IN_PRODUCTION: 'En Producción',
      READY: 'Listo',
      DELIVERED: 'Entregado',
      INVOICED: 'Facturado',
      CANCELLED: 'Cancelado'
    };
    return labels[status] || status;
  }
}
