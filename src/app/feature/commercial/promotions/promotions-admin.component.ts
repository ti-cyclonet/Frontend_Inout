import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { PromotionState, PromotionTargetType, PromotionView, PromotionsService } from '../../../shared/services/promotions.service';
import { CombosService } from '../../../shared/services/combos.service';
import { PermissionsService } from '../../../shared/services/permissions.service';
import { formatCop } from '../../../shared/utils/currency.util';

/** Algo a lo que se le puede aplicar una promoción (ítem, combo, kit o categoría). */
interface TargetOption {
  type: PromotionTargetType;
  id: string;
  name: string;
  hint: string;
}

const STATE_LABELS: Record<PromotionState, { text: string; cls: string }> = {
  live: { text: 'En curso', cls: 'green' },
  waiting: { text: 'Vigente, fuera de horario', cls: 'blue' },
  scheduled: { text: 'Programada', cls: 'violet' },
  expired: { text: 'Vencida', cls: 'gray' },
  inactive: { text: 'Inactiva', cls: 'gray' },
};

const DAYS = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mié' }, { n: 4, label: 'Jue' },
  { n: 5, label: 'Vie' }, { n: 6, label: 'Sáb' }, { n: 0, label: 'Dom' },
];

/**
 * Promociones (Comercial): % o valor fijo sobre productos, categorías, combos
 * o todo el catálogo, con vigencia y canal. En cada línea se aplica solo la
 * mejor promoción vigente. Crear y editar: solo administrador.
 */
@Component({
  selector: 'app-promotions-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotions-admin.component.html',
  styleUrls: ['../catalog-admin.css'],
})
export class PromotionsAdminComponent implements OnInit {
  promotions: PromotionView[] = [];
  loading = true;
  error = '';
  stateFilter: 'current' | 'all' | 'ended' = 'current';
  search = '';

  targetOptions: TargetOption[] = [];
  optionsLoaded = false;

  editorOpen = false;
  editing: PromotionView | null = null;
  saving = false;
  form = this.emptyForm();
  pickerQuery = '';
  useTimeRange = false;

  readonly days = DAYS;
  readonly formatCop = formatCop;

