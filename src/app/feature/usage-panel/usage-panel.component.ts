import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsageStatusService } from '../../shared/services/usage-status.service';
import { UsageStatusResponse, UsageVariable } from '../../shared/model/usage-status.model';

@Component({
  selector: 'app-usage-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './usage-panel.component.html',
  styleUrls: ['./usage-panel.component.css']
})
export class UsagePanelComponent implements OnInit {
  usageStatus: UsageStatusResponse | null = null;
  loading = true;
  error: string | null = null;

  constructor(private usageStatusService: UsageStatusService) {}

  ngOnInit(): void {
    this.loadUsageStatus();
  }

  loadUsageStatus(): void {
    this.loading = true;
    this.error = null;

    this.usageStatusService.getUsageStatus().subscribe({
      next: (response) => {
        this.usageStatus = response;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'No se pudo cargar el estado de consumos. Intente nuevamente.';
        this.loading = false;
      }
    });
  }

  getProgressBarClass(variable: UsageVariable): string {
    const percentage = variable.usagePercentage;
    if (percentage >= 100) {
      return 'bg-danger';
    } else if (percentage >= 80) {
      return 'bg-warning';
    }
    return 'bg-success';
  }

  getStatusLabel(variable: UsageVariable): string {
    const percentage = variable.usagePercentage;
    if (percentage >= 100) {
      return 'Límite alcanzado';
    } else if (percentage >= 80) {
      return 'Cerca del límite';
    }
    return 'Normal';
  }

  getStatusBadgeClass(variable: UsageVariable): string {
    const percentage = variable.usagePercentage;
    if (percentage >= 100) {
      return 'badge bg-danger';
    } else if (percentage >= 80) {
      return 'badge bg-warning text-dark';
    }
    return 'badge bg-success';
  }

  formatPercentage(value: number): string {
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  }

  clampPercentage(value: number): number {
    return Math.min(value, 100);
  }
}
