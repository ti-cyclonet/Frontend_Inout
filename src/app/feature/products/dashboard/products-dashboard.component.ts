import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../shared/services/product.service';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';

@Component({
  selector: 'app-products-dashboard',
  standalone: true,
  imports: [CommonModule, MetricCardComponent],
  templateUrl: './products-dashboard.component.html',
  styleUrls: ['./products-dashboard.component.css']
})
export class ProductsDashboardComponent implements OnInit {
  @Output() openCreateModal = new EventEmitter<void>();
  
  metrics = {
    totalProducts: 0,
    lowStockCount: 0,
    totalValue: 0
  };
  
  loading = true;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.loading = true;
    this.productService.getProducts(1, 1000).subscribe({
      next: (response) => {
        const products = response.data;
        this.metrics.totalProducts = products.length;
        this.metrics.lowStockCount = products.filter((p: any) => 
          Number(p.ingQuantity) < Number(p.ingStockMin)
        ).length;
        this.metrics.totalValue = products.reduce((sum: number, p: any) => 
          sum + (p.fltPrice * p.ingQuantity), 0
        );
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  navigateToCreate(): void {
    this.openCreateModal.emit();
  }
}
