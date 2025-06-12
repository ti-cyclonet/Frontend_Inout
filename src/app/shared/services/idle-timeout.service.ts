import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class IdleTimeoutService {
  private timeoutId: any;
  private readonly idleTime = 3 * 60 * 1000;
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

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.resetTimer);
      document.addEventListener('keydown', this.resetTimer);
      document.addEventListener('click', this.resetTimer);
      document.addEventListener('touchstart', this.resetTimer);
    });

    this.startTimer();
  }

  stopWatching(): void {
    if (!this.isBrowser) return;

    document.removeEventListener('mousemove', this.resetTimer);
    document.removeEventListener('keydown', this.resetTimer);
    document.removeEventListener('click', this.resetTimer);
    document.removeEventListener('touchstart', this.resetTimer);
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
    this.ngZone.run(() => this.router.navigate(['/login']));
  }
}
