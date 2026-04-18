import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = '/api/users';
  private authorizaUrl = environment.auth.authorizaUrl;

  private usersSubject = new BehaviorSubject<any[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor(private http: HttpClient) {}

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  loadUsers(): void {
    this.getUsers().subscribe({
      next: (users) => {
        this.usersSubject.next(users);
      },
      error: (error) => {
        console.error('Error al cargar usuarios', error);
      },
    });
  }

  getCurrentUsers(): any[] {
    return this.usersSubject.getValue();
  }

  changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Observable<any> {
    return this.http.post(`${this.authorizaUrl}/users/${userId}/change-password`, {
      oldPassword,
      newPassword,
    });
  }
}
