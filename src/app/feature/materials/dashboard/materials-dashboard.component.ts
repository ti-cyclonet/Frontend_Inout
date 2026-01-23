import { Component, OnInit, Output, EventEmitter, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialService } from '../../../shared/services/material.service';
import { MaterialMetrics } from '../../../shared/models/material.model';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';

import { Router } from '@angular/router';

@Component({
  selector: 'app-materials-dashboard',
  standalone: true,
  imports: [CommonModule, MetricCardComponent],
  templateUrl: './materials-dashboard.component.html',
  styleUrls: ['./materials-dashboard.component.css']
})
export class MaterialsDashboardComponent implements OnInit, OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  @Output() openCompositionModal = new EventEmitter<void>();
  
  metrics: MaterialMetrics | null = null;
  recentActivities: any[] = [];
  loading = true;
  transformedMaterialsCount = 0;

  constructor(private materialService: MaterialService, private router: Router) {}

  ngOnInit(): void {
    this.loadMetrics();
    this.loadRecentActivities();
    this.loadTransformedMaterialsCount();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadMetrics();
      this.loadRecentActivities();
      this.loadTransformedMaterialsCount();
    }
  }

  loadMetrics(): void {
    this.loading = true;
    this.materialService.getMetrics().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
      }
    });
  }

  loadRecentActivities(): void {
    this.materialService.getRecentActivities().subscribe({
      next: (activities) => {
        this.recentActivities = activities;
      },
      error: (error) => {
        this.recentActivities = [];
      }
    });
  }

  loadTransformedMaterialsCount(): void {
    this.materialService.getTransformedMaterials().subscribe({
      next: (materials) => {
        this.transformedMaterialsCount = materials.length;
      },
      error: () => {
        this.transformedMaterialsCount = 0;
      }
    });
  }

  navigateToComposition(): void {
    this.openCompositionModal.emit();
  }

  navigateToCreate(): void {
    this.openCreateModal.emit();
  }
}