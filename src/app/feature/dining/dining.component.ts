import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import {
  DiningService, DiningSettings, DiningSlot, DiningTable, Reservation, ReservationStatus, TableShape,
} from '../../shared/services/dining.service';
import { PermissionsService } from '../../shared/services/permissions.service';
import { InfoTipComponent } from '../../shared/components/info-tip/info-tip.component';
import {
  STATUS_LABELS, TABLE_STATE_LABELS, TableLive, agendaBlock, agendaRange, hhmm, localDate, primaryAction, tableLive,
} from './dining.util';

/** Cada cuánto se refrescan mesas y reservas (otro equipo o la tienda pueden cambiarlas). */
const REFRESH_MS = 30_000;

interface ReservationForm {
  id: string | null;
  walkIn: boolean;
  partySize: number;
  date: string;
  time: string;
  durationMinutes: number;
  tableIds: string[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
}

interface TableForm {
  id: string | null;
  name: string;
  zone: string;
  seats: number;
  shape: TableShape;
  joinable: boolean;
}

/**
 * Mesas: plano del local con el estado de cada mesa en vivo, agenda del día,
 * reservas y clientes que llegan sin reserva.
 */
@Component({
  selector: 'app-dining',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, InfoTipComponent],
  templateUrl: './dining.component.html',
  styleUrls: ['./dining.component.css'],
})
export class DiningComponent implements OnInit, OnDestroy {
  @ViewChild('canvas') canvas?: ElementRef<HTMLElement>;

  view: 'plano' | 'agenda' = 'plano';
  date = localDate(new Date());
  now = Date.now();
  loading = true;
  disabled = false;

  tables: DiningTable[] = [];
  reservations: Reservation[] = [];
  settings: DiningSettings | null = null;
  zone = '';

  selectedTableId: string | null = null;

  // Edición del plano
  editing = false;
  private moved = new Map<string, { posX: number; posY: number }>();
  private drag: { id: string; rect: DOMRect; x: number; y: number } | null = null;
  /** Se arrastró: el clic de soltar no abre la mesa. */
  private dragged = false;

  // Ventanas
  tableForm: TableForm | null = null;
  resForm: ReservationForm | null = null;
  slots: DiningSlot[] = [];
  loadingSlots = false;
  settingsForm: DiningSettings | null = null;
  saving = false;

  readonly stateLabels: Record<string, string> = TABLE_STATE_LABELS;
  readonly statusLabels: Record<string, string> = STATUS_LABELS;
  readonly hhmm = hhmm;
  readonly primaryAction = primaryAction;
  readonly shapes: { value: TableShape; label: string }[] = [
    { value: 'square', label: 'Cuadrada' }, { value: 'round', label: 'Redonda' }, { value: 'rect', label: 'Rectangular' },
  ];

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private onMove = (e: PointerEvent) => this.dragMove(e);
  private onUp = () => this.dragEnd();

  constructor(private dining: DiningService, public permissions: PermissionsService) {}

