import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // Importamos Router
import { LoginDTO } from '../../model/login';
import { NAME_APP_SHORT } from '../../../config/config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  loginDTO: LoginDTO;
  submitted = false;

  constructor(private fb: FormBuilder, private router: Router) { // Inyectamos Router
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
      console.log('Formulario inválido');
      return;
    }

    // Asignar valores del formulario al DTO
    this.loginDTO = {
      applicationName: NAME_APP_SHORT,
      email: this.loginForm.get('username')?.value,
      password: this.loginForm.get('password')?.value
    };
    console.table(this.loginDTO);

    // Simulación de autenticación
    const user = this.loginForm.value;
    if (user.username === 'admin@example.com' && user.password === '123456') {
      // Guardar sesión
      localStorage.setItem('user', JSON.stringify(user));

      // Redirigir al dashboard
      this.router.navigate(['/dashboard']);
    } else {
      alert('Credenciales incorrectas');
    }
  }
}
