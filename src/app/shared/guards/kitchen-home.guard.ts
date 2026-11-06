import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Rol de Authoriza que solo usa la pantalla de preparación. */
export const KITCHEN_ROLE = 'kitchenInout';

export function isKitchenUser(): boolean {
  return typeof window !== 'undefined' && sessionStorage.getItem('user_rol') === KITCHEN_ROLE;
}

/**
 * El usuario de cocina solo tiene la pantalla de preparación: cualquier otra
 * página del panel lo lleva allá. (El backend además le cierra las demás rutas.)
 */
export const kitchenHomeGuard: CanActivateFn = () =>
  isKitchenUser() ? inject(Router).createUrlTree(['/cocina']) : true;
