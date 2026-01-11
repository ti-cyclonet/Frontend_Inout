import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialService } from '../../../shared/services/material.service';
import { MaterialMetrics } from '../../../shared/models/material.model';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';

@Component({
  selector: 'app-materials-dashboard',
  standalone: true,
  imports: [CommonModule, MetricCardComponent],
  templateUrl: './materials-dashboard.component.html',
  styleUrls: ['./materials-dashboard.component.css']
})
export class MaterialsDashboardComponent implements OnInit {
  metrics: MaterialMetrics | null = null;
  recentActivities: any[] = [];
  loading = true;

  constructor(private materialService: MaterialService) {}

  ngOnInit(): void {
    this.loadMetrics();
    this.loadRecentActivities();
  }

  loadMetrics(): void {
    this.loading = true;
    this.materialService.getMetrics().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading metrics:', error);
        this.loading = false;
      }
    });
  }

  loadRecentActivities(): void {
    // Load from service when available
    this.materialService.getRecentActivities().subscribe({
      next: (activities) => {
        this.recentActivities = activities;
      },
      error: (error) => {
        console.error('Error loading activities:', error);
        this.recentActivities = [];
      }
    });
  }

  navigateToMaterials(): void {
    // Simulate navigation to materials list
    console.log('Navigate to materials list');
    // In a real app: this.router.navigate(['/materials/list']);
  }

  navigateToCreate(): void {
    // Simulate navigation to create material
    console.log('Navigate to create material');
    // In a real app: this.router.navigate(['/materials/create']);
  }
}