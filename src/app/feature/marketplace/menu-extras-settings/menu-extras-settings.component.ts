import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import {
  EMPTY_MENU_EXTRAS, MENU_EXTRAS_LIMITS, MENU_EXTRA_TEMPLATES, MenuExtraBlock, MenuExtraItem, MenuExtras, extraThumb, menuExtrasFrom,
} from '../menu-board/menu-extras';

/** Formatos y peso de las fotos (iguales al backend: menu-extras.ts). */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Información de la carta del MarketPlace (modo administrador): bloques como
 * "Proteínas" o "Salsas" (no son productos, solo se muestran), subtítulo de la
 * carta, zonas de domicilio y "solo domicilios" (cocina oculta).
 */
@Component({
  selector: 'app-menu-extras-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-extras-settings.component.html',
  styleUrls: ['./menu-extras-settings.component.css'],
})
export class MenuExtrasSettingsComponent implements OnChanges {
  @Input() tenantId = '';

  extras: MenuExtras | null = null;
  open = false;
  saving = false;
  /** Renglón cuya foto se está subiendo ("bloque:renglón"). */
  uploading = '';
  zoneDraft = '';
  limits = MENU_EXTRAS_LIMITS;
  templates = MENU_EXTRA_TEMPLATES;
  thumb = extraThumb;

  private base = `${environment.apiUrl}/marketplace-config`;

  constructor(private http: HttpClient) {}

  ngOnChanges(): void {
    if (!this.tenantId) return;
    this.http.get<MenuExtras>(`${this.base}/${this.tenantId}/menu-extras`).subscribe({
      next: (e) => (this.extras = menuExtrasFrom(e)),
      error: () => (this.extras = structuredClone(EMPTY_MENU_EXTRAS)),
    });
  }

  get summary(): string {
    const e = this.extras;
    if (!e) return 'Cargando…';
    const parts = [
      e.blocks.length ? `${e.blocks.length} bloque(s)` : '',
      e.deliveryZones.length ? `${e.deliveryZones.length} zona(s)` : '',
      e.deliveryOnly ? 'solo domicilios' : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Sin configurar';
  }

  // ── Zonas de domicilio ──

  /** Agrega lo escrito; acepta varias separadas por coma ("Turbaco, Bonanza"). */
  addZones(): void {
    if (!this.extras) return;
    for (const raw of this.zoneDraft.split(',')) {
      const zone = raw.replace(/\s+/g, ' ').trim().slice(0, this.limits.zone);
      if (!zone || this.extras.deliveryZones.length >= this.limits.zones) continue;
      if (this.extras.deliveryZones.some((z) => z.toLowerCase() === zone.toLowerCase())) continue;
      this.extras.deliveryZones.push(zone);
    }
    this.zoneDraft = '';
  }

  onZoneKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addZones();
    }
  }

  removeZone(i: number): void {
    this.extras?.deliveryZones.splice(i, 1);
  }

  // ── Bloques ──

  addBlock(template?: MenuExtraBlock): void {
    if (!this.extras || this.extras.blocks.length >= this.limits.blocks) return;
    const block: MenuExtraBlock = template
      ? structuredClone(template)
      : { title: '', items: [{ name: '', note: '', imageUrl: null, imagePublicId: null }] };
    this.extras.blocks.push(block);
  }

  removeBlock(i: number): void {
    this.extras?.blocks.splice(i, 1);
  }

  moveBlock(i: number, delta: number): void {
    const blocks = this.extras?.blocks;
    const j = i + delta;
    if (!blocks || j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }

  addItem(block: MenuExtraBlock): void {
    if (block.items.length >= this.limits.items) return;
    block.items.push({ name: '', note: '', imageUrl: null, imagePublicId: null });
  }

  removeItem(block: MenuExtraBlock, i: number): void {
    block.items.splice(i, 1);
  }

  /** Sube la foto del renglón; queda en la carta al guardar. */
  uploadImage(item: MenuExtraItem, key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      Swal.fire({ icon: 'warning', title: 'Formato no admitido', text: 'La imagen debe ser PNG, JPG o WebP.' });
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      Swal.fire({ icon: 'warning', title: 'Imagen muy pesada', text: 'La imagen no puede pesar más de 3 MB.' });
      return;
    }
    const form = new FormData();
    form.append('image', file);
    this.uploading = key;
    this.http.post<{ imageUrl: string; imagePublicId: string }>(`${this.base}/${this.tenantId}/menu-extras/image`, form).subscribe({
      next: (r) => {
        item.imageUrl = r.imageUrl;
        item.imagePublicId = r.imagePublicId;
        this.uploading = '';
      },
      error: (err) => {
        this.uploading = '';
        Swal.fire({ icon: 'error', title: 'No se pudo subir la foto', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }

  removeImage(item: MenuExtraItem): void {
    item.imageUrl = null;
    item.imagePublicId = null;
  }

  save(): void {
    if (!this.extras) return;
    this.addZones();
    const untitled = this.extras.blocks.findIndex((b) => !b.title.trim() && b.items.some((i) => i.name.trim()));
    if (untitled >= 0) {
      Swal.fire({ icon: 'warning', title: 'Falta un título', text: `Escribe el título del bloque ${untitled + 1} (por ejemplo «Proteínas»).` });
      return;
    }
    this.saving = true;
    this.http.patch<MenuExtras>(`${this.base}/${this.tenantId}/menu-extras`, this.extras).subscribe({
      next: (saved) => {
        this.extras = menuExtrasFrom(saved);
        this.saving = false;
        Swal.fire({ icon: 'success', title: 'Información de la carta guardada', text: 'Recarga la tienda pública para verla.', timer: 1800, showConfirmButton: false });
      },
      error: (err) => {
        this.saving = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }

  trackByIndex(i: number): number {
    return i;
  }
}
