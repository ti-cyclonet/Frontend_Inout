import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { RouterModule, RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { NAME_APP_SHORT } from '../../../config/config';


@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    FooterComponent,
    RouterOutlet,
    RouterModule
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export default class LayoutComponent implements OnInit {
  optionsMenu: OptionMenu[] = [];
  isSidebarVisible = true;
  isLargeScreen = false;
  application: Application | undefined;

  constructor(
    private applicationsService: ApplicationsService
  ) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  ngOnInit(): void {
    this.loadSidebarPreference();
    this.fetchApplication(NAME_APP_SHORT);
  }

  // Función para obtener la aplicación
  fetchApplication(name: string): void {
    const userRol = sessionStorage.getItem('user_rol');  
    if (!userRol) {
      console.error('No se encontró el rol del usuario en la sesión');
      return;
    }
  
    this.applicationsService.getApplicationByNameAndRol(name, userRol).subscribe(
      (app) => {
        if (!app) {
          console.error('Aplicación no encontrada');
          return;
        }
  
        this.application = app;
  
        this.optionsMenu = this.application?.strRoles?.flatMap(rol =>
          rol?.menuOptions?.map(menu => ({
            id: menu?.id ?? '',
            name: menu?.strName ?? 'Unnamed Menu',
            description: menu?.strDescription ?? '',
            url: menu?.strUrl ?? '#',
            icon: menu?.strIcon ?? 'default-icon',
            type: menu?.strType ?? 'main_menu',
            idMPather: null,
            order: menu?.ingOrder !== undefined && menu?.ingOrder !== null ? menu.ingOrder.toString() : '99',
            idApplication: this.application?.id ?? '',
          })) || []
        ) || [];
      },
      (error) => {
        console.error('Error fetching application:', error);
      }
    );
  }

  loadSidebarPreference(): void {
    if (typeof window !== 'undefined' && localStorage) {
      const storedValue = localStorage.getItem('sidebarVisible');
      if (storedValue !== null) {
        this.isSidebarVisible = JSON.parse(storedValue);
      } else {
        this.isSidebarVisible = this.isLargeScreen;
      }
    }
  }

  toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;
    if (typeof window !== 'undefined' && localStorage) {
      localStorage.setItem('sidebarVisible', JSON.stringify(this.isSidebarVisible));
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }
}
