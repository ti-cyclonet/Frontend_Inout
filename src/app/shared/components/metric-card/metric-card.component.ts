import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="metric-card" [ngClass]="cardClass">
      <div class="metric-icon">
        <svg viewBox="0 0 16 16">
          <use [attr.xlink:href]="'./assets/icons/bootstrap-icons.svg#' + icon"></use>
        </svg>
      </div>
      <div class="metric-content">
        <div class="metric-value">{{ value | number }}</div>
        <div class="metric-label">{{ label }}</div>
        <div class="metric-change" [ngClass]="changeClass" *ngIf="change !== undefined">
          <svg class="change-icon" viewBox="0 0 16 16">
            <use [attr.xlink:href]="changeIcon"></use>
          </svg>
          {{ change }}%
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./metric-card.component.css']
})
export class MetricCardComponent {
  @Input() value: number = 0;
  @Input() label: string = '';
  @Input() icon: string = '';
  @Input() cardClass: string = '';
  @Input() change?: number;

  get changeClass(): string {
    if (this.change === undefined) return '';
    return this.change >= 0 ? 'positive' : 'negative';
  }

  get changeIcon(): string {
    if (this.change === undefined) return '';
    return this.change >= 0 ? './assets/icons/bootstrap-icons.svg#arrow-up' : './assets/icons/bootstrap-icons.svg#arrow-down';
  }
}