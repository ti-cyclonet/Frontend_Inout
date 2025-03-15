import { Component, EventEmitter, Inject, Input, OnInit, Output, PLATFORM_ID } from '@angular/core';
import { DESCRIPTION_APP } from '../../../config/config';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  providers: [AuthService]
})
export class HeaderComponent implements OnInit{
  userName: string | null = null;
  userEmail: string | null = null;
  userRol: string | null = null;
  userImage: string | null = null;
  private _isSidebarVisible: boolean = false;

  @Input() 
  set isSidebarVisible(value: boolean) {
    this._isSidebarVisible = value;
  }
  get isSidebarVisible(): boolean {
    return this._isSidebarVisible;
  }

  @Output() sidebarToggle = new EventEmitter<void>();

  nombreApp = DESCRIPTION_APP;

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private authService: AuthService, private router: Router ) {}
  
  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { 
      this.userName = sessionStorage.getItem('user_name');
      this.userEmail = sessionStorage.getItem('user_email');
      this.userRol = sessionStorage.getItem('user_rol');
      this.userImage = sessionStorage.getItem('user_image');
    }
  }

  onToggleSidebar(): void {
    this._isSidebarVisible = !this._isSidebarVisible;
    this.sidebarToggle.emit(); 
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
        sessionStorage.clear();
    }

    this.router.navigate(['/login']).then(() => {
        console.log('Sesión cerrada correctamente');
        setTimeout(() => {
            window.location.reload();
        }, 100);
    });
}

  
}
