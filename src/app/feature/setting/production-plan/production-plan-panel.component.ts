import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { DocumentsService } from '../../../shared/services/documents.service';

type PlanItemType = 'product' | 'material' | 'material_t';

export interface PlanRow {
  itemType: PlanItemType;
  itemId: string;
  productName: string;
  productCode: string | null;
  measurementUnit: string | null;
  categoryId: number | null;
  categoryName: string | null;
  status: string | null;
  stock: number;
  unitPrice: number;
  plannedMonthlyUnits: number;
  plannedValue: number;
  isDefaultValue: boolean;
}

/**
 * Plan de producción y venta del período activo: unidades a producir por
 * producto y presentaciones a vender por material / material compuesto de
 * reventa. Con búsqueda, filtros, orden, paginación, carga masiva y
 * exportación (Excel y PDF) para negocios con muchos ítems.
 */
@Component({
  selector: 'app-production-plan-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production-plan-panel.component.html',
  styleUrls: ['./production-plan-panel.component.css'],
})
export class ProductionPlanPanelComponent implements OnChanges, OnDestroy {
  /** Período activo ({ id, nombre }). */
  @Input() period: any = null;

  rows: PlanRow[] = [];
  loading = false;
  loadError = '';

  // Filtros
  search = '';
  typeFilter: 'all' | 'product' | 'resale' = 'all';
  categoryFilter = '';
  planFilter: 'all' | 'planned' | 'unplanned' = 'all';
  sortBy: 'name' | 'units' | 'value' | 'stock' = 'name';

  // Paginación
  page = 1;
  readonly pageSizes = [15, 30, 60];
  pageSize = 15;

  // Guardado por renglón (autoguardado con debounce)
  private saveTimers = new Map<string, any>();
  savingKeys = new Set<string>();
  savedKeys = new Set<string>();

  // Carga masiva
  bulkUnits: number | null = null;
  bulkRunning = false;

  private baseUrl = environment.apiUrl;
  readonly Math = Math;

