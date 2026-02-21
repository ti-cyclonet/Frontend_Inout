import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesDemoComponent } from './sales-demo.component';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, SalesDemoComponent],
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.css']
})
export class SalesComponent {}
