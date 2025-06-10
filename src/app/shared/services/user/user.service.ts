import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = '/api/users';

  // Crear un BehaviorSubject para almacenar los usuarios
  private usersSubject = new BehaviorSubject<any[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Método para obtener los usuarios desde el servidor
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Método para cargar los usuarios y actualizar el BehaviorSubject
  loadUsers(): void {
    this.getUsers().subscribe({
      next: (users) => {
        this.usersSubject.next(users); // Actualiza el BehaviorSubject
      },
      error: (error) => {
        console.error('Error al cargar usuarios', error);
      },
    });
  }

  // Método para acceder a los usuarios actuales
  getCurrentUsers(): any[] {
    return this.usersSubject.getValue();
  }

  changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Observable<any> {
    return this.http.post(`/api/users/${userId}/change-password`, {
      oldPassword,
      newPassword,
    });
  }
}