  constructor(
    private promotionsService: PromotionsService,
    private combosService: CombosService,
    public permissions: PermissionsService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get isAdmin(): boolean {
    return this.permissions.isAdmin;
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.promotionsService.list().subscribe({
      next: (list) => { this.promotions = list; this.loading = false; },
      error: (err) => { this.error = err?.error?.message || 'No se pudieron cargar las promociones.'; this.loading = false; },
    });
  }

  get filtered(): PromotionView[] {
    const q = this.search.trim().toLowerCase();
    return this.promotions.filter((p) => {
      const ended = p.state === 'expired' || p.state === 'inactive';
      const okState = this.stateFilter === 'all' || (this.stateFilter === 'ended' ? ended : !ended);
      return okState && (!q || p.strName.toLowerCase().includes(q));
    });
  }

  // ── Presentación ───────────────────────────────────────────────────

  stateLabel(p: PromotionView) {
    return STATE_LABELS[p.state] || STATE_LABELS.inactive;
  }

  channelLabel(channel: string): string {
    return channel === 'POS' ? 'Solo tienda' : channel === 'MARKETPLACE' ? 'Solo MarketPlace' : 'Tienda y MarketPlace';
  }

  targetsLabel(p: PromotionView): string {
    if (p.scope === 'ALL') return 'Todo el catálogo';
    const names = p.targets.map((t) => (t.type === 'category' ? `Categoría ${t.name || ''}` : t.name || '(ya no existe)').trim());
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} y ${names.length - 3} más` : names.join(', ');
  }

  scheduleLabel(p: PromotionView): string {
    const parts: string[] = [];
    parts.push(p.endDate ? `Del ${this.dayLabel(p.startDate)} al ${this.dayLabel(p.endDate)}` : `Desde el ${this.dayLabel(p.startDate)}`);
    if (p.weekdays?.length) parts.push(DAYS.filter((d) => p.weekdays!.includes(d.n)).map((d) => d.label).join(', '));
    if (p.timeFrom && p.timeTo) parts.push(`${p.timeFrom} a ${p.timeTo}`);
    return parts.join(' · ');
  }

  dayLabel(day: string): string {
    const [y, m, d] = String(day || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : '';
  }

  // ── Editor ─────────────────────────────────────────────────────────

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }

  private emptyForm() {
    return {
      name: '',
      description: '',
      discountType: 'PERCENT' as 'PERCENT' | 'FIXED',
      value: 10,
      scope: 'ITEMS' as 'ITEMS' | 'ALL',
      targets: [] as TargetOption[],
      channel: 'ALL' as 'ALL' | 'POS' | 'MARKETPLACE',
      startDate: this.today(),
      endDate: '' as string,
      weekdays: [] as number[],
      timeFrom: '16:00',
      timeTo: '18:00',
    };
  }

  private loadOptions(then: () => void): void {
    if (this.optionsLoaded) { then(); return; }
    this.combosService.options().subscribe({
      next: (o) => {
        this.targetOptions = [
          ...o.categories.map((c): TargetOption => ({ type: 'category', id: c.id, name: c.name, hint: 'Categoría' })),
          // Solo lo que se vende: productos y materiales de reventa
          ...o.items.filter((i) => i.active && i.resale).map((i): TargetOption => ({
            type: i.itemType, id: i.id, name: i.saleName || i.name, hint: `${i.itemType === 'product' ? 'Producto' : 'Reventa'} · ${formatCop(i.listPrice)}`,
          })),
          ...o.combos.filter((c) => c.active).map((c): TargetOption => ({
            type: c.itemType, id: c.id, name: c.name, hint: `${c.itemType === 'kit' ? 'Kit' : 'Combo'} · ${formatCop(c.listPrice)}`,
          })),
        ];
        this.optionsLoaded = true;
        then();
      },
      error: (err) => Swal.fire('No se pudo cargar el catálogo', err?.error?.message || 'Intenta de nuevo.', 'error'),
    });
  }

  openNew(): void {
    this.loadOptions(() => {
      this.editing = null;
      this.form = this.emptyForm();
      this.useTimeRange = false;
      this.pickerQuery = '';
      this.editorOpen = true;
    });
  }

  openEdit(p: PromotionView): void {
    this.optionsLoaded = false;
    this.loadOptions(() => {
      this.editing = p;
      this.form = {
        name: p.strName,
        description: p.strDescription || '',
        discountType: p.discountType,
        value: p.value,
        scope: p.scope,
        targets: p.targets.map((t) => this.targetOptions.find((o) => o.type === t.type && o.id === t.id)
          || { type: t.type, id: t.id, name: t.name || '(ya no existe)', hint: '' }),
        channel: p.channel,
        startDate: p.startDate,
        endDate: p.endDate || '',
        weekdays: [...(p.weekdays || [])],
        timeFrom: p.timeFrom || '16:00',
        timeTo: p.timeTo || '18:00',
      };
      this.useTimeRange = !!(p.timeFrom && p.timeTo);
      this.pickerQuery = '';
      this.editorOpen = true;
    });
  }

  closeEditor(): void {
    this.editorOpen = false;
  }

  get pickerResults(): TargetOption[] {
    const q = this.pickerQuery.trim().toLowerCase();
    if (!q) return [];
    return this.targetOptions
      .filter((o) => o.name.toLowerCase().includes(q) && !this.form.targets.some((t) => t.type === o.type && t.id === o.id))
      .slice(0, 25);
  }

  addTarget(o: TargetOption): void {
    this.form.targets.push(o);
    this.pickerQuery = '';
  }

  removeTarget(i: number): void {
    this.form.targets.splice(i, 1);
  }

  toggleDay(n: number): void {
    const i = this.form.weekdays.indexOf(n);
    if (i >= 0) this.form.weekdays.splice(i, 1);
    else this.form.weekdays.push(n);
  }

  /** Vista previa del descuento sobre un precio de ejemplo. */
  get preview(): string {
    const v = Number(this.form.value) || 0;
    return this.form.discountType === 'PERCENT'
      ? `Un producto de ${formatCop(10000)} queda en ${formatCop(10000 * (1 - Math.min(100, v) / 100))}`
      : `Cada unidad baja ${formatCop(v)} (nunca por debajo de $0)`;
  }

  save(): void {
    const f = this.form;
    const name = f.name.trim();
    if (!name) { Swal.fire('Falta el nombre', 'Ponle un nombre a la promoción.', 'warning'); return; }
    if (!(Number(f.value) > 0)) { Swal.fire('Descuento no válido', 'El descuento debe ser mayor a cero.', 'warning'); return; }
    if (f.discountType === 'PERCENT' && Number(f.value) > 100) { Swal.fire('Descuento no válido', 'El porcentaje no puede pasar de 100.', 'warning'); return; }
    if (f.scope === 'ITEMS' && f.targets.length === 0) { Swal.fire('¿A qué aplica?', 'Elige productos, categorías o combos, o marca "Todo el catálogo".', 'warning'); return; }
    if (!f.startDate) { Swal.fire('Falta la fecha', 'Indica desde cuándo aplica.', 'warning'); return; }
    if (f.endDate && f.endDate < f.startDate) { Swal.fire('Fechas no válidas', 'La fecha de fin no puede ser anterior a la de inicio.', 'warning'); return; }
    if (this.useTimeRange && (!f.timeFrom || !f.timeTo || f.timeFrom === f.timeTo)) { Swal.fire('Franja no válida', 'Indica una hora de inicio y una de fin distintas.', 'warning'); return; }

    const body = {
      name,
      description: f.description.trim(),
      discountType: f.discountType,
      value: Number(f.value),
      scope: f.scope,
      targets: f.scope === 'ITEMS' ? f.targets.map((t) => ({ type: t.type, id: t.id })) : [],
      channel: f.channel,
      startDate: f.startDate,
      endDate: f.endDate || null,
      weekdays: f.weekdays.length ? [...f.weekdays] : null,
      timeFrom: this.useTimeRange ? f.timeFrom : null,
      timeTo: this.useTimeRange ? f.timeTo : null,
    };
    this.saving = true;
    const req = this.editing ? this.promotionsService.update(this.editing.strId, body) : this.promotionsService.create(body);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.editorOpen = false;
        this.load();
        Swal.fire({ icon: 'success', title: this.editing ? 'Promoción actualizada' : 'Promoción creada', timer: 1600, showConfirmButton: false });
      },
      error: (err) => { this.saving = false; Swal.fire('No se pudo guardar', err?.error?.message || 'Intenta de nuevo.', 'error'); },
    });
  }

  toggleStatus(p: PromotionView): void {
    const status = p.strStatus === 'active' ? 'inactive' : 'active';
    this.promotionsService.update(p.strId, { status }).subscribe({
      next: () => this.load(),
      error: (err) => Swal.fire('No se pudo cambiar el estado', err?.error?.message || 'Intenta de nuevo.', 'error'),
    });
  }

  remove(p: PromotionView): void {
    Swal.fire({
      icon: 'warning',
      title: `¿Eliminar "${p.strName}"?`,
      text: 'Las ventas y pedidos anteriores conservan el descuento que se les aplicó.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.promotionsService.remove(p.strId).subscribe({
        next: () => this.load(),
        error: (err) => Swal.fire('No se pudo eliminar', err?.error?.message || 'Intenta de nuevo.', 'error'),
      });
    });
  }
}
