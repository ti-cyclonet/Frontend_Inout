import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainingSessionsService, TrainingSession, CreateTrainingSessionDto } from '../../shared/services/training-sessions.service';

@Component({
  selector: 'app-training-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './training-sessions.component.html',
  styleUrls: ['./training-sessions.component.css']
})
export class TrainingSessionsComponent implements OnInit {
  sessions: TrainingSession[] = [];
  loading = true;
  error: string | null = null;
  showCreateModal = false;
  creating = false;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  total = 0;

  // Form
  newSession: CreateTrainingSessionDto = {
    strTitle: '',
    strDescription: '',
    strInstructor: '',
    dtmDate: '',
    intDurationMinutes: 60,
    intAttendees: 0,
    strNotes: ''
  };

  // Usage warning from response
  usageWarning: any = null;

  constructor(private trainingSessionsService: TrainingSessionsService) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;
    this.error = null;

    this.trainingSessionsService.findAll(this.currentPage, 10).subscribe({
      next: (response) => {
        this.sessions = response.data;
        this.total = response.total;
        this.totalPages = response.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar sesiones de capacitación';
        this.loading = false;
      }
    });
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.newSession = {
      strTitle: '',
      strDescription: '',
      strInstructor: '',
      dtmDate: '',
      intDurationMinutes: 60,
      intAttendees: 0,
      strNotes: ''
    };
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createSession(): void {
    if (!this.newSession.strTitle || !this.newSession.dtmDate) return;

    this.creating = true;
    this.usageWarning = null;

    this.trainingSessionsService.create(this.newSession).subscribe({
      next: (response: any) => {
        this.creating = false;
        this.showCreateModal = false;

        // Check for usage warning in response
        if (response._usageWarning) {
          this.usageWarning = response._usageWarning;
        }

        this.loadSessions();
      },
      error: (err) => {
        this.creating = false;
        if (err?.error?.error === 'LIMIT_REACHED') {
          this.error = `Límite alcanzado: ${err.error.resource}. Máximo permitido: ${err.error.limit}`;
        } else {
          this.error = err?.error?.message || 'Error al crear la sesión';
        }
      }
    });
  }

  deleteSession(id: string): void {
    if (!confirm('¿Está seguro de eliminar esta sesión?')) return;

    this.trainingSessionsService.remove(id).subscribe({
      next: () => this.loadSessions(),
      error: (err) => {
        this.error = err?.error?.message || 'Error al eliminar la sesión';
      }
    });
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadSessions();
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'badge bg-success';
      case 'IN_PROGRESS': return 'badge bg-primary';
      case 'CANCELLED': return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'SCHEDULED': return 'Programada';
      case 'IN_PROGRESS': return 'En Progreso';
      case 'COMPLETED': return 'Completada';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  }
}
