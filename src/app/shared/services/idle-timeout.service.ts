import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class IdleTimeoutService {
  private timeoutId: any;
  /** Cierre de sesión tras 5 minutos sin actividad. */
  private readonly idleTime = 5 * 60 * 1000;
  private isBrowser: boolean;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.resetTimer = this.resetTimer.bind(this);

    if (this.isBrowser) {
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.stopWatching();
          this.startWatching();
        }
      });
    }
  }

  startWatching(): void {
    if (!this.isBrowser) return;
    
    // No activar timeout para rutas públicas del marketplace
    if (this.router.url.includes('/marketplace/') && this.router.url.length > '/marketplace/'.length) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.resetTimer);
      document.addEventListener('keydown', this.resetTimer);
      document.addEventListener('click', this.resetTimer);
      document.addEventListener('touchstart', this.resetTimer);
      // Desplazarse también es actividad (leer una lista larga con la rueda)
      document.addEventListener('wheel', this.resetTimer, { passive: true });
      document.addEventListener('scroll', this.resetTimer, { passive: true, capture: true });
    });

    this.startTimer();
  }

  stopWatching(): void {
    if (!this.isBrowser) return;

    document.removeEventListener('mousemove', this.resetTimer);
    document.removeEventListener('keydown', this.resetTimer);
    document.removeEventListener('click', this.resetTimer);
    document.removeEventListener('touchstart', this.resetTimer);
    document.removeEventListener('wheel', this.resetTimer);
    document.removeEventListener('scroll', this.resetTimer, { capture: true });
    clearTimeout(this.timeoutId);
  }

  private startTimer(): void {
    this.timeoutId = setTimeout(() => {
      this.handleLogout();
    }, this.idleTime);
  }

  private resetTimer(): void {
    clearTimeout(this.timeoutId);
    this.startTimer();
  }

  private handleLogout(): void {
    this.stopWatching();
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
}
