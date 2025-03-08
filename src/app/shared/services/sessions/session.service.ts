import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  constructor() {}

  // Métodos para obtener y establecer el nombre de usuario en sessionStorage
  setUserName(userName: string): void {
    sessionStorage.setItem('UserName', userName);  // Guardar el nombre de usuario
  }

  getUserName(): string | null {
    return sessionStorage.getItem('UserName');  // Obtener el nombre de usuario
  }

  setUserImage(userImage: string): void {
    sessionStorage.setItem('UserImage', userImage);  // Guardar la imagen del usuario
  }

  getUserImage(): string | null {
    return sessionStorage.getItem('UserImage');  // Obtener la imagen del usuario
  }

  setUserEmail(userEmail: string): void {
    sessionStorage.setItem('UserEmail', userEmail);  // Guardar el correo del usuario
  }

  getUserEmail(): string | null {
    return sessionStorage.getItem('UserEmail');  // Obtener el correo del usuario
  }

  setUserRol(userRol: string): void {
    sessionStorage.setItem('UserRol', userRol);  // Guardar el rol del usuario
  }

  getUserRol(): string | null {
    return sessionStorage.getItem('UserRol');  // Obtener el rol del usuario
  }

  setAccessToken(accessToken: string): void {
    sessionStorage.setItem('accessToken', accessToken);  // Guardar el token de acceso
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken');  // Obtener el token de acceso
  }
}
