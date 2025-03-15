import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { LoginDTO } from '../../model/login';
import { NAME_APP_SHORT } from '../../../config/config';
import { NotificationsComponent } from "../notifications/notifications.component";
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
  notifications: Array<{
    title: string;
    type: 'success' | 'warning' | 'danger';
  }> = [];

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
      if (response.access_token) {
        sessionStorage.setItem('token', response.access_token);
        this.showToast('Inicio de sesión exitoso', 'success');
  
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 3000);
      } else {
        this.showToast('Credenciales incorrectas', 'danger');
        console.error('❌ Error: No se recibió un token válido.');
      }
    }, error => {
      this.showToast('Error en la autenticación', 'danger');
      console.error('❌ Error de login:', error);
    });
  }
  // Método para agregar una nueva notificación
  addNotification(title: string, type: 'success' | 'warning' | 'danger') {
    this.notifications.push({ title, type });
  }
  // Método para mostrar la notificación
  showToast(message: string, type: 'success' | 'warning' | 'danger') {
    this.notifications.push({ title: message, type });

    // Asegurar que el cambio se detecte
    this.isVisible = true;
    this.cdr.detectChanges();

    // Ocultar la notificación después de 3 segundos
    setTimeout(() => {
      this.notifications.shift();
      if (this.notifications.length === 0) {
        this.isVisible = false;
      }
      this.cdr.detectChanges();
    }, 3000);
  }

}
