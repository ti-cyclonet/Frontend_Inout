import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgStyle } from '@angular/common';
import { OptionMenu } from '../../model/option_menu';
import { StockAlertsService } from '../../services/stock-alerts.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NgStyle],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  @Input() optionsMenu: OptionMenu[] = [];
  @Output() sidebarToggle = new EventEmitter<void>();
  private openSubmenuId: string | null = null;
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

  getSubmenus(id: string): OptionMenu[] {
    return this.optionsMenu
    .filter(option => option.idMPather === id)
    .sort((a, b) => {
      const orderA = a.order ? parseInt(a.order, 10) : 99;
      const orderB = b.order ? parseInt(b.order, 10) : 99;
      return orderA - orderB;
    });
  }

  toggleSubmenu(id: string) {
    this.openSubmenuId = this.openSubmenuId === id ? null : id;
  }

  isSubmenuOpen(id: string): boolean {
    return this.openSubmenuId === id;
  }

  onMenuItemClick(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 992) {
      this.sidebarToggle.emit();
    }
  }

  hasSubmenu(optionId: string): boolean {
    const submenus = this.getSubmenus(optionId);
    return submenus && submenus.length > 0;
  }

  isMenuMaterials(option: OptionMenu): boolean {
    return (option.url || '').includes('material');
  }

  isMenuProducts(option: OptionMenu): boolean {
    return (option.url || '').includes('product');
  }
}
