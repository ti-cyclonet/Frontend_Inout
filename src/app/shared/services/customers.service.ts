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

  /** Clientes potenciales (invitados del MarketPlace) del negocio en sesión. */
  getPotentialCustomers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.authorizaUrl}/potential-users/mine`);
  }

  getUserByEmail(email: string): Observable<any> {
    return this.http.get<any>(`${this.authorizaUrl}/potential-users/by-email/${email}`);
  }

  /** Check if email exists as a real user in Authoriza */
  checkEmailExists(email: string): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/auth/check-email`, { email });
  }

  /** Resumen de identidad (nombre/documento) de un usuario existente en
   * Authoriza, para precargar el formulario y solo pedir el rol a asignar.
   * A diferencia de checkEmailExists (público), este requiere sesión. */
  getUserDetailsByEmail(email: string): Observable<any> {
    return this.http.get<any>(`${this.authorizaUrl}/users/lookup-by-email`, { params: { email } });
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

  /**
   * Crea un usuario dependiente del tenant en sesión (proceso completo de
   * Authoriza: User + BasicData + datos de persona), vinculado como
   * dependiente y con un rol asignado. El backend valida el cupo del rol
   * contra el plan contratado y deriva el tenant/contrato del JWT del admin
   * en sesión (no hace falta enviarlos).
   */
  createDependentUser(dto: any): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/users/dependents`, dto);
  }

  /** Dependientes activos del tenant en sesión, con su rol vigente en un contrato. */
  getDependentsWithRoles(principalUserId: string, contractId?: string): Observable<any[]> {
    const query = contractId ? `?contractId=${contractId}` : '';
    return this.http.get<any[]>(`${this.authorizaUrl}/user-dependencies/principal/${principalUserId}/roles${query}`);
  }

  /** Desactiva la relación de dependencia (el usuario deja de ser parte del equipo del tenant). */
  deactivateDependency(dependencyId: string): Observable<any> {
    return this.http.patch<any>(`${this.authorizaUrl}/user-dependencies/${dependencyId}/deactivate`, {});
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

  /** Assign a role to a user for a contract — valida cupo del plan y aplica la cascada adminInout -> adminInvoices. */
  assignRole(userId: string, roleId: string, contractId: string): Observable<any> {
    return this.http.post<any>(`${this.authorizaUrl}/user-roles/assign`, {
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

  /** Marca/desmarca a un dependiente como firmante autorizado. */
  updateSigner(dependencyId: string, isAuthorizedSigner: boolean): Observable<any> {
    return this.http.patch<any>(`${this.authorizaUrl}/user-dependencies/${dependencyId}/signer`, { isAuthorizedSigner });
  }
}