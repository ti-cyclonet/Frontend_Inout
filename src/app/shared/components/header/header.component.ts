import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnInit,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { DESCRIPTION_APP } from '../../../config/config';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { ChangePasswordComponent } from '../change-password/change-password.component';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationsComponent } from '../notifications/notifications.component';
import { ModuleService, ModuleType } from '../../services/module/module.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    ChangePasswordComponent,
    ReactiveFormsModule,
    NotificationsComponent,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  providers: [AuthService],
})
export class HeaderComponent implements OnInit {
  userName: string | null = null;
  userEmail: string | null = null;
  userRol: string | null = null;
  userRolDescription: string | null = null;
  userImage: string | null = null;
  clientName: string | null = null;
  appDescription: string = 'INVENTORY MANAGEMENT';
  currentModule: ModuleType | null = null;
  private _isSidebarVisible: boolean = false;

  @Input()
  set isSidebarVisible(value: boolean) {
    this._isSidebarVisible = value;
  }
  get isSidebarVisible(): boolean {
    return this._isSidebarVisible;
  }

  @Output() sidebarToggle = new EventEmitter<void>();

  nombreApp = DESCRIPTION_APP;

  form!: FormGroup;

  // configuración notificaciones tipo toast
  toastTitle: string = '';
  toastType: 'success' | 'warning' | 'danger' | 'primary' = 'success';
  notifications: Array<{
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    alertType: 'A' | 'B';
    container: 0 | 1;
    visible: boolean;
  }> = [];
  SWNTF: number = 0;
  // ----------------------------------------------

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private moduleService: ModuleService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.userName = sessionStorage.getItem('user_name');
      this.userEmail = sessionStorage.getItem('user_email');
      this.userRol = sessionStorage.getItem('user_rol');
      this.userRolDescription = sessionStorage.getItem('user_rolDescription');
      this.userImage = sessionStorage.getItem('user_image');
      
      // Obtener nombre del cliente desde el token
      this.getClientNameFromToken();
      
      // Obtener descripción de la aplicación
      this.getAppDescription();
    }
    
    // Suscribirse a cambios de módulo
    this.moduleService.currentModule$.subscribe(module => {
      this.currentModule = module;
    });
    
    this.form = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      repeatPassword: ['', Validators.required],
    });
  }

  onToggleSidebar(): void {
    this._isSidebarVisible = !this._isSidebarVisible;
    this.sidebarToggle.emit();
  }

  onSubmit(): void {
    if (
      this.form.valid &&
      this.form.get('newPassword')?.value ===
        this.form.get('repeatPassword')?.value
    ) {
      const userId =
        sessionStorage.getItem('user_id') || localStorage.getItem('userId');
      const { oldPassword, newPassword } = this.form.value;

      this.http
        .post(`/api/users/${userId}/change-password`, {
          oldPassword,
          newPassword,
        })
        .subscribe({
          next: (res: any) => {
            // Mostrar el mensaje devuelto
            this.showToast(res.message, 'success', 'A', 1);

            // Resetear formulario
            this.form.reset();
          },
          error: (err: any) => {
            this.showToast('Error: ' + err.error.message, 'danger', 'A', 1);
          },
        });
    }
  }

  changeModule(): void {
    this.router.navigate(['/module-selector']);
  }

  getModuleDisplayName(): string {
    if (!this.currentModule) return '';
    return this.moduleService.getModuleConfig(this.currentModule).displayName;
  }

  getModuleIcon(): string {
    if (!this.currentModule) return 'house-fill';
    return this.moduleService.getModuleConfig(this.currentModule).icon;
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.clear();
    }

    this.router.navigate(['/login']).then(() => {
      setTimeout(() => {
        window.location.reload();
      }, 100);
    });
  }

  // Funciones para NOTIFICACIONES
  addNotification(
    title: string,
    type: 'success' | 'warning' | 'danger' | 'primary',
    alertType: 'A' | 'B',
    container: 0 | 1
  ) {
    this.notifications.push({
      title,
      type,
      alertType,
      container,
      visible: true,
    });
  }

  removeNotification(index: number) {
    this.notifications.splice(index, 1);
  }

  getIconColor() {
    return 'var(--header-background-color)';
  }

  showToast(
    message: string,
    type: 'success' | 'warning' | 'danger' | 'primary',
    alertType: 'A' | 'B',
    container: 0 | 1
  ) {
    const notification = {
      title: message,
      type,
      alertType,
      container,
      visible: true,
    };
    this.notifications.push(notification);
    this.cdr.detectChanges();

    if (alertType === 'A') {
      setTimeout(() => {
        notification.visible = false;
        this.cdr.detectChanges();
      }, 5000);
    }
  }

  private getClientNameFromToken(): void {
    try {
      const token = sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Hacer llamada al backend para obtener el nombre del cliente usando el tenantId
        this.http.get(`http://localhost:3000/api/users/${payload.tenantId}`).subscribe({
          next: (user: any) => {
            if (user.basicData?.strPersonType === 'N') {
              this.clientName = `${user.basicData.naturalPersonData?.firstName || ''} ${user.basicData.naturalPersonData?.firstSurname || ''}`.trim();
            } else if (user.basicData?.strPersonType === 'J') {
              this.clientName = user.basicData.legalEntityData?.businessName || '';
            }
          },
          error: () => {
            this.clientName = null;
          }
        });
      }
    } catch (error) {
      this.clientName = null;
    }
  }

  private getAppDescription(): void {
    this.http.get('http://localhost:3000/api/applications/INOUT').subscribe({
      next: (application: any) => {
        this.appDescription = application.strDescription || 'INVENTORY MANAGEMENT';
      },
      error: () => {
        this.appDescription = 'INVENTORY MANAGEMENT';
      }
    });
  }
  // ----------------------------------------------
}
