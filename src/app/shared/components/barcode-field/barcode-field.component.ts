import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarcodesService, normalizeBarcode } from '../../services/barcodes.service';

/**
 * Códigos de barras de un ítem: se leen con el lector (o se escriben) y se
 * agregan con Enter. Un ítem puede tener varios. Avisa al instante si el
 * código ya es de otro ítem. Quien lo usa guarda la lista con
 * BarcodesService.set después de guardar el ítem.
 */
@Component({
  selector: 'app-barcode-field',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bc-field">
      <div class="bc-input">
        <svg class="bc-ico" aria-hidden="true"><use href="./assets/icons/bootstrap-icons.svg#upc-scan" /></svg>
        <input #box type="text" class="form-control" autocomplete="off" inputmode="numeric" [id]="inputId"
          placeholder="Lee el código con el lector o escríbelo y pulsa Enter"
          [readOnly]="checking" (keydown.enter)="$event.preventDefault(); add(box)">
      </div>
      <small class="bc-error" *ngIf="error">{{ error }}</small>
      <ul class="bc-chips" *ngIf="codes.length">
        <li *ngFor="let c of codes">
          <span>{{ c }}</span>
          <button type="button" (click)="remove(c)" [attr.aria-label]="'Quitar el código ' + c">
            <svg aria-hidden="true"><use href="./assets/icons/bootstrap-icons.svg#x" /></svg>
          </button>
        </li>
      </ul>
      <small class="text-muted d-block" *ngIf="!codes.length && !error">Opcional. Puedes agregar varios, por ejemplo si el mismo artículo llega con códigos distintos.</small>
    </div>
  `,
  styles: [`
    .bc-input { position: relative; }
    .bc-ico { position: absolute; z-index: 1; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; fill: #64748b; pointer-events: none; }
    .bc-field .bc-input input.form-control { padding-left: 40px; font-variant-numeric: tabular-nums; }
    .bc-error { display: block; color: #dc2626; margin-top: 4px; }
    .bc-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; padding: 0; }
    .bc-chips li { display: inline-flex; align-items: center; gap: 4px; padding: 3px 4px 3px 10px; border-radius: 999px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 13px; font-variant-numeric: tabular-nums; }
    .bc-chips button { display: inline-flex; border: 0; background: transparent; padding: 2px; border-radius: 50%; cursor: pointer; color: inherit; }
    .bc-chips button:hover { background: #fed7aa; }
    .bc-chips svg { width: 14px; height: 14px; fill: currentColor; }
  `],
})
export class BarcodeFieldComponent {
  @Input() codes: string[] = [];
  @Output() codesChange = new EventEmitter<string[]>();
  /** Ítem que se edita (sus propios códigos no cuentan como repetidos). */
  @Input() itemId: string | null = null;
  @Input() inputId = 'barcodes';

  checking = false;
  error = '';

  constructor(private barcodes: BarcodesService) {}

  add(box: HTMLInputElement): void {
    if (this.checking) return;
    const code = normalizeBarcode(box.value);
    this.error = '';
    if (!box.value.trim()) return;
    if (!code) {
      this.error = 'Ese no parece un código de barras (de 3 a 64 caracteres, sin tildes ni eñes).';
      return;
    }
    if (this.codes.includes(code)) {
      box.value = '';
      return;
    }
    this.checking = true;
    this.barcodes.lookup(code).subscribe({
      next: (owner) => {
        this.checking = false;
        if (owner.itemId !== this.itemId) {
          this.error = `El código ${code} ya es de «${owner.itemName}».`;
          return;
        }
        this.push(code, box);
      },
      error: (err) => {
        this.checking = false;
        if (err?.status === 404) this.push(code, box);
        else this.error = 'No se pudo revisar el código. Intenta de nuevo.';
      },
    });
  }

  remove(code: string): void {
    this.codes = this.codes.filter((c) => c !== code);
    this.codesChange.emit(this.codes);
  }

  private push(code: string, box: HTMLInputElement): void {
    this.codes = [...this.codes, code];
    this.codesChange.emit(this.codes);
    box.value = '';
    setTimeout(() => box.focus());
  }
}
