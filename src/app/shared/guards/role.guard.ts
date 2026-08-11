import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

/**
 * Role-based guard for InOut routes.
 * Usage in routes: canActivate: [AuthGuard, roleGuard('admin', 'operator')]
 */
export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return (route, state): boolean | UrlTree => {
    const router = inject(Router);

    if (typeof window === 'undefined') {
      return router.createUrlTree(['/home']);
    }

    const userRole = sessionStorage.getItem('user_rol') || '';
    const normalizedRole = normalizeRole(userRole);

    if (allowedRoles.includes(normalizedRole)) {
      return true;
    }

    // Redirect to home if unauthorized
    return router.createUrlTree(['/home']);
  };
}

/**
 * Normalize Authoriza role names to InOut internal roles.
 */
function normalizeRole(role: string): string {
  const roleMap: Record<string, string> = {
    'adminInout': 'admin',
    'operatorInout': 'operator',
    'viewerInout': 'viewer',
    'admin': 'admin',
    'operator': 'operator',
    'viewer': 'viewer',
  };
  return roleMap[role] || 'viewer';
}
