import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductsInsightsComponent } from './products-insights.component';

/**
 * Panel principal de Productos. Los indicadores (ventas, producción,
 * márgenes y stock) los calcula el backend y se muestran en vivo en
 * ProductsInsightsComponent; aquí queda el acceso a crear productos.
 */
@Component({
  selector: 'app-products-dashboard',
  standalone: true,
  imports: [CommonModule, ProductsInsightsComponent],
  templateUrl: './products-dashboard.component.html',
  styleUrls: ['./products-dashboard.component.css']
})
export class ProductsDashboardComponent {
  @Output() openCreateModal = new EventEmitter<void>();

  navigateToCreate(): void {
    this.openCreateModal.emit();
  }
}
