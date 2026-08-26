import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OptionMenu } from '../../model/option_menu';
import { StockAlertsService } from '../../services/stock-alerts.service';

@Component({
  selector: 'app-sidebar-list',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar-list.component.html',
  styleUrls: ['./sidebar-list.component.css']
})
export class SidebarListComponent implements OnInit {
  @Input() optionsMenu: OptionMenu[] = [];
  @Output() sidebarToggle = new EventEmitter<void>();
  materialAlertCount = 0;
  productAlertCount = 0;

  constructor(private stockAlertsService: StockAlertsService) {}

  ngOnInit(): void {
    this.optionsMenu.sort((a, b) => {
      const orderA = a.order ? parseInt(a.order, 10) : 99;
      const orderB = b.order ? parseInt(b.order, 10) : 99;
      return orderA - orderB;
    });

    this.stockAlertsService.getAlerts().subscribe({
      next: (response) => {
        this.materialAlertCount = response.data.filter(a => a.type === 'material').length;
        this.productAlertCount = response.data.filter(a => a.type === 'product').length;
      },
      error: () => {}
    });
  }

  isMenuMaterials(option: OptionMenu): boolean {
    return (option.url || '').includes('material');
  }

  isMenuProducts(option: OptionMenu): boolean {
    return (option.url || '').includes('product');
  }

  onItemClick(): void {
    this.sidebarToggle.emit();
  }
}
