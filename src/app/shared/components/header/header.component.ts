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
import { UsageStatusService } from '../../services/usage-status.service';
import { environment } from '../../../../environments/environment';

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
  uploadingAvatar = false;
  clientName: string | null = null;
  packageName: string | null = null;
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
  @Output() sidebarStyleChange = new EventEmitter<'lateral' | 'list'>();

  @Input() sidebarStyle: 'lateral' | 'list' = 'lateral';

  nombreApp = DESCRIPTION_APP;

  form!: FormGroup;
  forcedPasswordChange = false;
  showOldPassword = false;
  showNewPassword = false;
  showRepeatPassword = false;
  changingPassword = false;

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
    private moduleService: ModuleService,
    private usageStatusService: UsageStatusService
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.userName = sessionStorage.getItem('user_displayName') || sessionStorage.getItem('user_name');
      this.userEmail = sessionStorage.getItem('user_email');
      this.userRol = sessionStorage.getItem('user_rol');
      this.userRolDescription = sessionStorage.getItem('user_rolDescription');
      this.userImage = sessionStorage.getItem('user_image');
      
      // Obtener nombre del cliente desde el token
      this.getClientNameFromToken();
      
      // Obtener descripción de la aplicación
      this.getAppDescription();

      // Obtener nombre del paquete contratado
      this.loadPackageName();
    }
    
    // Suscribirse a cambios de módulo
    this.moduleService.currentModule$.subscribe(module => {
      this.currentModule = module;
      if (module === 'inventory') {
        this.appDescription = 'GESTIÓN DE INVENTARIO';
      } else if (module === 'manufacturing') {
        this.appDescription = 'GESTIÓN DE INVENTARIO Y MANUFACTURA';
      }
    });
    
    this.form = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      repeatPassword: ['', Validators.required],
    });

    // Obligar el cambio de contraseña temporal (asignada en registro/creación
    // de usuario) antes de dejar usar el resto de la aplicación.
    if (isPlatformBrowser(this.platformId) && sessionStorage.getItem('must_change_password') === 'true') {
      this.forcedPasswordChange = true;
      setTimeout(() => this.openChangePasswordModal(true), 0);
    }
  }

  openChangePasswordModal(forced: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.getElementById('changePasswordModal');
    if (!el) return;
    const bootstrap = (window as any).bootstrap;
    if (!bootstrap) return;
    const options = forced ? { backdrop: 'static', keyboard: false } : {};
    bootstrap.Modal.getOrCreateInstance(el, options).show();
  }

  togglePasswordVisibility(field: 'old' | 'new' | 'repeat'): void {
    if (field === 'old') this.showOldPassword = !this.showOldPassword;
    if (field === 'new') this.showNewPassword = !this.showNewPassword;
    if (field === 'repeat') this.showRepeatPassword = !this.showRepeatPassword;
  }

  changeSidebarStyle(style: 'lateral' | 'list'): void {
    this.sidebarStyleChange.emit(style);
  }

  onToggleSidebar(): void {
    this._isSidebarVisible = !this._isSidebarVisible;
    this.sidebarToggle.emit();
  }

  onSubmit(): void {
    if (
      !this.form.valid ||
      this.form.get('newPassword')?.value !==
        this.form.get('repeatPassword')?.value
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const userId =
      sessionStorage.getItem('user_id') || localStorage.getItem('userId');
    const { oldPassword, newPassword } = this.form.value;

    this.changingPassword = true;

    this.http
      .post(`${environment.auth.authorizaUrl}/users/${userId}/change-password`, {
        oldPassword,
        newPassword,
      })
      .subscribe({
        next: (res: any) => {
          this.changingPassword = false;
          this.showToast(res.message || 'Contraseña actualizada correctamente', 'success', 'A', 1);
          this.form.reset();

          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem('must_change_password', 'false');
          }

          if (this.forcedPasswordChange) {
            this.forcedPasswordChange = false;
            const el = document.getElementById('changePasswordModal');
            const bootstrap = (window as any).bootstrap;
            if (el && bootstrap) {
              bootstrap.Modal.getInstance(el)?.hide();
              // Sin esto, la instancia queda "pegada" con backdrop estatico y
              // sin teclado (config forzada) para futuras aperturas voluntarias.
              bootstrap.Modal.getInstance(el)?.dispose();
            }
          }
        },
        error: (err: any) => {
          this.changingPassword = false;
          this.showToast('Error: ' + (err.error?.message || 'No se pudo actualizar la contraseña'), 'danger', 'A', 1);
        },
      });
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
        this.http.get(`${environment.auth.authorizaUrl}/users/${payload.tenantId}`).subscribe({
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
    this.http.get(`${environment.auth.authorizaUrl}/applications/INOUT`).subscribe({
      next: (application: any) => {
        this.appDescription = application.strDescription || 'INVENTORY MANAGEMENT';
      },
      error: () => {
        this.appDescription = 'INVENTORY MANAGEMENT';
      }
    });
  }

  private loadPackageName(): void {
    this.usageStatusService.getUsageStatus().subscribe({
      next: (response) => {
        this.packageName = response.packageName || null;
      },
      error: () => {
        this.packageName = null;
      }
    });
  }

  /**
   * Sube la foto de perfil al endpoint CENTRAL de Authoriza. La imagen vive en
   * Authoriza y se refleja en todas las apps del ecosistema. El interceptor
   * agrega el Bearer automáticamente (URL de Authoriza, no de Shotra).
   */
  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite re-elegir el mismo archivo
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('Selecciona un archivo de imagen.', 'warning', 'A', 1);
      return;
    }

    const form = new FormData();
    form.append('file', file);
    // Normalizar base de Authoriza: puede venir como '.../api' (dev) o
    // '.../api/auth' (prod). Se quita un '/auth' final para construir
    // '.../auth/users/me/avatar' consistente en ambos entornos.
    const base = environment.auth.authorizaUrl.replace(/\/auth\/?$/, '');
    this.uploadingAvatar = true;
    this.http.post<{ url: string }>(`${base}/users/me/avatar`, form).subscribe({
      next: (res) => {
        this.uploadingAvatar = false;
        if (res?.url) {
          this.userImage = res.url;
          sessionStorage.setItem('user_image', res.url);
          this.cdr.detectChanges();
        }
        this.showToast('Foto de perfil actualizada.', 'success', 'A', 1);
      },
      error: (err) => {
        this.uploadingAvatar = false;
        this.showToast('Error: ' + (err.error?.message || 'No se pudo subir la foto'), 'danger', 'A', 1);
      },
    });
  }

  triggerAvatarInput(): void {
    const el = document.getElementById('avatarFileInput') as HTMLInputElement | null;
    el?.click();
  }

  openSettings(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Cerrar el dropdown de Bootstrap
    const dropdownElement = document.querySelector('.dropdown-toggle');
    if (dropdownElement) {
      const dropdown = (window as any).bootstrap?.Dropdown?.getInstance(dropdownElement);
      if (dropdown) {
        dropdown.hide();
      }
    }
    
    this.router.navigate(['/setting']);
  }
  // ----------------------------------------------
}
