import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { NAME_APP_SHORT } from '../../../config/config';
import { SessionService } from '../../services/sessions/session.service'; // Importar el servicio de sesión

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    FooterComponent,
    RouterOutlet,
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export default class LayoutComponent implements OnInit {
  optionsMenu: OptionMenu[] = [];
  isSidebarVisible = true;
  isLargeScreen = false;
  application: Application | undefined;

  // Propiedades para almacenar las variables de sesión
  userName: string | null = '';
  userImage: string | null = '';
  userEmail: string | null = '';
  userRol: string | null = '';
  accessToken: string | null = '';

  constructor(
    private applicationsService: ApplicationsService,
    private sessionService: SessionService // Inyectar el servicio de sesión
  ) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  ngOnInit(): void {
    // Establecer las variables de sesión si no están ya definidas
    this.setSessionData();

    // Obtener las variables de sesión del servicio
    this.userName = this.sessionService.getUserName();
    this.userImage = this.sessionService.getUserImage();
    this.userEmail = this.sessionService.getUserEmail();
    this.userRol = this.sessionService.getUserRol();
    this.accessToken = this.sessionService.getAccessToken();

    // Obtener la aplicación
    this.fetchApplication(NAME_APP_SHORT);
  }

  // Establecer las variables de sesión
  setSessionData(): void {
    if (!this.sessionService.getUserName()) {
      this.sessionService.setUserName('Juan Pérez');
      this.sessionService.setUserImage('url_de_imagen_usuario.jpg');
      this.sessionService.setUserEmail('juan.perez@ejemplo.com');
      this.sessionService.setUserRol('Admin');
      this.sessionService.setAccessToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InJvbGUiOiJBZG1pbiJ9');
    }
  }

  // Función para obtener la aplicación
  fetchApplication(name: string): void {
    this.applicationsService.getApplicationByName(name).subscribe(
      (app) => {
        if (!app) {
          console.error('Aplicación no encontrada');
          return;
        }

        this.application = app;

        // Validamos que strRoles y strMenuOptions existen antes de mapear
        this.optionsMenu = this.application?.strRoles?.flatMap(role =>
          role?.menuOptions?.map(menu => ({
            id: menu?.id ?? '',
            name: menu?.strName ?? 'Unnamed Menu',
            description: menu?.strDescription ?? '',
            url: menu?.strUrl ?? '#',
            icon: menu?.strIcon ?? 'default-icon',
            type: menu?.strType ?? 'main_menu',
            idMPather: null,
            order: menu?.ingOrder ?? '99',
            idApplication: this.application?.id ?? '',
          })) || []
        ) || [];
      },
      (error) => {
        console.error('Error fetching application:', error);
      }
    );
  }

  toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }
}
