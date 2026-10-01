import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  CatalogOption, ComboAssembly, ComboComponentInput, ComboType, ComboView, CombosService,
} from '../../../shared/services/combos.service';
import { PermissionsService } from '../../../shared/services/permissions.service';
import { formatCop } from '../../../shared/utils/currency.util';

interface EditorComponent extends ComboComponentInput {
  option: CatalogOption;
}

/**
 * Combos y kits (Comercial). Combo virtual: se arma al venderse con el stock
 * de sus componentes. Kit armado: se arman lotes con stock propio (anchetas,
 * canastas). Crear, editar, armar y desarmar: solo administrador.
 */
@Component({
  selector: 'app-combos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './combos-admin.component.html',
  styleUrls: ['../catalog-admin.css'],
})
export class CombosAdminComponent implements OnInit {
  combos: ComboView[] = [];
  loading = true;
  error = '';
  typeFilter: 'all' | ComboType = 'all';
  statusFilter: 'active' | 'inactive' | 'all' = 'active';
  search = '';

  // Opciones del catálogo (para elegir componentes)
  options: CatalogOption[] = [];
  optionsLoaded = false;

  // Editor
  editorOpen = false;
  editing: ComboView | null = null;
  saving = false;
  form = this.emptyForm();
  components: EditorComponent[] = [];
  pickerQuery = '';

  // Armar / desarmar
  stockDialog: { combo: ComboView; mode: 'assemble' | 'disassemble' } | null = null;
  stockQty = 1;
  stockDate = this.today();
  stockNotes = '';
  stockBusy = false;

  // Historial de lotes
  historyFor: ComboView | null = null;
  history: ComboAssembly[] = [];
  historyLoading = false;

  readonly formatCop = formatCop;

  constructor(private combosService: CombosService, public permissions: PermissionsService) {}

  ngOnInit(): void {
    this.load();
  }

  get isAdmin(): boolean {
    return this.permissions.isAdmin;
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.combosService.list().subscribe({
      next: (list) => { this.combos = list; this.loading = false; },
      error: (err) => { this.error = err?.error?.message || 'No se pudieron cargar los combos.'; this.loading = false; },
    });
  }

  get filtered(): ComboView[] {
    const q = this.search.trim().toLowerCase();
    return this.combos.filter((c) =>
      (this.typeFilter === 'all' || c.strType === this.typeFilter)
      && (this.statusFilter === 'all' || c.strStatus === this.statusFilter)
      && (!q || c.strName.toLowerCase().includes(q) || (c.strCode || '').toLowerCase().includes(q)));
  }

  // ── Presentación ───────────────────────────────────────────────────

  componentLabel(c: { quantity: number; quantityMode: string; unitMeasure?: string | null; name: string }): string {
    const qty = Math.round(c.quantity * 1000) / 1000;
    return c.quantityMode === 'STOCK' ? `${qty} ${c.unitMeasure || ''} de ${c.name}`.replace('  ', ' ') : `${qty} x ${c.name}`;
  }

  availabilityText(c: ComboView): string {
    if (c.strType === 'KIT') {
      const reserved = c.ingReservedStock > 0 ? ` (+${c.ingReservedStock} reservados)` : '';
      return `${c.available ?? 0} armados libres${reserved}`;
    }
    return c.available === null ? 'Sin límite (bajo pedido)' : `${c.available} disponibles`;
  }

  // ── Editor ─────────────────────────────────────────────────────────

  private emptyForm() {
    return { name: '', description: '', type: 'VIRTUAL' as ComboType, price: 0, marketplaceVisible: true };
  }

  private loadOptions(then: () => void): void {
    if (this.optionsLoaded) { then(); return; }
    this.combosService.options().subscribe({
      next: (o) => { this.options = o.items.filter((i) => i.active); this.optionsLoaded = true; then(); },
      error: (err) => Swal.fire('No se pudo cargar el catálogo', err?.error?.message || 'Intenta de nuevo.', 'error'),
    });
  }

  openNew(): void {
    this.loadOptions(() => {
      this.editing = null;
      this.form = this.emptyForm();
      this.components = [];
      this.pickerQuery = '';
      this.editorOpen = true;
    });
  }

  openEdit(combo: ComboView): void {
    // Se recarga el catálogo para tener precios/stock al día
    this.optionsLoaded = false;
    this.loadOptions(() => {
      this.editing = combo;
      this.form = {
        name: combo.strName,
        description: combo.strDescription || '',
        type: combo.strType,
        price: combo.fltPrice,
        marketplaceVisible: combo.blnMarketplaceVisible,
      };
      this.components = combo.components
        .map((c) => {
          const option = this.options.find((o) => o.itemType === c.itemType && o.id === c.itemId);
          return option ? { itemType: c.itemType, itemId: c.itemId, quantity: c.quantity, quantityMode: c.quantityMode, option } : null;
        })
        .filter((c): c is EditorComponent => !!c);
      this.pickerQuery = '';
      this.editorOpen = true;
    });
  }

