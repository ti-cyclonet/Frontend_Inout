import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DineInChoice, DiningPublicInfo, DiningPublicService, PublicSlot, bookingDays, slotLabel, slotTime } from './dining-public.service';

/**
 * Fecha, personas y hora con mesa disponible. Lo usan el pago de la tienda
 * (comer en el local) y la ventana de reservar mesa.
 */
@Component({
  selector: 'app-dine-in-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dip">
      <div class="dip-row">
        <label class="dip-party">Personas
          <span class="dip-stepper">
            <button type="button" (click)="setParty(party - 1)" [disabled]="party <= 1" aria-label="Menos personas">−</button>
            <b>{{ party }}</b>
            <button type="button" (click)="setParty(party + 1)" [disabled]="party >= (info?.maxPartySize || 1)" aria-label="Más personas">+</button>
          </span>
        </label>
      </div>
      <div class="dip-days" role="listbox" aria-label="Día">
        <button type="button" *ngFor="let d of days" [class.on]="d.value === date" (click)="setDate(d.value)">{{ d.label }}</button>
      </div>
      <p class="dip-hint" *ngIf="loading">Buscando mesas…</p>
      <p class="dip-hint" *ngIf="!loading && tooLarge">En línea se reserva para máximo {{ info?.maxPartySize }} personas. Para grupos más grandes, escríbele a la tienda.</p>
      <p class="dip-hint" *ngIf="!loading && !tooLarge && !slots.length">Ese día no atendemos. Elige otro.</p>
      <p class="dip-hint" *ngIf="!loading && slots.length && !hasAvailable">No quedan mesas para {{ party }} ese día. Prueba otro día.</p>
      <div class="dip-slots" *ngIf="!loading && slots.length">
        <button type="button" *ngFor="let s of slots" [disabled]="!s.available" [class.on]="time === slotTime(s.start)" (click)="pick(s)">
          {{ slotLabel(s.start) }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dip { display: flex; flex-direction: column; gap: 0.6rem; }
    .dip-party { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; font-weight: 600; margin: 0; }
    .dip-stepper { display: inline-flex; align-items: center; gap: 0.6rem; }
    .dip-stepper button { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #d1d5db; background: #fff; font-size: 1.2rem; line-height: 1; }
    .dip-stepper b { min-width: 1.5rem; text-align: center; font-size: 1.1rem; }
    .dip-days, .dip-slots { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .dip-days { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 0.2rem; }
    .dip-days button, .dip-slots button { border: 1px solid #d1d5db; background: #fff; border-radius: 10px; padding: 0.35rem 0.7rem; font-size: 0.88rem; white-space: nowrap; }
    .dip-days button.on, .dip-slots button.on { background: var(--mk-sector, #0066cc); border-color: var(--mk-sector, #0066cc); color: #fff; }
    .dip-slots button:disabled { opacity: 0.35; text-decoration: line-through; }
    .dip-hint { margin: 0; font-size: 0.85rem; color: #6b7280; }
  `],
})
export class DineInPickerComponent implements OnInit, OnChanges {
  @Input() tenantId = '';
  @Input() info: DiningPublicInfo | null = null;
  @Output() choiceChange = new EventEmitter<DineInChoice | null>();

  party = 2;
  date = '';
  time = '';
  days: { value: string; label: string }[] = [];
  slots: PublicSlot[] = [];
  loading = false;
  tooLarge = false;

  readonly slotLabel = slotLabel;
  readonly slotTime = slotTime;

  constructor(private dining: DiningPublicService) {}

  ngOnInit(): void {
    this.setup();
  }

  ngOnChanges(): void {
    if (!this.days.length) this.setup();
  }

  get hasAvailable(): boolean {
    return this.slots.some((s) => s.available);
  }

  private setup(): void {
    if (!this.info || !this.tenantId) return;
    this.days = bookingDays(this.info.maxDaysAhead);
    this.party = Math.min(2, this.info.maxPartySize || 2);
    this.setDate(this.days[0]?.value || '');
  }

  setParty(n: number): void {
    this.party = Math.max(1, Math.min(n, this.info?.maxPartySize || 1));
    this.load();
  }

  setDate(d: string): void {
    this.date = d;
    this.load();
  }

  pick(s: PublicSlot): void {
    if (!s.available) return;
    this.time = slotTime(s.start);
    this.choiceChange.emit({ date: this.date, time: this.time, partySize: this.party });
  }

  private load(): void {
    this.time = '';
    this.choiceChange.emit(null);
    if (!this.date) return;
    this.loading = true;
    this.dining.availability(this.tenantId, this.date, this.party).subscribe({
      next: (res) => { this.loading = false; this.slots = res.slots || []; this.tooLarge = !!res.tooLarge; },
      error: () => { this.loading = false; this.slots = []; },
    });
  }
}
