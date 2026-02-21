import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductsDemoComponent } from './products-demo.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ProductsDemoComponent],
  template: `<app-products-demo></app-products-demo>`,
  styles: []
})
export class ProductsComponent {}
