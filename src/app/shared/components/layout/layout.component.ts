import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { RouterModule, RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { ModuleService, ModuleType } from '../../services/module/module.service';
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
  currentModule: ModuleType | null = null;

  constructor(
    private applicationsService: ApplicationsService,
    private moduleService: ModuleService
  ) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  ngOnInit(): void {
    this.loadSidebarPreference();
    
    // Suscribirse a cambios de módulo
    this.moduleService.currentModule$.subscribe(module => {
      this.currentModule = module;
      if (module) {
        this.fetchApplicationForModule(NAME_APP_SHORT, module);
      }
    });
  }

  // Función para obtener la aplicación según el módulo
  fetchApplicationForModule(name: string, module: ModuleType): void {
    const userRol = sessionStorage.getItem('user_rol');  
    if (!userRol) {
      return;
    }
  
    this.applicationsService.getApplicationByNameAndRol(name, userRol).subscribe(
      (app) => {
        if (!app) {
          return;
        }
  
        this.application = app;
        
        // Filtrar menús según el módulo seleccionado
        const moduleConfig = this.moduleService.getModuleConfig(module);
        
        this.optionsMenu = this.application?.strRoles?.flatMap(rol =>
          rol?.menuOptions?.filter(menu => 
            this.isMenuForModule(menu.strUrl || '', module)
          ).map(menu => ({
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

        // Ordenar por ingOrder numérico
        this.optionsMenu.sort((a, b) => parseInt(a.order) - parseInt(b.order));
      },
      (error) => {
      }
    );
  }

  // Determinar si un menú pertenece al módulo actual
  private isMenuForModule(url: string, module: ModuleType): boolean {
    const moduleConfig = this.moduleService.getModuleConfig(module);
    
    // Ocultar temporalmente el módulo de usuarios
    if (url.includes('user')) {
      return false;
    }
    
    if (module === 'inventory') {
      return url.includes('warehouse') || url.includes('location') || url.includes('movement') || 
             url.includes('inventory') || url === '/home';
    } else if (module === 'manufacturing') {
      return url.includes('material') || url.includes('product') || url.includes('menu') || 
             url.includes('sale') || url.includes('cost') || url.includes('manufacturing') || 
             url === '/home'; // Clientes ahora están integrados en sales
    }
    
    return url === '/home' || url.includes('setup'); // Menús comunes
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
