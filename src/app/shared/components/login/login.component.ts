import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
  submitted = false; // Para controlar si el usuario ya intentó enviar el formulario

  constructor(private fb: FormBuilder) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]], // Validación de email
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.loginDTO = {
      aplicationName: 'myapp',
      email: '',
      password: ''
    };
    console.log('LoginDTO inicial:', this.loginDTO);
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

    // Asignar valores correctamente desde el formulario
    this.loginDTO = {
      aplicationName: NAME_APP_SHORT, // Puedes asignar el nombre de la aplicación aquí
      email: this.loginForm.get('username')?.value, // Obtiene el valor del campo username
      password: this.loginForm.get('password')?.value // Obtiene el valor del campo password
    };

    // Mostrar los valores en consola
    console.log('LoginDTO actualizado:', this.loginDTO);
    console.log('Valores del formulario:', this.loginForm.value);
  }
}
