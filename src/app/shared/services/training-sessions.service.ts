import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TrainingSession {
  strId: string;
  strTenantId: string;
  strCode: string;
  strTitle: string;
  strDescription?: string;
  strInstructor?: string;
  dtmDate: string;
  intDurationMinutes: number;
  intAttendees: number;
  strStatus: string;
  strNotes?: string;
  dtmCreationDate: string;
  dtmUpdateDate: string;
}

export interface CreateTrainingSessionDto {
  strTitle: string;
  strDescription?: string;
  strInstructor?: string;
  dtmDate: string;
  intDurationMinutes?: number;
  intAttendees?: number;
  strStatus?: string;
  strNotes?: string;
}

export interface TrainingSessionsResponse {
  data: TrainingSession[];
  total: number;
  limit: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingSessionsService {
  private apiUrl = `${environment.apiUrl}/training-sessions`;

  constructor(private http: HttpClient) {}

  findAll(page = 1, limit = 10): Observable<TrainingSessionsResponse> {
    return this.http.get<TrainingSessionsResponse>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }

  findOne(id: string): Observable<TrainingSession> {
    return this.http.get<TrainingSession>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateTrainingSessionDto): Observable<TrainingSession> {
    return this.http.post<TrainingSession>(this.apiUrl, dto);
  }

  update(id: string, dto: Partial<CreateTrainingSessionDto>): Observable<TrainingSession> {
    return this.http.patch<TrainingSession>(`${this.apiUrl}/${id}`, dto);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
