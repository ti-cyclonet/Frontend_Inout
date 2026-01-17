import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { LoginDTO } from '../../model/login';
import { NAME_APP_SHORT } from '../../../config/config';
import { NotificationsComponent } from "../notifications/notifications.component";

interface ClientContract {
  contractId: string;
  clientName: string;
  packageName: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NotificationsComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  @ViewChild('notification') notification!: NotificationsComponent;
  loginForm: FormGroup;
  loginDTO: LoginDTO | undefined;
  submitted = false;
  isVisible: boolean = true;
  errorMessage = '';
  
  // Selector de cliente
  showClientSelector: boolean = false;
  availableContracts: ClientContract[] = [];
  selectedContractId: string = '';
  pendingLoginResponse: any = null;

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
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService, 
    private cdr: ChangeDetectorRef,
  ) {
    this.notifications = [];
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]], 
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.loginDTO = {
      applicationName: '', 
      email: '',
      password: ''
    };
  }

  get f() {
    return this.loginForm.controls;
  }

  onSubmit() {
    this.submitted = true;
  
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
  
    const loginDTO = {
      applicationName: NAME_APP_SHORT,
      email: this.loginForm.get('username')?.value,
      password: this.loginForm.get('password')?.value
    };
  
    this.authService.login(loginDTO).subscribe(response => {
      if (response.contracts && response.contracts.length > 1) {
        this.pendingLoginResponse = response;
        this.availableContracts = response.contracts;
        this.showClientSelector = true;
        this.cdr.detectChanges();
      } else {
        this.completeLogin(response);
      }
    }, error => {
      this.showToast('Error en la autenticación', 'danger', 'A', 0);
    });
  }

  selectClient() {
    if (!this.selectedContractId) {
      this.showToast('Por favor seleccione un cliente', 'warning', 'A', 0);
      return;
    }

    const completeLoginDTO = {
      email: this.loginForm.get('username')?.value,
      applicationName: NAME_APP_SHORT,
      contractId: this.selectedContractId
    };

    this.authService.completeLogin(completeLoginDTO).subscribe(response => {
      this.showClientSelector = false;
      this.completeLogin(response);
    }, error => {
      this.showToast('Error al seleccionar cliente', 'danger', 'A', 0);
    });
  }

  private completeLogin(response: any) {
    this.authService.setUserSession(response);
    this.showToast('Inicio de sesión exitoso', 'success', 'A', 0);
    this.router.navigate(['/module-selector']);
  }

  // Funciones para NOTIFICACIONES
    addNotification(title: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1) {
      this.notifications.push({ title, type, alertType, container, visible: true });
    }

    removeNotification(index: number) {
      this.notifications.splice(index, 1);
    }
  
    showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B',  container: 0 | 1 ) {
      const notification = {
        title: message,
        type,
        alertType,
        container,
        visible: true
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
  // ----------------------------------------------


}
