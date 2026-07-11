import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsageStatusService } from '../../shared/services/usage-status.service';
import { UsageStatusResponse, UsageVariable, UsageWarning } from '../../shared/model/usage-status.model';

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
  warnings: UsageWarning[] = [];
  recalibrating = false;
  recalibrationResult: { recalibrated: { variableName: string; previousCount: number; actualCount: number }[] } | null = null;

  // Variables visibles en el panel (en orden específico)
  private visibleVariables = ['nMateriales', 'nMaterialesT', 'nProductos', 'nLotes', 'nClientes', 'nVentas'];
  // Variables que se resetean mensualmente
  private monthlyResetVariables = ['nLotes', 'nVentas'];

  // Timeline del plan
  daysElapsed = 0;
  daysRemaining = 0;
  totalDays = 0;
  timelinePercentage = 0;
  planExpired = false;

  constructor(private usageStatusService: UsageStatusService) {}

  ngOnInit(): void {
    this.loadUsageStatus();
    this.loadWarnings();
  }

  loadUsageStatus(): void {
    this.loading = true;
    this.error = null;

    this.usageStatusService.getUsageStatus().subscribe({
      next: (response) => {
        this.usageStatus = {
          ...response,
          variables: this.visibleVariables
            .map(name => response.variables.find(v => v.variableName === name))
            .filter((v): v is UsageVariable => !!v)
        };
        this.calculateTimeline(response);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'No se pudo cargar el estado de consumos. Intente nuevamente.';
        this.loading = false;
      }
    });
  }

  loadWarnings(): void {
    this.usageStatusService.getUsageWarnings().subscribe({
      next: (response) => {
        this.warnings = (response.warnings || []).filter(w => this.visibleVariables.includes(w.variableName));
      },
      error: () => {
        this.warnings = [];
      }
    });
  }

  isMonthlyResettable(variable: UsageVariable): boolean {
    return this.monthlyResetVariables.includes(variable.variableName);
  }

  private calculateTimeline(response: UsageStatusResponse): void {
    if (!response.planTimeline) return;

    const start = new Date(response.planTimeline.startDate);
    const end = new Date(response.planTimeline.endDate);
    const now = new Date();

    this.totalDays = response.planTimeline.totalDays;
    this.daysElapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    this.daysRemaining = Math.max(0, Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    this.timelinePercentage = Math.min(100, Math.round((this.daysElapsed / this.totalDays) * 100));
    this.planExpired = now > end;
  }

  recalibrate(): void {
    this.recalibrating = true;
    this.recalibrationResult = null;

    this.usageStatusService.recalibrateCounters().subscribe({
      next: (result) => {
        this.recalibrating = false;
        this.recalibrationResult = result;
        // Reload usage status after recalibration
        this.loadUsageStatus();
        this.loadWarnings();
      },
      error: () => {
        this.recalibrating = false;
        this.error = 'Error al recalibrar los contadores.';
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