  closeEditor(): void {
    this.editorOpen = false;
  }

  /** Un kit con unidades armadas no puede cambiar su receta (hay que desarmarlo). */
  get componentsLocked(): boolean {
    return !!this.editing && this.editing.strType === 'KIT' && (this.editing.ingQuantity > 0 || this.editing.ingReservedStock > 0);
  }

  setType(type: ComboType): void {
    if (this.editing) return; // el tipo no cambia al editar
    this.form.type = type;
    if (type === 'VIRTUAL') {
      // Un combo virtual no lleva insumos: se quitan los que no son de reventa
      this.components = this.components
        .filter((c) => c.option.resale)
        .map((c) => ({ ...c, quantityMode: 'SALE' }));
    }
  }

  get pickerResults(): CatalogOption[] {
    const q = this.pickerQuery.trim().toLowerCase();
    if (!q) return [];
    return this.options
      .filter((o) => o.name.toLowerCase().includes(q) || (o.saleName || '').toLowerCase().includes(q))
      .slice(0, 25);
  }

  /** Por qué no se puede agregar (o null si se puede). */
  pickBlockedReason(o: CatalogOption): string | null {
    if (this.form.type === 'VIRTUAL' && !o.resale) return 'No es de reventa (solo para kits)';
    return null;
  }

  optionTypeLabel(o: CatalogOption): string {
    if (o.itemType === 'product') return 'Producto';
    return o.resale ? 'Reventa' : 'Insumo';
  }

  addComponent(o: CatalogOption): void {
    if (this.pickBlockedReason(o)) return;
    const mode = o.resale ? 'SALE' : 'STOCK';
    const existing = this.components.find((c) => c.itemType === o.itemType && c.itemId === o.id && c.quantityMode === mode);
    if (existing) existing.quantity += 1;
    else this.components.push({ itemType: o.itemType, itemId: o.id, quantity: 1, quantityMode: mode, option: o });
    this.pickerQuery = '';
  }

  removeComponent(i: number): void {
    this.components.splice(i, 1);
  }

  /** Material de reventa en un kit: se puede contar por presentación o como insumo. */
  canToggleMode(c: EditorComponent): boolean {
    return this.form.type === 'KIT' && c.itemType !== 'product' && c.option.resale;
  }

  unitLabel(c: EditorComponent): string {
    if (c.itemType === 'product') return 'und';
    return c.quantityMode === 'STOCK' ? (c.option.unit || 'und. medida') : 'presentación';
  }

  private stockPerCombo(c: EditorComponent): number {
    return c.itemType === 'product' || c.quantityMode === 'STOCK' ? c.quantity : c.quantity * (c.option.presentationFactor || 1);
  }

  get summary() {
    const listPrice = this.components.reduce((s, c) => s + (c.quantityMode === 'SALE' ? c.option.listPrice * c.quantity : 0), 0);
    const cost = this.components.reduce((s, c) => s + this.stockPerCombo(c) * c.option.stockUnitCost, 0);
    const price = Number(this.form.price) || 0;
    return {
      listPrice,
      cost,
      savings: Math.max(0, listPrice - price),
      savingsPercent: listPrice > 0 ? Math.max(0, ((listPrice - price) / listPrice) * 100) : 0,
      margin: price - cost,
      marginPercent: price > 0 ? ((price - cost) / price) * 100 : 0,
      belowCost: price < cost,
    };
  }

  save(): void {
    const name = this.form.name.trim();
    if (!name) { Swal.fire('Falta el nombre', 'Ponle un nombre al combo.', 'warning'); return; }
    if (!(Number(this.form.price) >= 0)) { Swal.fire('Precio no válido', 'Indica el precio del combo.', 'warning'); return; }
    if (this.components.length === 0) { Swal.fire('Sin componentes', 'Agrega al menos un producto o material.', 'warning'); return; }
    if (this.components.some((c) => !(Number(c.quantity) > 0))) { Swal.fire('Cantidad no válida', 'Cada componente debe tener una cantidad mayor a cero.', 'warning'); return; }

    const doSave = () => {
      const components = this.components.map((c) => ({ itemType: c.itemType, itemId: c.itemId, quantity: Number(c.quantity), quantityMode: c.quantityMode }));
      const body: any = {
        name,
        description: this.form.description.trim(),
        price: Number(this.form.price),
        marketplaceVisible: this.form.marketplaceVisible,
      };
      if (!this.componentsLocked) body.components = components;
      this.saving = true;
      const req = this.editing
        ? this.combosService.update(this.editing.strId, body)
        : this.combosService.create({ ...body, type: this.form.type, components });
      req.subscribe({
        next: () => {
          this.saving = false;
          this.editorOpen = false;
          this.load();
          Swal.fire({ icon: 'success', title: this.editing ? 'Combo actualizado' : 'Combo creado', timer: 1600, showConfirmButton: false });
        },
        error: (err) => { this.saving = false; Swal.fire('No se pudo guardar', err?.error?.message || 'Intenta de nuevo.', 'error'); },
      });
    };

    if (this.summary.belowCost) {
      Swal.fire({
        icon: 'warning',
        title: 'El precio está por debajo del costo',
        text: `Costo estimado ${formatCop(this.summary.cost)} y precio ${formatCop(this.form.price)}. ¿Guardar de todos modos?`,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Revisar',
      }).then((r) => r.isConfirmed && doSave());
    } else {
      doSave();
    }
  }