  ngOnInit(): void {
    this.load();
    this.refreshTimer = setInterval(() => {
      this.now = Date.now();
      if (document.visibilityState === 'visible' && !this.editing) this.loadReservations();
    }, REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.dragEnd();
  }

  get canOperate(): boolean {
    return this.permissions.canEdit;
  }
  get isAdmin(): boolean {
    return this.permissions.isAdmin;
  }
  get isToday(): boolean {
    return this.date === localDate(new Date());
  }

  // ─── Datos ───

  load(): void {
    this.loading = true;
    forkJoin({ settings: this.dining.settings(), tables: this.dining.tables(), reservations: this.dining.reservations(this.date) }).subscribe({
      next: ({ settings, tables, reservations }) => {
        this.loading = false;
        this.settings = settings;
        this.tables = tables;
        this.reservations = reservations;
        if (!this.zone || !this.zones.includes(this.zone)) this.zone = this.zones[0] || '';
        this.now = Date.now();
      },
      error: (err) => {
        this.loading = false;
        if (err?.error?.error === 'MODULE_DISABLED' || err?.status === 403) this.disabled = true;
      },
    });
  }

  loadReservations(): void {
    this.dining.reservations(this.date).subscribe({ next: (r) => { this.reservations = r; this.now = Date.now(); }, error: () => {} });
  }

  changeDate(days: number): void {
    const d = new Date(`${this.date}T12:00:00`);
    d.setDate(d.getDate() + days);
    this.date = localDate(d);
    this.loadReservations();
  }
  setDate(value: string): void {
    if (!value) return;
    this.date = value;
    this.loadReservations();
  }
  today(): void {
    this.setDate(localDate(new Date()));
  }

  // ─── Plano ───

  get zones(): string[] {
    return [...new Set(this.tables.map((t) => t.zone))].sort((a, b) => a.localeCompare(b, 'es'));
  }
  get zoneTables(): DiningTable[] {
    return this.tables.filter((t) => t.zone === this.zone);
  }

  live(t: DiningTable): TableLive {
    // Otro día: el estado no aplica; se muestran sus reservas
    if (!this.isToday) {
      const upcoming = this.reservations.filter((r) => r.tableIds.includes(t.id) && ['PENDING', 'CONFIRMED', 'SEATED'].includes(r.status));
      return { state: upcoming.length ? 'soon' : 'free', current: upcoming[0] || null, upcoming };
    }
    return tableLive(t.id, this.reservations, this.now, this.settings?.toleranceMinutes ?? 15);
  }

  pos(t: DiningTable): { left: string; top: string } {
    const p = this.moved.get(t.id) || t;
    return { left: `${p.posX}%`, top: `${p.posY}%` };
  }

  tableName(id: string): string {
    return this.tables.find((t) => t.id === id)?.name || 'Mesa';
  }
  tablesText(r: Reservation): string {
    return r.tableIds.map((id) => this.tableName(id)).join(' + ');
  }

  get selectedTable(): DiningTable | null {
    return this.tables.find((t) => t.id === this.selectedTableId) || null;
  }

  /** Reservas del día de la mesa elegida (todas, para ver también las terminadas). */
  get selectedReservations(): Reservation[] {
    const id = this.selectedTableId;
    return id ? this.reservations.filter((r) => r.tableIds.includes(id)) : [];
  }

  get dayList(): Reservation[] {
    return [...this.reservations].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }

  get counts() {
    const live = this.tables.map((t) => this.live(t).state);
    return {
      free: live.filter((s) => s === 'free').length,
      seated: live.filter((s) => s === 'seated' || s === 'overdue').length,
      reservations: this.reservations.filter((r) => r.status !== 'CANCELLED').length,
      people: this.reservations.filter((r) => ['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED'].includes(r.status)).reduce((n, r) => n + r.partySize, 0),
    };
  }

  selectTable(t: DiningTable): void {
    if (this.editing) {
      if (this.isAdmin && !this.dragged) this.openTableForm(t);
      this.dragged = false;
      return;
    }
    this.selectedTableId = this.selectedTableId === t.id ? null : t.id;
  }

  // ─── Editar el plano (admin) ───

  startEditing(): void {
    this.editing = true;
    this.selectedTableId = null;
    this.moved.clear();
  }

  cancelEditing(): void {
    this.editing = false;
    this.moved.clear();
  }

  dragStart(e: PointerEvent, t: DiningTable): void {
    if (!this.editing || !this.canvas) return;
    e.preventDefault();
    this.dragged = false;
    this.drag = { id: t.id, rect: this.canvas.nativeElement.getBoundingClientRect(), x: e.clientX, y: e.clientY };
    document.addEventListener('pointermove', this.onMove);
    document.addEventListener('pointerup', this.onUp);
  }

  private dragMove(e: PointerEvent): void {
    if (!this.drag) return;
    const { rect, id, x, y } = this.drag;
    if (!this.dragged && Math.hypot(e.clientX - x, e.clientY - y) < 4) return;
    this.dragged = true;
    const clamp = (n: number) => Math.min(96, Math.max(4, Math.round(n * 10) / 10));
    this.moved.set(id, {
      posX: clamp(((e.clientX - rect.left) / rect.width) * 100),
      posY: clamp(((e.clientY - rect.top) / rect.height) * 100),
    });
  }

  private dragEnd(): void {
    this.drag = null;
    document.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerup', this.onUp);
  }

  saveLayout(): void {
    if (!this.moved.size) { this.editing = false; return; }
    this.saving = true;
    const tables = [...this.moved.entries()].map(([id, p]) => ({ id, ...p }));
    this.dining.saveLayout(tables).subscribe({
      next: (list) => {
        this.saving = false;
        this.tables = list;
        this.moved.clear();
        this.editing = false;
        this.toast('Plano guardado');
      },
      error: (err) => { this.saving = false; this.fail(err); },
    });
  }

  openTableForm(t?: DiningTable): void {
    this.tableForm = t
      ? { id: t.id, name: t.name, zone: t.zone, seats: t.seats, shape: t.shape, joinable: t.joinable }
      : { id: null, name: `Mesa ${this.tables.length + 1}`, zone: this.zone || 'Salón', seats: 4, shape: 'square', joinable: false };
  }

  saveTable(): void {
    const f = this.tableForm;
    if (!f) return;
    this.saving = true;
    const body: Partial<DiningTable> = { name: f.name, zone: f.zone, seats: Number(f.seats), shape: f.shape, joinable: f.joinable };
    // Mesa nueva: aparece en un hueco del centro de su zona
    if (!f.id) Object.assign(body, { posX: 20 + ((this.zoneTables.length * 17) % 60), posY: 25 + Math.floor(this.zoneTables.length / 4) * 22 % 60 });
    const req = f.id ? this.dining.updateTable(f.id, body) : this.dining.createTable(body);
    req.subscribe({
      next: (t) => {
        this.saving = false;
        this.tableForm = null;
        this.tables = f.id ? this.tables.map((x) => (x.id === t.id ? t : x)) : [...this.tables, t];
        this.zone = t.zone;
        this.toast(f.id ? 'Mesa actualizada' : 'Mesa agregada');
      },
      error: (err) => { this.saving = false; this.fail(err); },
    });
  }

  removeTable(): void {
    const f = this.tableForm;
    if (!f?.id) return;
    Swal.fire({ title: `¿Quitar ${f.name}?`, text: 'Sus reservas pasadas se conservan.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Quitar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc3545' })
      .then((r) => {
        if (!r.isConfirmed) return;
        this.dining.removeTable(f.id!).subscribe({
          next: () => {
            this.tables = this.tables.filter((t) => t.id !== f.id);
            this.tableForm = null;
            if (!this.zones.includes(this.zone)) this.zone = this.zones[0] || '';
            this.toast('Mesa quitada');
          },
          error: (err) => this.fail(err),
        });
      });
  }

  // ─── Reservas ───

  newReservation(opts: { tableId?: string; time?: string; walkIn?: boolean } = {}): void {
    const s = this.settings;
    const table = opts.tableId ? this.tables.find((t) => t.id === opts.tableId) : null;
    this.resForm = {
      id: null,
      walkIn: !!opts.walkIn,
      partySize: table ? Math.min(table.seats, 2) || 2 : 2,
      date: this.date,
      time: opts.time || '',
      durationMinutes: s?.durationMinutes || 90,
      tableIds: table ? [table.id] : [],
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      notes: '',
    };
    this.slots = [];
    if (!opts.walkIn) this.loadSlots();
  }

  editReservation(r: Reservation): void {
    this.resForm = {
      id: r.id,
      walkIn: false,
      partySize: r.partySize,
      date: localDate(new Date(r.startAt)),
      time: hhmm(r.startAt),
      durationMinutes: Math.round((new Date(r.endAt).getTime() - new Date(r.startAt).getTime()) / 60000),
      tableIds: [...r.tableIds],
      customerName: r.customerName,
      customerPhone: r.customerPhone || '',
      customerEmail: r.customerEmail || '',
      notes: r.notes || '',
    };
    this.slots = [];
  }

  loadSlots(): void {
    const f = this.resForm;
    if (!f || f.walkIn || !f.date || !(f.partySize >= 1)) return;
    this.loadingSlots = true;
    this.dining.availability(f.date, f.partySize).subscribe({
      next: (res) => { this.loadingSlots = false; this.slots = res.slots || []; },
      error: () => { this.loadingSlots = false; this.slots = []; },
    });
  }

  pickSlot(s: DiningSlot): void {
    const f = this.resForm;
    if (!f || !s.available) return;
    f.time = hhmm(s.start);
    if (!f.tableIds.length && s.tableId) f.tableIds = [s.tableId];
  }

  toggleTable(id: string): void {
    const f = this.resForm;
    if (!f) return;
    f.tableIds = f.tableIds.includes(id) ? f.tableIds.filter((x) => x !== id) : [...f.tableIds, id];
  }

  seatsOf(ids: string[]): number {
    return ids.reduce((n, id) => n + (this.tables.find((t) => t.id === id)?.seats || 0), 0);
  }

  saveReservation(): void {
    const f = this.resForm;
    if (!f) return;
    this.saving = true;
    const body = {
      tableIds: f.tableIds,
      partySize: Number(f.partySize),
      durationMinutes: Number(f.durationMinutes),
      customerName: f.customerName,
      customerPhone: f.customerPhone || null,
      customerEmail: f.customerEmail || null,
      notes: f.notes || null,
      ...(f.walkIn ? { walkIn: true } : { date: f.date, time: f.time }),
    };
    const req = f.id ? this.dining.updateReservation(f.id, body) : this.dining.createReservation(body);
    req.subscribe({
      next: (r) => {
        this.saving = false;
        this.resForm = null;
        this.toast(f.id ? 'Reserva actualizada' : f.walkIn ? `${this.tablesText(r)}: ocupada` : `Reserva ${r.code} creada`);
        if (!f.walkIn && localDate(new Date(r.startAt)) !== this.date) this.date = localDate(new Date(r.startAt));
        this.loadReservations();
      },
      error: (err) => { this.saving = false; this.fail(err); },
    });
  }

  setStatus(r: Reservation, status: ReservationStatus): void {
    const done = (msg: string) => (res: Reservation) => {
      this.reservations = this.reservations.map((x) => (x.id === res.id ? res : x));
      this.toast(msg);
    };
    if (status === 'CANCELLED') {
      Swal.fire({ title: `Cancelar ${r.code}`, input: 'text', inputLabel: 'Motivo (opcional)', showCancelButton: true, confirmButtonText: 'Cancelar reserva', cancelButtonText: 'Volver', confirmButtonColor: '#dc3545' })
        .then((x) => { if (x.isConfirmed) this.dining.setStatus(r.id, status, x.value || undefined).subscribe({ next: done('Reserva cancelada'), error: (e) => this.fail(e) }); });
      return;
    }
    if (status === 'NO_SHOW') {
      Swal.fire({ title: `¿${r.customerName} no llegó?`, text: 'La mesa queda libre.', icon: 'question', showCancelButton: true, confirmButtonText: 'No llegó', cancelButtonText: 'Volver' })
        .then((x) => { if (x.isConfirmed) this.dining.setStatus(r.id, status).subscribe({ next: done('Mesa liberada'), error: (e) => this.fail(e) }); });
      return;
    }
    const msg: Record<string, string> = { CONFIRMED: 'Reserva confirmada', SEATED: 'Cliente en la mesa', COMPLETED: 'Mesa liberada' };
    this.dining.setStatus(r.id, status).subscribe({ next: done(msg[status] || 'Listo'), error: (e) => this.fail(e) });
  }

  canNoShow(r: Reservation): boolean {
    return (r.status === 'PENDING' || r.status === 'CONFIRMED') && new Date(r.startAt).getTime() <= this.now;
  }
  isOpen(r: Reservation): boolean {
    return r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'SEATED';
  }

  // ─── Agenda ───

  get range() {
    return agendaRange(this.reservations, this.date);
  }
  get hours(): number[] {
    const { startHour, endHour } = this.range;
    return Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  }
  block(r: Reservation) {
    const { startHour, endHour } = this.range;
    return agendaBlock(r, this.date, startHour, endHour);
  }
  rowReservations(t: DiningTable): Reservation[] {
    return this.reservations.filter((r) => r.tableIds.includes(t.id) && r.status !== 'CANCELLED');
  }
  /** Línea de "ahora" en la agenda (%), si es hoy. */
  get nowLine(): number | null {
    if (!this.isToday) return null;
    const { startHour, endHour } = this.range;
    const d = new Date(this.now);
    const h = d.getHours() + d.getMinutes() / 60;
    return h < startHour || h > endHour ? null : ((h - startHour) / (endHour - startHour)) * 100;
  }
  /** Clic en un espacio vacío de la fila: reservar esa mesa a esa hora. */
  agendaClick(e: MouseEvent, t: DiningTable): void {
    if (!this.canOperate || (e.target as HTMLElement).closest('.ag-block')) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const { startHour, endHour } = this.range;
    const hour = startHour + ((e.clientX - rect.left) / rect.width) * (endHour - startHour);
    const slot = this.settings?.slotMinutes || 30;
    const minutes = Math.floor((hour * 60) / slot) * slot;
    const time = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    this.newReservation({ tableId: t.id, time });
  }

  // ─── Configuración (admin) ───

  openSettings(): void {
    if (this.settings) this.settingsForm = { ...this.settings };
  }

  saveSettings(): void {
    const s = this.settingsForm;
    if (!s) return;
    this.saving = true;
    this.dining.saveSettings(s).subscribe({
      next: (res) => { this.saving = false; this.settings = res; this.settingsForm = null; this.toast('Configuración guardada'); },
      error: (err) => { this.saving = false; this.fail(err); },
    });
  }

  // ─── Apoyo ───

  money(n: number): string {
    return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  }

  dayTitle(): string {
    const d = new Date(`${this.date}T12:00:00`);
    const txt = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    return this.isToday ? `Hoy, ${txt}` : txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  private toast(title: string): void {
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title, timer: 1800, showConfirmButton: false });
  }

  private fail(err: any): void {
    const msg = err?.error?.message;
    Swal.fire('No se pudo completar', Array.isArray(msg) ? msg.join('. ') : msg || 'Intenta de nuevo.', 'error');
  }
}
