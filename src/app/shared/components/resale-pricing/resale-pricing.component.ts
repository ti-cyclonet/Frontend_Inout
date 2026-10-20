import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { actualMargin, effectiveMargin, inheritedMarginLabel, marginPayload, priceWithMargin } from '../../utils/pricing-margin';
import { InfoTipComponent } from '../info-tip/info-tip.component';

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
  /** Margen propio del material (sobre el costo); null = el de la categoría o el del período. */
  fltMarginPercent: number | null;
  /** Compuestos: se prepara bajo pedido (se puede pedir sin stock). */
  blnMadeToOrder: boolean;
  /** Compuestos: minutos que toma prepararlo. */
  intProductionLeadMinutes: number | null;
}

export function resaleConfigFrom(material?: any): ResaleConfig {
  return {
    blnForResale: !!material?.blnForResale,
    strSalePresentation: material?.strSalePresentation || '',
    fltPresentationQuantity: Number(material?.fltPresentationQuantity) || 0,
    fltSalePrice: Number(material?.fltSalePrice) || 0,
    ingPlannedMonthlyUnits: Number(material?.ingPlannedMonthlyUnits) || 0,
    blnMarketplaceVisible: material ? material.blnMarketplaceVisible !== false : true,
    fltMarginPercent: material?.fltMarginPercent !== null && material?.fltMarginPercent !== undefined && material?.fltMarginPercent !== '' ? Number(material.fltMarginPercent) : null,
    blnMadeToOrder: !!material?.blnMadeToOrder,
    intProductionLeadMinutes: material?.intProductionLeadMinutes ?? null,
  };
}

/**
 * Campos que se envían al backend (materials / materials-t). La fabricación
 * bajo pedido solo existe en los compuestos (madeToOrder: true).
 */
export function resaleConfigPayload(config: ResaleConfig, opts: { madeToOrder?: boolean } = {}) {
  const minutes = config.intProductionLeadMinutes;
  return {
    ...(opts.madeToOrder
      ? {
          blnMadeToOrder: !!config.blnForResale && !!config.blnMadeToOrder,
          intProductionLeadMinutes: minutes === null || minutes === undefined || (minutes as any) === '' ? null : Math.max(0, Math.round(Number(minutes) || 0)),
        }
      : {}),
    blnForResale: !!config.blnForResale,
    strSalePresentation: (config.strSalePresentation || '').trim() || undefined,
    fltPresentationQuantity: Number(config.fltPresentationQuantity) || 0,
    fltSalePrice: Number(config.fltSalePrice) || 0,
    ingPlannedMonthlyUnits: Math.max(0, Math.floor(Number(config.ingPlannedMonthlyUnits) || 0)),
    blnMarketplaceVisible: config.blnMarketplaceVisible !== false,
    fltMarginPercent: config.fltMarginPercent ?? null,
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
  imports: [InfoTipComponent, CommonModule, FormsModule],
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
  /** Categoría del material (su margen se hereda si el material no tiene uno propio). */
  @Input() categoryId: number | string | null = null;
  /** Material compuesto: ofrece "Se fabrica bajo pedido" y su tiempo. */
  @Input() allowMadeToOrder = false;
  categories: any[] = [];
  minMarginPercent = 0;

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
      this.http.get<any[]>(`${environment.apiUrl}/categories`).toPromise().catch(() => []),
    ]).then(([overhead, params, categories]) => {
      this.overheadTotal = overhead?.total || 0;
      this.marginPercent = params?.PORCENTAJE_GANANCIA || 0;
      this.minMarginPercent = Math.max(0, Number(params?.MARGEN_MINIMO) || 0);
      this.categories = Array.isArray(categories) ? categories : [];
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

  /** Margen propio o heredado (los mismos tres niveles que los productos). */
  get marginMode(): 'inherit' | 'custom' {
    return this.config.fltMarginPercent === null || this.config.fltMarginPercent === undefined ? 'inherit' : 'custom';
  }
  set marginMode(mode: 'inherit' | 'custom') {
    this.config.fltMarginPercent = mode === 'custom' ? (this.config.fltMarginPercent ?? this.effective.percent) : null;
  }
  get customMargin(): number | null {
    return this.config.fltMarginPercent;
  }
  set customMargin(v: number | null) {
    this.config.fltMarginPercent = marginPayload('custom', v) ?? 0;
  }
  private get category(): any {
    return this.categories.find((c) => String(c.id) === String(this.categoryId)) || null;
  }
  get effective() {
    return effectiveMargin({ item: this.config.fltMarginPercent, category: this.category?.fltMarginPercent, period: this.marginPercent });
  }
  get inheritedLabel(): string {
    return inheritedMarginLabel(this.category?.name || null, this.category?.fltMarginPercent, this.marginPercent);
  }
  get suggestedPrice(): number {
    return priceWithMargin(this.totalUnitCost, this.effective.percent);
  }
  get minimumPrice(): number {
    return priceWithMargin(this.totalUnitCost, this.minMarginPercent);
  }
  get priceBelowMinimum(): boolean {
    const price = Number(this.config.fltSalePrice) || 0;
    return this.minimumPrice > 0 && price + 0.005 < this.minimumPrice;
  }
  get priceBelowTarget(): boolean {
    const price = Number(this.config.fltSalePrice) || 0;
    return this.suggestedPrice > 0 && price + 0.5 < this.suggestedPrice;
  }
  get realMargin(): number | null {
    return actualMargin(Number(this.config.fltSalePrice) || 0, this.totalUnitCost);
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
      return `El precio de venta no puede ser menor al mínimo (${this.formatCurrency(this.minimumPrice)}): ${this.minMarginPercent > 0 ? `costo total más el ${this.minMarginPercent} % mínimo del período` : 'quedarías vendiendo bajo costo'}.`;
    }
    return null;
  }

  formatCurrency(value: number): string {
    return '$' + new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  }
}
