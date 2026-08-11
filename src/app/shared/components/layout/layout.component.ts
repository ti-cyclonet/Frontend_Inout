import { Component, HostListener, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarListComponent } from '../sidebar-list/sidebar-list.component';
import { RouterModule, RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { ModuleService, ModuleType } from '../../services/module/module.service';
import { UsageStatusService } from '../../services/usage-status.service';
import { UsageWarning } from '../../model/usage-status.model';
import { NAME_APP_SHORT } from '../../../config/config';


@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    SidebarListComponent,
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
  sidebarStyle: 'lateral' | 'list' = 'lateral';
  application: Application | undefined;
  currentModule: ModuleType | null = null;

  // Usage limit warnings
  usageWarnings: UsageWarning[] = [];
  showUsageBanner = false;

  constructor(
    private applicationsService: ApplicationsService,
    private moduleService: ModuleService,
    private usageStatusService: UsageStatusService
  ) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
    }
  }

  ngOnInit(): void {
    this.loadSidebarPreference();
    this.loadUsageWarnings();
    
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
            description: this.translateMenuDescription(menu?.strDescription ?? ''),
            url: menu?.strUrl ?? '#',
            icon: menu?.strIcon ?? 'default-icon',
            type: menu?.strType ?? 'main_menu',
            idMPather: null,
            order: menu?.ingOrder !== undefined && menu?.ingOrder !== null ? menu.ingOrder.toString() : '99',
            idApplication: this.application?.id ?? '',
          })) || []
        ) || [];

        // Agregar enlace estático de Módulo Comercial (Ventas + Pedidos + Clientes unificado)
        const commercialEntry: OptionMenu = {
          id: 'commercial',
          name: 'Comercial',
          description: 'Ventas, Pedidos y Clientes',
          url: '/commercial',
          icon: 'shop',
          type: 'main_menu',
          idMPather: null,
          order: '45',
          idApplication: this.application?.id ?? '',
        };
        if (!this.optionsMenu.some(m => m.id === commercialEntry.id)) {
          this.optionsMenu.push(commercialEntry);
        }

        // Agregar enlace estático de Consumos (panel de uso de paquete)
        const consumosEntry: OptionMenu = {
          id: 'usage-panel',
          name: 'Consumos',
          description: 'Consumos',
          url: '/consumos',
          icon: 'bar-chart',
          type: 'main_menu',
          idMPather: null,
          order: '90',
          idApplication: this.application?.id ?? '',
        };
        if (!this.optionsMenu.some(m => m.id === consumosEntry.id)) {
          this.optionsMenu.push(consumosEntry);
        }

        // Ordenar por ingOrder numérico
        this.optionsMenu.sort((a, b) => parseInt(a.order) - parseInt(b.order));
      },
      (error) => {
      }
    );
  }

  // Traducir nombres de menú que vienen en inglés desde Authoriza
  private translateMenuDescription(description: string): string {
    const translations: Record<string, string> = {
      'Dashboard': 'Inicio',
      'Materials': 'Materiales',
      'Products': 'Productos',
      'Sales': 'Ventas',
      'Settings': 'Configuración',
      'Warehouses': 'Almacenes',
      'Locations': 'Ubicaciones',
      'Movements': 'Movimientos',
      'Commercial': 'Comercial',
    };
    return translations[description] || description;
  }

  // Determinar si un menú pertenece al módulo actual
  private isMenuForModule(url: string, module: ModuleType): boolean {
    const moduleConfig = this.moduleService.getModuleConfig(module);
    
    // Ocultar módulos que ahora están integrados en el módulo Comercial
    if (url.includes('user') || url.includes('sale') || url.includes('customer')) {
      return false;
    }
    
    if (module === 'inventory') {
      // Inventario: materiales, kardex, home. NO productos ni composición.
      return url.includes('material') || url.includes('kardex') || url === '/home';
    } else if (module === 'manufacturing') {
      // Manufactura: materiales, productos, home.
      return url.includes('material') || url.includes('product') || 
             url.includes('cost') || url.includes('manufacturing') || 
             url === '/home';
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
      const storedStyle = localStorage.getItem('sidebarStyle');
      this.sidebarStyle = (storedStyle === 'list') ? 'list' : 'lateral';
    }
  }

  // Usage warnings
  loadUsageWarnings(): void {
    this.usageStatusService.getUsageWarnings().subscribe({
      next: (response) => {
        this.usageWarnings = response.warnings || [];
        this.showUsageBanner = this.usageWarnings.length > 0;
      },
      error: () => {
        this.usageWarnings = [];
        this.showUsageBanner = false;
      }
    });
  }

  dismissUsageBanner(): void {
    this.showUsageBanner = false;
  }

  isListHiding = false;

  toggleSidebar() {
    if (this.sidebarStyle === 'list' && this.isSidebarVisible) {
      this.hideSidebarList();
    } else {
      this.isSidebarVisible = !this.isSidebarVisible;
      if (typeof window !== 'undefined' && localStorage) {
        localStorage.setItem('sidebarVisible', JSON.stringify(this.isSidebarVisible));
      }
    }
  }

  hideSidebarList() {
    this.isListHiding = true;
    setTimeout(() => {
      this.isListHiding = false;
      this.isSidebarVisible = false;
      if (typeof window !== 'undefined' && localStorage) {
        localStorage.setItem('sidebarVisible', JSON.stringify(false));
      }
    }, 250);
  }

  setSidebarStyle(style: 'lateral' | 'list') {
    this.sidebarStyle = style;
    if (typeof window !== 'undefined' && localStorage) {
      localStorage.setItem('sidebarStyle', style);
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
      if (this.isLargeScreen && this.sidebarStyle === 'list') {
        this.sidebarStyle = 'lateral';
        this.isSidebarVisible = true;
        this.isListHiding = false;
        if (localStorage) {
          localStorage.setItem('sidebarStyle', 'lateral');
          localStorage.setItem('sidebarVisible', 'true');
        }
      }
    }
  }
}
