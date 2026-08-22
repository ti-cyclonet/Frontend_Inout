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

  /** Check if email exists as a real user in Authoriza */
  checkEmailExists(email: string): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/auth/check-email`, { email });
  }

  /** Get available roles for a contract */
  getRoleAvailability(contractId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.authorizaUrl}/user-roles/availability/${contractId}`);
  }

  /** Get tenant's contract for InOut */
  getTenantContract(tenantId: string): Observable<any> {
    return this.http.get<any>(`${this.authorizaUrl}/contracts/tenant/${tenantId}/limits?application=Inout`);
  }

  createFullUser(dto: any): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/users/full`, dto);
  }

  createUserDependency(principalUserId: string, dependentUserId: string): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/user-dependencies`, {
      principalUserId,
      dependentUserId,
      status: 'ACTIVE',
    });
  }

  /** Get roles assigned to a user */
  getUserRoles(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.authorizaUrl}/user-roles/user/${userId}`);
  }

  /** Assign a role to a user for a contract */
  assignRole(userId: string, roleId: string, contractId: string): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/user-roles`, {
      userId,
      roleId,
      contractId,
      status: 'ACTIVE',
    });
  }

  /** Remove a role from a user */
  removeRole(userId: string, roleId: string, contractId: string): Observable<any> {
    return this.http.delete<any>(`${this.authorizaUrl}/user-roles/${userId}/${roleId}`);
  }
}