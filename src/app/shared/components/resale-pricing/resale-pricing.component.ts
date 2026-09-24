import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

/**
 * Configuración de reventa de un material o material compuesto (tiendas de
 * barrio que compran para redistribuir). El stock y el costo del material
 * están en su unidad de medida (g, ml…); la reventa se hace por PRESENTACIÓN
 * (ej. "Bolsa 1 kg" = 1000 g).
 */
export interface ResaleConfig {
  blnForResale: boolean;
  strSalePresentation: string;
  fltPresentationQuantity: number;
  fltSalePrice: number;
  ingPlannedMonthlyUnits: number;
  /** Solo aplica si blnForResale: visible en el MarketPlace público. */
  blnMarketplaceVisible: boolean;
}

export function resaleConfigFrom(material?: any): ResaleConfig {
  return {
    blnForResale: !!material?.blnForResale,
    strSalePresentation: material?.strSalePresentation || '',
    fltPresentationQuantity: Number(material?.fltPresentationQuantity) || 0,
    fltSalePrice: Number(material?.fltSalePrice) || 0,
    ingPlannedMonthlyUnits: Number(material?.ingPlannedMonthlyUnits) || 0,
    blnMarketplaceVisible: material ? material.blnMarketplaceVisible !== false : true,
  };
}

/** Campos que se envían al backend (materials / materials-t). */
export function resaleConfigPayload(config: ResaleConfig) {
  return {
    blnForResale: !!config.blnForResale,
    strSalePresentation: (config.strSalePresentation || '').trim() || undefined,
    fltPresentationQuantity: Number(config.fltPresentationQuantity) || 0,
    fltSalePrice: Number(config.fltSalePrice) || 0,
    ingPlannedMonthlyUnits: Math.max(0, Math.floor(Number(config.ingPlannedMonthlyUnits) || 0)),
    blnMarketplaceVisible: config.blnMarketplaceVisible !== false,
  };
}

/**
 * Sección "Reventa" de los formularios de material: activa la reventa, define
 * la presentación y calcula el precio sugerido con los mismos conceptos del
 * recálculo de precio de productos, salvo mano de obra directa (no hay
 * transformación):
 *   costo de compra de la presentación + costo indirecto prorrateado + margen.
 */
@Component({
  selector: 'app-resale-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resale-pricing.component.html',
  styleUrls: ['./resale-pricing.component.css'],
})
export class ResalePricingComponent implements OnInit {
  @Input({ required: true }) config!: ResaleConfig;
  /** Costo de compra por unidad de medida (fltPrice del material). */
  @Input() unitCost = 0;
  @Input() unitMeasure = '';
  /** Stock actual en unidad de medida (para mostrar cuántas presentaciones rinde). */
  @Input() currentStock: number | null = null;

  overheadTotal = 0;
  marginPercent = 0;
  loadingPricing = false;
  pricingError = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadPricingData();
  }

  /** Mismos parámetros del período activo que usa el precio de productos. */
  loadPricingData(): void {
    this.loadingPricing = true;
    this.pricingError = false;
    Promise.all([
      this.http.get<any>(`${environment.apiUrl}/business-params/overhead`).toPromise(),
      this.http.get<any>(`${environment.apiUrl}/business-params`).toPromise(),
    ]).then(([overhead, params]) => {
      this.overheadTotal = overhead?.total || 0;
      this.marginPercent = params?.PORCENTAJE_GANANCIA || 0;
      this.loadingPricing = false;
    }).catch(() => {
      this.loadingPricing = false;
      this.pricingError = true;
    });
  }

  get presentationCost(): number {
    return (Number(this.unitCost) || 0) * (Number(this.config.fltPresentationQuantity) || 0);
  }

  /** Costo indirecto mensual prorrateado entre las presentaciones planeadas al mes. */
  get indirectCostPerUnit(): number {
    const planned = Number(this.config.ingPlannedMonthlyUnits) || 0;
    if (!this.overheadTotal || planned <= 0) return 0;
    return this.overheadTotal / planned;
  }

  get totalUnitCost(): number {
    return this.presentationCost + this.indirectCostPerUnit;
  }

  get suggestedPrice(): number {
    return this.totalUnitCost * (1 + (this.marginPercent || 0) / 100);
  }

  get priceBelowMinimum(): boolean {
    const price = Number(this.config.fltSalePrice) || 0;
    return this.suggestedPrice > 0 && price < this.suggestedPrice;
  }

  get presentationsInStock(): number | null {
    const qty = Number(this.config.fltPresentationQuantity) || 0;
    if (this.currentStock === null || qty <= 0) return null;
    return Math.floor((Number(this.currentStock) || 0) / qty);
  }

  useSuggestedPrice(): void {
    this.config.fltSalePrice = Math.round(this.suggestedPrice * 100) / 100;
  }

  /** Mensaje de error a mostrar antes de guardar, o null si es válido. */
  validationError(): string | null {
    if (!this.config.blnForResale) return null;
    if (!(this.config.strSalePresentation || '').trim()) return 'Indica el nombre de la presentación de venta (ej. "Bolsa 1 kg").';
    if (!(Number(this.config.fltPresentationQuantity) > 0)) return `Indica cuánto contiene cada presentación (en ${this.unitMeasure || 'la unidad de medida'}).`;
    if (!(Number(this.config.fltSalePrice) > 0)) return 'Indica el precio de venta de la presentación.';
    if (this.priceBelowMinimum) {
      return `El precio de venta no puede ser menor al mínimo calculado (${this.formatCurrency(this.suggestedPrice)}), que cubre costo de compra, costo indirecto y margen de ganancia.`;
    }
    return null;
  }

  formatCurrency(value: number): string {
    return '$' + new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  }
}
