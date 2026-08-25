import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehousesService, Warehouse, WarehouseLocation, StockTransfer, PhysicalCount } from '../../shared/services/warehouses.service';
import { MaterialService } from '../../shared/services/material.service';
import { DocumentsService } from '../../shared/services/documents.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css']
})
export class InventoryComponent implements OnInit {
  activeTab: 'warehouses' | 'transfers' | 'counts' = 'warehouses';

  // Warehouses
  warehouses: Warehouse[] = [];
  showCreateWarehouse = false;
  newWarehouse = { name: '', address: '', phone: '' };

  // Locations
  selectedWarehouse: Warehouse | null = null;
  showCreateLocation = false;
  newLocation = { name: '', aisle: '', shelf: '', bin: '', capacity: '' };

  // Zones (grupos de posiciones)
  showCreateZone = false;
  newZone = { zone: '', zoneCode: '', shelf: '', aisle: '', description: '', capacity: '', positionsText: '' };

  // Transfers
  transfers: StockTransfer[] = [];
  showTransferModal = false;
  transferData = { materialId: '', fromWarehouseId: '', toWarehouseId: '', quantity: 0, notes: '' };
  materials: any[] = [];

  // Physical Counts
  counts: PhysicalCount[] = [];
  selectedCount: PhysicalCount | null = null;

  loading = false;

  constructor(
    private warehousesService: WarehousesService,
    private materialService: MaterialService,
    private documentsService: DocumentsService
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadTransfers();
    this.loadCounts();
    this.loadMaterials();
  }

  // ═══════ WAREHOUSES ═══════
  loadWarehouses(): void {
    this.warehousesService.getWarehouses().subscribe({
      next: (data) => {
        this.warehouses = data;
        // Re-seleccionar el almacén si había uno seleccionado
        if (this.selectedWarehouse) {
          this.selectedWarehouse = this.warehouses.find(w => w.id === this.selectedWarehouse!.id) || null;
        }
      },
      error: () => { this.warehouses = []; }
    });
  }

