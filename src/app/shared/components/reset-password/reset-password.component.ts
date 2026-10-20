import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

/**
 * Pantalla del enlace "¿Olvidaste tu contraseña?" (/reset-password?token=…).
 * La contraseña vive en Authoriza: aplica a todas las apps CycloNet.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirm = '';
  show = false;
  loading = false;
  error = '';
  done = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  get validToken(): boolean {
    return /^[a-f0-9]{64}$/i.test(this.token);
  }

  submit(): void {
    this.error = '';
    if (this.password.length < 6) { this.error = 'La contraseña debe tener al menos 6 caracteres.'; return; }
    if (this.password !== this.confirm) { this.error = 'Las contraseñas no coinciden.'; return; }
    this.loading = true;
    this.authService.resetPassword(this.token, this.password).subscribe({
      next: (r) => {
        this.loading = false;
        this.done = r?.message || 'Contraseña actualizada. Ya puedes iniciar sesión.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.status === 429
          ? 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
          : (err?.error?.message || 'No pudimos actualizar tu contraseña. Intenta de nuevo.');
        this.cdr.detectChanges();
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
