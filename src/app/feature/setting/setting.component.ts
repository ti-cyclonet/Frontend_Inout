import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-setting',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.css']
})
export class SettingComponent implements OnInit {
  periodos: any[] = [];
  periodoActivo: any = null;
  periodoSeleccionado: any = null;
  parametros: any[] = [];
  parametrosDisponibles: any[] = [];
  parametrosDisponiblesFiltrados: any[] = [];
  loading = false;
  nuevoPeriodoForm: FormGroup;
  nuevoParametroForm: FormGroup;
  nuevoSubperiodoForm: FormGroup;
  
  filtroNombre: string = '';
  filtroTipo: string = '';
  
  // Filtros para períodos
  filtroNombrePeriodo = '';
  filtroFecha = '';
  periodosFiltrados: any[] = [];
  
  // Paginación períodos
  periodosPage = 0;
  periodosPageSize = 8;
  
  // Paginación parámetros
  parametrosPage = 0;
  parametrosPageSize = 5;

  private baseUrl = environment.apiUrl;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.nuevoPeriodoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required]
    });
    
    this.nuevoParametroForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      dataType: ['', Validators.required]
    });
    
    this.nuevoSubperiodoForm = this.fb.group({
      nombre: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadPeriodos();
    this.loadPeriodoActivo();
    this.loadParametrosDisponibles();
  }

  loadPeriodos(): void {
    this.http.get<any[]>(`${this.baseUrl}/periods`).subscribe({
      next: (periodos) => {
        this.periodos = periodos.map(periodo => ({
          id: periodo.id,
          codigo: periodo.code,
          nombre: periodo.name || periodo.code || `Período ${periodo.id.substring(0, 8)}`,
          fechaInicio: periodo.startDate,
          fechaFin: periodo.endDate,
          activo: periodo.status === 'ACTIVE',
          parentPeriodId: periodo.parentPeriodId
        }));
        
        this.periodos.sort((a, b) => {
          if (a.activo !== b.activo) {
            return a.activo ? -1 : 1;
          }
          return new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime();
        });
        
        this.periodoActivo = this.periodos.find(p => p.activo);
        this.aplicarFiltrosPeriodos();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los períodos', 'error');
      }
    });
  }

  loadPeriodoActivo(): void {
    this.http.get<any>(`${this.baseUrl}/periods/active/current`).subscribe({
      next: (periodo) => this.periodoActivo = periodo,
      error: () => {}
    });
  }

  configurarPeriodo(periodo: any): void {
    this.periodoSeleccionado = periodo;
    this.parametrosPage = 0;
    this.loadParametrosPorPeriodo(periodo.id);
  }

  loadParametrosPorPeriodo(periodoId: string): void {
    this.http.get<any[]>(`${this.baseUrl}/periods/${periodoId}/customer-parameters`).subscribe({
      next: (parametros) => {
        this.parametros = parametros.map(param => ({
          id: param.id,
          customerParameterId: param.customerParameter.id,
          nombre: param.customerParameter.name,
          valor: param.value,
          valorOriginal: param.value,
          descripcion: param.customerParameter.description,
          estado: param.status,
          editando: false
        }));
        this.parametrosPage = 0;
      },
      error: () => {
        this.parametros = [];
      }
    });
  }

  crearPeriodo(): void {
    if (this.nuevoPeriodoForm.invalid) {
      this.nuevoPeriodoForm.markAllAsTouched();
      return;
    }

    const fechaInicio = new Date(this.nuevoPeriodoForm.value.fechaInicio);
    const fechaFin = new Date(this.nuevoPeriodoForm.value.fechaFin);
    
    if (fechaFin <= fechaInicio) {
      Swal.fire('Error de validación', 'La fecha de fin debe ser posterior a la fecha de inicio', 'error');
      return;
    }

    this.loading = true;
    const periodoData = {
      nombre: this.nuevoPeriodoForm.value.nombre,
      fechaInicio: this.nuevoPeriodoForm.value.fechaInicio,
      fechaFin: this.nuevoPeriodoForm.value.fechaFin
    };
    
    this.http.post(`${this.baseUrl}/periods`, periodoData).subscribe({
      next: () => {
        this.loading = false;
        this.nuevoPeriodoForm.reset();
        this.loadPeriodos();
        this.closeModal('createPeriodModal');
        Swal.fire('¡Éxito!', 'Período creado exitosamente', 'success');
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudo crear el período', 'error');
      }
    });
  }

  activarPeriodo(periodo: any): void {
    const fechaActual = new Date();
    const fechaInicio = new Date(periodo.fechaInicio);
    const fechaFin = new Date(periodo.fechaFin);
    
    if (!periodo.parentPeriodId) {
      if (fechaInicio > fechaActual) {
        Swal.fire('No se puede activar', 'No se puede activar un período futuro', 'warning');
        return;
      }
      
      if (fechaFin < fechaActual) {
        Swal.fire('No se puede activar', 'No se puede activar un período pasado', 'warning');
        return;
      }
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas activar el período "${periodo.nombre}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, activar',
      cancelButtonText: 'Cancelar'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.http.patch(`${this.baseUrl}/periods/${periodo.id}/activate`, {}).subscribe({
          next: () => {
            this.loading = false;
            this.loadPeriodos();
            Swal.fire('¡Activado!', 'Período activado exitosamente', 'success');
          },
          error: () => {
            this.loading = false;
            Swal.fire('Error', 'No se pudo activar el período', 'error');
          }
        });
      }
    });
  }

  eliminarPeriodo(periodo: any): void {
    if (periodo.activo) {
      Swal.fire('No se puede eliminar', 'No se puede eliminar un período activo', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar el período "${periodo.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.http.delete(`${this.baseUrl}/periods/${periodo.id}`).subscribe({
          next: () => {
            this.loading = false;
            this.loadPeriodos();
            Swal.fire('¡Eliminado!', 'Período eliminado exitosamente', 'success');
          },
          error: () => {
            this.loading = false;
            Swal.fire('Error', 'No se pudo eliminar el período', 'error');
          }
        });
      }
    });
  }

  configurarSubperiodo(periodo: any): void {
    this.periodoSeleccionado = periodo;
    const startDate = new Date(periodo.fechaInicio).toISOString().slice(0, 16);
    const endDate = new Date(periodo.fechaFin).toISOString().slice(0, 16);
    
    setTimeout(() => {
      const startInput = document.getElementById('subperiodStartDate') as HTMLInputElement;
      const endInput = document.getElementById('subperiodEndDate') as HTMLInputElement;
      if (startInput && endInput) {
        startInput.min = startDate;
        startInput.max = endDate;
        endInput.min = startDate;
        endInput.max = endDate;
      }
    }, 100);
  }

  crearSubperiodo(): void {
    if (this.nuevoSubperiodoForm.invalid) {
      this.nuevoSubperiodoForm.markAllAsTouched();
      return;
    }

    const fechaInicio = new Date(this.nuevoSubperiodoForm.value.fechaInicio);
    const fechaFin = new Date(this.nuevoSubperiodoForm.value.fechaFin);
    const periodoInicio = new Date(this.periodoSeleccionado.fechaInicio);
    const periodoFin = new Date(this.periodoSeleccionado.fechaFin);
    
    if (fechaFin <= fechaInicio) {
      Swal.fire('Error de validación', 'La fecha de fin debe ser posterior a la fecha de inicio', 'error');
      return;
    }
    
    if (fechaInicio < periodoInicio || fechaFin > periodoFin) {
      Swal.fire('Error de validación', 'El subperíodo debe estar dentro de las fechas del período padre', 'error');
      return;
    }

    this.loading = true;
    const subperiodoData = {
      nombre: this.nuevoSubperiodoForm.value.nombre,
      fechaInicio: this.nuevoSubperiodoForm.value.fechaInicio,
      fechaFin: this.nuevoSubperiodoForm.value.fechaFin,
      parentPeriodId: this.periodoSeleccionado.id
    };
    
    this.http.post(`${this.baseUrl}/periods/subperiods`, subperiodoData).subscribe({
      next: () => {
        this.loading = false;
        this.nuevoSubperiodoForm.reset();
        this.loadPeriodos();
        this.closeModal('createSubperiodModal');
        Swal.fire('¡Éxito!', 'Subperíodo creado exitosamente', 'success');
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudo crear el subperíodo', 'error');
      }
    });
  }

  closeModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();
    }
  }

  aplicarFiltrosPeriodos(): void {
    this.periodosFiltrados = this.periodos.filter(periodo => {
      const matchNombre = !this.filtroNombrePeriodo || 
        periodo.nombre.toLowerCase().includes(this.filtroNombrePeriodo.toLowerCase());
      
      const matchFecha = !this.filtroFecha || (
        new Date(periodo.fechaInicio) <= new Date(this.filtroFecha) &&
        new Date(periodo.fechaFin) >= new Date(this.filtroFecha)
      );
      
      return matchNombre && matchFecha;
    });
    this.periodosPage = 0;
  }

  limpiarFiltrosPeriodos() {
    this.filtroNombrePeriodo = '';
    this.filtroFecha = '';
    this.aplicarFiltrosPeriodos();
  }

  get periodosPaginados() {
    const start = this.periodosPage * this.periodosPageSize;
    return this.periodosFiltrados.slice(start, start + this.periodosPageSize);
  }
  
  get parametrosPaginados() {
    const start = this.parametrosPage * this.parametrosPageSize;
    return this.parametros.slice(start, start + this.parametrosPageSize);
  }
  
  get totalPeriodosPages() {
    return Math.ceil(this.periodosFiltrados.length / this.periodosPageSize);
  }
  
  get totalParametrosPages() {
    return Math.ceil(this.parametros.length / this.parametrosPageSize);
  }
  
  nextPeriodosPage() {
    if (this.periodosPage < this.totalPeriodosPages - 1) {
      this.periodosPage++;
    }
  }
  
  prevPeriodosPage() {
    if (this.periodosPage > 0) {
      this.periodosPage--;
    }
  }
  
  nextParametrosPage() {
    if (this.parametrosPage < this.totalParametrosPages - 1) {
      this.parametrosPage++;
    }
  }
  
  prevParametrosPage() {
    if (this.parametrosPage > 0) {
      this.parametrosPage--;
    }
  }

  getParentPeriodName(parentPeriodId: string): string {
    const parentPeriod = this.periodos.find(p => p.id === parentPeriodId);
    return parentPeriod ? parentPeriod.nombre : 'Desconocido';
  }

  editarParametro(param: any): void {
    param.valorOriginal = param.valor;
    param.editando = true;
  }

  guardarValor(param: any): void {
    param.editando = false;
    const valorSinFormato = param.valorSinFormato || param.valor.replace(/,/g, '');
    this.http.patch(`${environment.auth.authorizaUrl}/customer-parameters-periods/${param.id}/value`, { value: valorSinFormato }).subscribe({
      next: () => {
        param.valor = valorSinFormato;
        Swal.fire('¡Éxito!', 'Valor actualizado exitosamente', 'success');
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar el valor', 'error');
      }
    });
  }

  cancelarEdicion(param: any): void {
    param.valor = param.valorOriginal;
    param.editando = false;
  }

  cambiarEstadoParametro(param: any): void {
    const nuevoEstado = param.estado === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    param.estado = nuevoEstado;
    
    this.http.patch(`${environment.auth.authorizaUrl}/customer-parameters-periods/${param.id}/status`, { status: nuevoEstado }).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', `Estado del parámetro actualizado a ${nuevoEstado}`, 'success');
      },
      error: () => {
        param.estado = nuevoEstado === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        Swal.fire('Error', 'No se pudo actualizar el estado del parámetro', 'error');
      }
    });
  }

  loadParametrosDisponibles(): void {
    this.http.get<any[]>(`${environment.auth.authorizaUrl}/customer-parameters`).subscribe({
      next: (params) => {
        this.parametrosDisponibles = params;
      },
      error: () => {}
    });
  }

  loadAvailableParameters(): void {
    this.http.get<any[]>(`${environment.auth.authorizaUrl}/customer-parameters`).subscribe({
      next: (params) => {
        const assignedIds = this.parametros.map(p => p.customerParameterId);
        this.parametrosDisponibles = params
          .filter(p => !assignedIds.includes(p.id))
          .map(p => ({ ...p, selected: false, value: '' }));
        this.aplicarFiltros();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los parámetros disponibles', 'error');
      }
    });
  }

  aplicarFiltros(): void {
    this.parametrosDisponiblesFiltrados = this.parametrosDisponibles.filter(param => {
      const matchNombre = !this.filtroNombre || 
        param.name.toLowerCase().includes(this.filtroNombre.toLowerCase());
      const matchTipo = !this.filtroTipo || param.dataType === this.filtroTipo;
      return matchNombre && matchTipo;
    });
  }

  agregarParametrosSeleccionados(): void {
    const seleccionados = this.parametrosDisponibles.filter(p => p.selected && p.value);
    
    if (seleccionados.length === 0) {
      Swal.fire('Advertencia', 'Por favor selecciona al menos un parámetro y proporciona un valor', 'warning');
      return;
    }

    this.loading = true;
    const requests = seleccionados.map(param => 
      this.http.post(`${this.baseUrl}/customer-parameters-periods`, {
        customerParameterId: param.id,
        periodId: this.periodoSeleccionado.id,
        value: param.value,
        status: 'active'
      })
    );

    Promise.all(requests.map(req => req.toPromise())).then(() => {
      this.loading = false;
      this.closeModal('addParameterModal');
      this.loadParametrosPorPeriodo(this.periodoSeleccionado.id);
      Swal.fire('¡Éxito!', 'Parámetros asignados exitosamente', 'success');
    }).catch(() => {
      this.loading = false;
      Swal.fire('Error', 'No se pudieron asignar los parámetros', 'error');
    });
  }

  crearParametro(): void {
    if (this.nuevoParametroForm.invalid) {
      this.nuevoParametroForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const paramData = {
      code: this.nuevoParametroForm.value.name.toUpperCase().replace(/\s+/g, '_'),
      name: this.nuevoParametroForm.value.name,
      description: this.nuevoParametroForm.value.description,
      dataType: this.nuevoParametroForm.value.dataType
    };
    
    this.http.post(`${environment.auth.authorizaUrl}/customer-parameters`, paramData).subscribe({
      next: () => {
        this.loading = false;
        this.nuevoParametroForm.reset();
        this.closeModal('createParameterModal');
        this.loadAvailableParameters();
        Swal.fire('¡Éxito!', 'Parámetro creado exitosamente', 'success');
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudo crear el parámetro', 'error');
      }
    });
  }

  formatNumber(value: string): string {
    if (!value) return value;
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return value;
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatInputNumber(event: any, param: any): void {
    let value = event.target.value.replace(/,/g, '');
    if (value && !isNaN(parseFloat(value))) {
      param.valorSinFormato = value;
    }
  }
}