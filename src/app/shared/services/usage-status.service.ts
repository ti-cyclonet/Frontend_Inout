import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UsageStatusResponse, UsageWarningsResponse } from '../model/usage-status.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsageStatusService {
  private apiUrl = `${environment.apiUrl}/usage-status`;

  constructor(private http: HttpClient) { }

  getUsageStatus(): Observable<UsageStatusResponse> {
    return this.http.get<UsageStatusResponse>(this.apiUrl);
  }

  getUsageWarnings(): Observable<UsageWarningsResponse> {
    return this.http.get<UsageWarningsResponse>(`${this.apiUrl}/warnings`);
  }

  recalibrateCounters(): Observable<{ tenantId: string; recalibrated: { variableName: string; previousCount: number; actualCount: number }[] }> {
    return this.http.post<any>(`${this.apiUrl}/recalibrate`, {});
  }
}