  constructor(private http: HttpClient, private documentsService: DocumentsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['period']) this.load();
  }

  ngOnDestroy(): void {
    this.saveTimers.forEach((t) => clearTimeout(t));
  }

  load(): void {
    if (!this.period?.id) {
      this.rows = [];
      return;
    }
    this.loading = true;
    this.loadError = '';
    this.http.get<PlanRow[]>(`${this.baseUrl}/production-plans`, { params: { periodId: this.period.id } }).subscribe({
      next: (rows) => {
        this.rows = (rows || []).map((r: any) => ({ ...r, itemType: r.itemType || 'product', itemId: r.itemId || r.productId }));
        this.loading = false;
        this.page = 1;
      },
      error: (err) => {
        this.rows = [];
        this.loading = false;
        this.loadError = err?.error?.message || 'No se pudo cargar el plan de producción.';
      },
    });
  }

  // ─── Derivados ────────────────────────────────────────────────────────────

  key(row: PlanRow): string {
    return `${row.itemType}:${row.itemId}`;
  }

  isResale(row: PlanRow): boolean {
    return row.itemType !== 'product';
  }

  typeLabel(row: PlanRow): string {
    return row.itemType === 'product' ? 'Producto' : row.itemType === 'material' ? 'Reventa · Material' : 'Reventa · Compuesto';
  }

  get categories(): { id: string; name: string }[] {
    const seen = new Map<string, string>();
    this.rows.forEach((r) => {
      if (r.categoryId != null) seen.set(String(r.categoryId), r.categoryName || `Categoría ${r.categoryId}`);
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  get hasUncategorized(): boolean {
    return this.rows.some((r) => r.categoryId == null);
  }

  get filteredRows(): PlanRow[] {
    const q = this.search.trim().toLowerCase();
    const rows = this.rows.filter((r) => {
      if (this.typeFilter === 'product' && r.itemType !== 'product') return false;
      if (this.typeFilter === 'resale' && r.itemType === 'product') return false;
      if (this.categoryFilter === '__none' && r.categoryId != null) return false;
      if (this.categoryFilter && this.categoryFilter !== '__none' && String(r.categoryId) !== this.categoryFilter) return false;
      if (this.planFilter === 'planned' && !(r.plannedMonthlyUnits > 0)) return false;
      if (this.planFilter === 'unplanned' && r.plannedMonthlyUnits > 0) return false;
      if (q && !`${r.productName} ${r.productCode || ''} ${r.categoryName || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const by = this.sortBy;
    return rows.sort((a, b) => {
      if (by === 'units') return b.plannedMonthlyUnits - a.plannedMonthlyUnits;
      if (by === 'value') return b.plannedValue - a.plannedValue;
      if (by === 'stock') return a.stock - b.stock;
      return a.productName.localeCompare(b.productName);
    });
  }

  get pagedRows(): PlanRow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  get counts() {
    const products = this.rows.filter((r) => r.itemType === 'product').length;
    return { all: this.rows.length, product: products, resale: this.rows.length - products };
  }

  /** Totales sobre lo filtrado (lo que se ve y lo que se exporta). */
  get summary() {
    const rows = this.filteredRows;
    const planned = rows.filter((r) => r.plannedMonthlyUnits > 0);
    return {
      items: rows.length,
      planned: planned.length,
      unplanned: rows.length - planned.length,
      units: rows.reduce((s, r) => s + (r.plannedMonthlyUnits || 0), 0),
      value: rows.reduce((s, r) => s + (r.plannedValue || 0), 0),
    };
  }

  get hasActiveFilters(): boolean {
    return !!this.search.trim() || this.typeFilter !== 'all' || !!this.categoryFilter || this.planFilter !== 'all';
  }

  onFiltersChange(): void {
    this.page = 1;
  }

  clearFilters(): void {
    this.search = '';
    this.typeFilter = 'all';
    this.categoryFilter = '';
    this.planFilter = 'all';
    this.page = 1;
  }

  goToPage(p: number): void {
    this.page = Math.min(Math.max(1, p), this.totalPages);
  }

  // ─── Edición ──────────────────────────────────────────────────────────────

  /** Autoguarda con debounce corto: evita un POST por cada tecla. */
  onUnitsChange(row: PlanRow, value: any): void {
    const units = Math.max(0, Number(value) || 0);
    row.plannedMonthlyUnits = units;
    row.plannedValue = units * (row.unitPrice || 0);
    row.isDefaultValue = false;
    const k = this.key(row);
    this.savedKeys.delete(k);
    const existing = this.saveTimers.get(k);
    if (existing) clearTimeout(existing);
    this.saveTimers.set(k, setTimeout(() => this.saveRow(row), 600));
  }

  private saveRow(row: PlanRow): Promise<void> {
    const k = this.key(row);
    this.savingKeys.add(k);
    return new Promise((resolve, reject) => {
      this.http.post(`${this.baseUrl}/production-plans`, {
        productId: row.itemId,
        itemType: row.itemType,
        periodId: this.period.id,
        plannedMonthlyUnits: row.plannedMonthlyUnits || 0,
      }).subscribe({
        next: () => {
          this.savingKeys.delete(k);
          this.savedKeys.add(k);
          setTimeout(() => this.savedKeys.delete(k), 1500);
          resolve();
        },
        error: (err) => {
          this.savingKeys.delete(k);
          reject(err);
        },
      });
    });
  }

  /** Aplica las mismas unidades a todos los ítems filtrados (confirmando antes). */
  async applyBulk(): Promise<void> {
    const units = Math.max(0, Number(this.bulkUnits) || 0);
    const targets = this.filteredRows;
    if (!targets.length) return;
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Aplicar a los ítems filtrados',
      html: `Se asignarán <strong>${units}</strong> unidades/mes a <strong>${targets.length}</strong> ítem(s) del plan de <strong>${this.period?.nombre || ''}</strong>.`,
      showCancelButton: true,
      confirmButtonText: 'Aplicar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0066CC',
    });
    if (!confirm.isConfirmed) return;

    this.bulkRunning = true;
    let failed = 0;
    for (const row of targets) {
      row.plannedMonthlyUnits = units;
      row.plannedValue = units * (row.unitPrice || 0);
      row.isDefaultValue = false;
      try {
        await this.saveRow(row);
      } catch {
        failed++;
      }
    }
    this.bulkRunning = false;
    this.bulkUnits = null;
    if (failed) {
      Swal.fire('Guardado parcial', `${failed} ítem(s) no se pudieron guardar. Intenta de nuevo.`, 'warning');
    } else {
      Swal.fire({ icon: 'success', title: 'Plan actualizado', timer: 1400, showConfirmButton: false });
    }
  }

  // ─── Documentos ───────────────────────────────────────────────────────────

  private filterSummary(): string {
    const parts: string[] = [];
    if (this.typeFilter === 'product') parts.push('Solo productos');
    if (this.typeFilter === 'resale') parts.push('Solo reventa');
    if (this.categoryFilter === '__none') parts.push('Sin categoría');
    else if (this.categoryFilter) parts.push(`Categoría: ${this.categories.find((c) => c.id === this.categoryFilter)?.name || ''}`);
    if (this.planFilter === 'planned') parts.push('Con plan');
    if (this.planFilter === 'unplanned') parts.push('Sin plan');
    if (this.search.trim()) parts.push(`Búsqueda: "${this.search.trim()}"`);
    return parts.join(' · ');
  }

  async exportPdf(): Promise<void> {
    const rows = this.filteredRows;
    if (!rows.length) return;
    await this.documentsService.generateProductionPlan({
      periodName: this.period?.nombre || '',
      filterSummary: this.filterSummary(),
      rows: rows.map((r) => ({
        type: this.typeLabel(r),
        name: r.productName,
        code: r.productCode || '',
        category: r.categoryName || '',
        unit: r.measurementUnit || '',
        stock: r.stock,
        unitPrice: r.unitPrice,
        plannedUnits: r.plannedMonthlyUnits,
        plannedValue: r.plannedValue,
      })),
    });
  }

  async exportExcel(): Promise<void> {
    const rows = this.filteredRows;
    if (!rows.length) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Plan de producción');

    ws.addRow([`Plan de producción y venta — ${this.period?.nombre || ''}`]).font = { bold: true, size: 13 };
    const summary = this.filterSummary();
    if (summary) ws.addRow([`Filtros: ${summary}`]).font = { italic: true, color: { argb: 'FF6B7280' } };
    ws.addRow([]);

    const header = ws.addRow(['Tipo', 'Código', 'Ítem', 'Categoría', 'Unidad', 'Stock', 'Precio', 'Unidades / mes', 'Valor planeado']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } }; });

    rows.forEach((r) => ws.addRow([
      this.typeLabel(r), r.productCode || '', r.productName, r.categoryName || '', r.measurementUnit || '',
      r.stock, r.unitPrice, r.plannedMonthlyUnits, r.plannedValue,
    ]));

    const total = ws.addRow(['', '', 'TOTAL', '', '', '', '',
      rows.reduce((s, r) => s + r.plannedMonthlyUnits, 0),
      rows.reduce((s, r) => s + r.plannedValue, 0)]);
    total.font = { bold: true };

    [14, 16, 40, 22, 16, 12, 14, 16, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.getColumn(7).numFmt = '"$"#,##0';
    ws.getColumn(9).numFmt = '"$"#,##0';

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Plan_Produccion_${(this.period?.nombre || 'periodo').replace(/[^A-Za-z0-9_-]+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
  }

  formatNumber(v: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(v || 0);
  }
}
