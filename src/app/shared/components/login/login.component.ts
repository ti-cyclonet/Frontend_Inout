import { Component } from '@angular/core';
import { LoginDTO } from '../../model/login';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']  
})
export class LoginComponent {
  loginDTO: LoginDTO;

  constructor() {
    this.loginDTO = {
      aplicationName: 'MyApp',
      password: '123456',
      email: 'usuario@example.com'
    };
    console.log('Instancia del DTO para el login:', this.loginDTO);
  }
}
