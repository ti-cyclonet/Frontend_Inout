import { Injectable } from '@angular/core';

export type InoutRole = 'admin' | 'operator' | 'viewer';

/**
 * Service to check user permissions based on their role.
 * 
 * Roles hierarchy:
 * - admin: Full access
 * - operator: Create, Read, Update (no Delete, no Config)
 * - viewer: Read-only
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionsService {

  get currentRole(): InoutRole {
    if (typeof window === 'undefined') return 'viewer';
    const role = sessionStorage.getItem('user_rol') || '';
    return this.normalizeRole(role);
  }

  get isAdmin(): boolean {
    return this.currentRole === 'admin';
  }

  get isOperator(): boolean {
    return this.currentRole === 'operator';
  }

  get isViewer(): boolean {
    return this.currentRole === 'viewer';
  }

  /** Can create new records */
  get canCreate(): boolean {
    return this.currentRole === 'admin' || this.currentRole === 'operator';
  }

  /** Can edit/update existing records */
  get canEdit(): boolean {
    return this.currentRole === 'admin' || this.currentRole === 'operator';
  }

  /** Can delete records */
  get canDelete(): boolean {
    return this.currentRole === 'admin';
  }

  /** Can access configuration/settings */
  get canConfigure(): boolean {
    return this.currentRole === 'admin';
  }

  /** Can manage users */
  get canManageUsers(): boolean {
    return this.currentRole === 'admin';
  }

  /** Can export data */
  get canExport(): boolean {
    return this.currentRole === 'admin' || this.currentRole === 'operator';
  }

  /** Check if user has one of the given roles */
  hasRole(...roles: InoutRole[]): boolean {
    return roles.includes(this.currentRole);
  }

  private normalizeRole(role: string): InoutRole {
    const roleMap: Record<string, InoutRole> = {
      'adminInout': 'admin',
      'operatorInout': 'operator',
      'viewerInout': 'viewer',
      'admin': 'admin',
      'operator': 'operator',
      'viewer': 'viewer',
    };
    return roleMap[role] || 'viewer';
  }
}
