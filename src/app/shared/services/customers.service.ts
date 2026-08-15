import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Customer, CustomerWithDetails, CreateCustomerDto } from '../model/customer.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomersService {
  private apiUrl = `${environment.apiUrl}/customers`;
  private authorizaUrl = `${environment.auth.authorizaUrl}`;

  constructor(private http: HttpClient) { }

  createCustomer(customer: CreateCustomerDto): Observable<Customer> {
    return this.http.post<Customer>(this.apiUrl, customer);
  }

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.apiUrl);
  }

  getCustomersWithDetails(): Observable<CustomerWithDetails[]> {
    return this.http.get<CustomerWithDetails[]>(`${this.apiUrl}/with-details`);
  }

  getCustomerById(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/${id}`);
  }

  removeCustomer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getUserByEmail(email: string): Observable<any> {
    return this.http.get<any>(`${this.authorizaUrl}/potential-users/by-email/${email}`);
  }

  createFullUser(dto: any): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/potential-users/full`, dto);
  }
}