  // ── Estado y borrado ───────────────────────────────────────────────

  toggleStatus(combo: ComboView): void {
    const status = combo.strStatus === 'active' ? 'inactive' : 'active';
    this.combosService.update(combo.strId, { status }).subscribe({
      next: () => this.load(),
      error: (err) => Swal.fire('No se pudo cambiar el estado', err?.error?.message || 'Intenta de nuevo.', 'error'),
    });
  }

  remove(combo: ComboView): void {
    Swal.fire({
      icon: 'warning',
      title: `¿Eliminar "${combo.strName}"?`,
      text: combo.strType === 'KIT' ? 'Si el kit tiene historial de armado, quedará inactivo en vez de eliminarse.' : 'Los pedidos anteriores conservan su detalle.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.combosService.remove(combo.strId).subscribe({
        next: (res) => { this.load(); if (res.deactivated) Swal.fire('Kit desactivado', res.message, 'info'); },
        error: (err) => Swal.fire('No se pudo eliminar', err?.error?.message || 'Intenta de nuevo.', 'error'),
      });
    });
  }

  // ── Armar / desarmar ───────────────────────────────────────────────

  openStock(combo: ComboView, mode: 'assemble' | 'disassemble'): void {
    this.stockDialog = { combo, mode };
    this.stockQty = 1;
    this.stockDate = this.today();
    this.stockNotes = '';
  }

  closeStock(): void {
    this.stockDialog = null;
  }

  /** Lo que consume (o devuelve) el lote, por componente, en la unidad en que se definió. */
  get stockLines() {
    if (!this.stockDialog) return [];
    const qty = Math.max(0, Math.floor(Number(this.stockQty) || 0));
    return this.stockDialog.combo.components.map((c) => {
      const isPresentation = c.itemType !== 'product' && c.quantityMode === 'SALE';
      const factor = isPresentation ? c.presentationFactor || 1 : 1;
      const needed = c.quantity * qty;
      const available = c.stockAvailable / factor;
      const unit = c.itemType === 'product' ? 'und' : isPresentation ? 'pres.' : c.unitMeasure || '';
      return { name: c.name, needed, available, unit, short: this.stockDialog!.mode === 'assemble' && available + 1e-9 < needed };
    });
  }

  get maxStockQty(): number {
    if (!this.stockDialog) return 0;
    const c = this.stockDialog.combo;
    return this.stockDialog.mode === 'assemble' ? c.assemblable ?? 0 : c.available ?? 0;
  }

  confirmStock(): void {
    if (!this.stockDialog) return;
    const qty = Math.floor(Number(this.stockQty) || 0);
    if (qty < 1) { Swal.fire('Cantidad no válida', 'Indica cuántos kits.', 'warning'); return; }
    const { combo, mode } = this.stockDialog;
    this.stockBusy = true;
    const body = { quantity: qty, date: this.stockDate, notes: this.stockNotes.trim() || undefined };
    const req = mode === 'assemble' ? this.combosService.assemble(combo.strId, body) : this.combosService.disassemble(combo.strId, body);
    req.subscribe({
      next: (res) => {
        this.stockBusy = false;
        this.stockDialog = null;
        this.load();
        Swal.fire({ icon: 'success', title: res.message, timer: 1800, showConfirmButton: false });
      },
      error: (err) => { this.stockBusy = false; Swal.fire(mode === 'assemble' ? 'No se pudo armar' : 'No se pudo desarmar', err?.error?.message || 'Intenta de nuevo.', 'error'); },
    });
  }

  // ── Historial ──────────────────────────────────────────────────────

  openHistory(combo: ComboView): void {
    this.historyFor = combo;
    this.history = [];
    this.historyLoading = true;
    this.combosService.assemblies(combo.strId).subscribe({
      next: (list) => { this.history = list; this.historyLoading = false; },
      error: () => { this.historyLoading = false; },
    });
  }

  closeHistory(): void {
    this.historyFor = null;
  }

  /** 'YYYY-MM-DD' -> 'DD/MM/YYYY' sin pasar por Date (evita correrse un día por zona horaria). */
  dayLabel(day: string): string {
    const [y, m, d] = String(day || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : '';
  }

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }
}