  createWarehouse(): void {
    if (!this.newWarehouse.name) return;
    this.warehousesService.createWarehouse(this.newWarehouse).subscribe({
      next: () => {
        this.loadWarehouses();
        this.showCreateWarehouse = false;
        this.newWarehouse = { name: '', address: '', phone: '' };
        Swal.fire({ icon: 'success', title: 'Almacén creado', timer: 1500, showConfirmButton: false });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo crear', 'error'); }
    });
  }

  deleteWarehouse(wh: Warehouse): void {
    Swal.fire({ title: '¿Desactivar almacén?', text: wh.name, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí' }).then(r => {
      if (r.isConfirmed) {
        this.warehousesService.deleteWarehouse(wh.id).subscribe({ next: () => this.loadWarehouses() });
      }
    });
  }

  selectWarehouse(wh: Warehouse): void {
    this.selectedWarehouse = wh;
  }

  openLocationForm(): void {
    this.showCreateZone = false;
    this.showCreateLocation = true;
  }

  openZoneForm(): void {
    this.showCreateLocation = false;
    this.showCreateZone = true;
  }

  createLocation(): void {
    if (!this.newLocation.name || !this.selectedWarehouse) return;
    this.warehousesService.createLocation({ ...this.newLocation, warehouseId: this.selectedWarehouse.id }).subscribe({
      next: () => {
        this.loadWarehouses();
        this.showCreateLocation = false;
        this.newLocation = { name: '', aisle: '', shelf: '', bin: '', capacity: '' };
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo crear', 'error'); }
    });
  }

  /** Crea una zona que agrupa varias posiciones de un estante. */
  createZone(): void {
    if (!this.selectedWarehouse) return;
    const zone = this.newZone.zone.trim();
    if (!zone) { Swal.fire('Atención', 'Indica el nombre de la zona.', 'warning'); return; }

    const positions = this.newZone.positionsText
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (positions.length === 0) {
      Swal.fire('Atención', 'Indica al menos una posición (Ej: 10,11,12).', 'warning');
      return;
    }

    this.warehousesService.createLocationsBatch({
      warehouseId: this.selectedWarehouse.id,
      zone,
      zoneCode: this.newZone.zoneCode || null,
      shelf: this.newZone.shelf || null,
      aisle: this.newZone.aisle || null,
      description: this.newZone.description || null,
      capacity: this.newZone.capacity || null,
      positions,
    }).subscribe({
      next: (res) => {
        this.loadWarehouses();
        this.showCreateZone = false;
        this.newZone = { zone: '', zoneCode: '', shelf: '', aisle: '', description: '', capacity: '', positionsText: '' };
        Swal.fire({ icon: 'success', title: res.message || 'Zona creada', timer: 1800, showConfirmButton: false });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo crear la zona', 'error'); }
    });
  }

  /** Ubicaciones del almacén seleccionado agrupadas por zona (las sin zona van al final). */
  get groupedLocations(): { zone: string | null; description: string | null; items: WarehouseLocation[] }[] {
    const locs = this.selectedWarehouse?.locations || [];
    const groups = new Map<string, { zone: string | null; description: string | null; items: WarehouseLocation[] }>();
    const noZoneKey = '__none__';

    for (const loc of locs) {
      const key = loc.zone ? `z:${loc.zone}` : noZoneKey;
      if (!groups.has(key)) {
        groups.set(key, { zone: loc.zone || null, description: loc.description || null, items: [] });
      }
      groups.get(key)!.items.push(loc);
    }

    // Zonas primero (orden alfabético), ubicaciones sueltas al final
    const zoned = [...groups.values()].filter(g => g.zone).sort((a, b) => (a.zone || '').localeCompare(b.zone || ''));
    const loose = [...groups.values()].filter(g => !g.zone);
    return [...zoned, ...loose];
  }

  /** Elimina todas las posiciones de una zona. */
  deleteZone(grp: { zone: string | null; items: WarehouseLocation[] }): void {
    if (!grp.zone) return;
    Swal.fire({
      title: `¿Eliminar la zona "${grp.zone}"?`,
      text: `Se eliminarán sus ${grp.items.length} posiciones. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar zona',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626'
    }).then(r => {
      if (!r.isConfirmed) return;
      let pending = grp.items.length;
      let failed = 0;
      grp.items.forEach(loc => {
        this.warehousesService.deleteLocation(loc.id).subscribe({
          next: () => { if (--pending === 0) this.finishZoneDeletion(failed); },
          error: () => { failed++; if (--pending === 0) this.finishZoneDeletion(failed); }
        });
      });
    });
  }

  private finishZoneDeletion(failed: number): void {
    this.loadWarehouses();
    if (failed > 0) {
      Swal.fire('Atención', `No se pudieron eliminar ${failed} posición(es).`, 'warning');
    }
  }

  deleteLocation(locationId: string): void {
    Swal.fire({
      title: '¿Eliminar ubicación?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626'
    }).then(r => {
      if (r.isConfirmed) {
        this.warehousesService.deleteLocation(locationId).subscribe({
          next: () => { this.loadWarehouses(); },
          error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo eliminar', 'error'); }
        });
      }
    });
  }

  // ═══════ TRANSFERS ═══════
  loadTransfers(): void {
    this.warehousesService.getTransfers().subscribe({
      next: (data) => { this.transfers = data; },
      error: () => { this.transfers = []; }
    });
  }

  loadMaterials(): void {
    this.materialService.getMaterials(undefined, 1, 1000).subscribe({
      next: (res) => { this.materials = (res.data || []).map((m: any) => ({ id: m.id, name: m.name, code: m.strCode })); },
      error: () => { this.materials = []; }
    });
  }

  submitTransfer(): void {
    if (!this.transferData.materialId || !this.transferData.fromWarehouseId || !this.transferData.toWarehouseId || this.transferData.quantity <= 0) return;
    const fromWh = this.warehouses.find(w => w.id === this.transferData.fromWarehouseId);
    const toWh = this.warehouses.find(w => w.id === this.transferData.toWarehouseId);
    this.warehousesService.createTransfer({
      ...this.transferData,
      fromWarehouseName: fromWh?.name || '',
      toWarehouseName: toWh?.name || ''
    }).subscribe({
      next: () => {
        this.showTransferModal = false;
        this.loadTransfers();
        Swal.fire({ icon: 'success', title: 'Transferencia registrada', timer: 1500, showConfirmButton: false });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo transferir', 'error'); }
    });
  }

  // ═══════ PHYSICAL COUNTS ═══════
  loadCounts(): void {
    this.warehousesService.getPhysicalCounts().subscribe({
      next: (data) => { this.counts = data; },
      error: () => { this.counts = []; }
    });
  }

  startNewCount(): void {
    const performedBy = sessionStorage.getItem('user_displayName') || sessionStorage.getItem('user_name') || 'Admin';
    this.warehousesService.createPhysicalCount({ performedBy }).subscribe({
      next: (count) => {
        this.loadCounts();
        this.selectedCount = count;
        Swal.fire({ icon: 'success', title: 'Conteo iniciado', text: `${count.totalItems} materiales para contar`, timer: 2000, showConfirmButton: false });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo iniciar', 'error'); }
    });
  }

  openCount(count: PhysicalCount): void {
    this.selectedCount = count;
  }

  closeCount(): void {
    this.selectedCount = null;
  }

  updateItemCount(item: any, value: number): void {
    item.physicalStock = value;
    item.difference = value - item.systemStock;
  }

  saveCount(): void {
    if (!this.selectedCount) return;
    this.warehousesService.updatePhysicalCount(this.selectedCount.id, {
      items: this.selectedCount.items,
      status: 'IN_PROGRESS'
    }).subscribe({
      next: (updated) => {
        this.selectedCount = updated;
        this.loadCounts();
        Swal.fire({ icon: 'success', title: 'Conteo guardado', timer: 1500, showConfirmButton: false });
      },
      error: () => { Swal.fire('Error', 'No se pudo guardar', 'error'); }
    });
  }

  applyCount(): void {
    if (!this.selectedCount) return;
    Swal.fire({
      title: '¿Aplicar ajustes?',
      text: 'Esto actualizará el stock de todos los materiales con diferencia. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Aplicar',
      confirmButtonColor: '#dc2626'
    }).then(r => {
      if (r.isConfirmed) {
        this.warehousesService.applyPhysicalCount(this.selectedCount!.id).subscribe({
          next: (res) => {
            this.selectedCount = null;
            this.loadCounts();
            Swal.fire({ icon: 'success', title: 'Ajustes aplicados', text: res.message });
          },
          error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo aplicar', 'error'); }
        });
      }
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { DRAFT: 'Borrador', IN_PROGRESS: 'En Progreso', COMPLETED: 'Completado', APPLIED: 'Aplicado' };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = { DRAFT: '#6b7280', IN_PROGRESS: '#d97706', COMPLETED: '#2563eb', APPLIED: '#16a34a' };
    return colors[status] || '#6b7280';
  }

  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
