import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MaterialsService {
  private apiUrl = '/api/applications'; // URL del backend

  constructor(private http: HttpClient) {}

  // Obtener materiales
  getMaterials(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // 🔹 Agregar el método deleteMaterial()
  deleteMaterial(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}