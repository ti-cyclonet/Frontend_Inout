import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { OptionMenu } from '../../model/option_menu';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarListComponent } from '../sidebar-list/sidebar-list.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { RouterModule, RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { DeliveryRequestComponent } from '../../../feature/commercial/delivery/delivery-request.component';
import { Application } from '../../model/application.model';
import { ApplicationsService } from '../../services/applications/applications.service';
import { ModuleService, ModuleType } from '../../services/module/module.service';
import { UsageStatusService } from '../../services/usage-status.service';
import { UsageWarning } from '../../model/usage-status.model';
import { NAME_APP_SHORT } from '../../../config/config';


export type SidebarStyle = 'lateral' | 'list' | 'bottom';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    SidebarListComponent,
    BottomNavComponent,
    FooterComponent,
    RouterOutlet,
    RouterModule,
    DeliveryRequestComponent
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export default class LayoutComponent implements OnInit, OnDestroy {
  optionsMenu: OptionMenu[] = [];
  isSidebarVisible = true;
  isLargeScreen = false;
  /** lateral (predeterminado), list (lista a pantalla completa) o bottom (barra inferior tipo Kiri). list y bottom son solo para móvil. */
  sidebarStyle: SidebarStyle = 'lateral';
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

        // Agregar enlace estático de Módulo Comercial (Ventas + Pedidos unificado)
        const commercialEntry: OptionMenu = {
          id: 'commercial',
          name: 'Comercial',
          description: 'Ventas y Pedidos',
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

        // Combos y promociones (combos, kits armados y promociones)
        const combosEntry: OptionMenu = {
          id: 'combos-promotions',
          name: 'Combos',
          description: 'Combos y promociones',
          url: '/combos',
          icon: 'tags',
          type: 'main_menu',
          idMPather: null,
          order: '46',
          idApplication: this.application?.id ?? '',
        };
        if (!this.optionsMenu.some(m => m.id === combosEntry.id)) {
          this.optionsMenu.push(combosEntry);
        }

        // Agregar enlace de Almacenes solo en modo Inventario
        if (this.currentModule === 'inventory') {
          const inventoryEntry: OptionMenu = {
            id: 'inventory-mgmt',
            name: 'Almacenes',
            description: 'Almacenes',
            url: '/inventory',
            icon: 'building',
            type: 'main_menu',
            idMPather: null,
            order: '30',
            idApplication: this.application?.id ?? '',
          };
          if (!this.optionsMenu.some(m => m.id === inventoryEntry.id)) {
            this.optionsMenu.push(inventoryEntry);
          }
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

        // Agregar enlace de Usuarios (solo para administradores)
        const userRol = sessionStorage.getItem('user_rol') || '';
        if (userRol === 'adminInout') {
          const usersEntry: OptionMenu = {
            id: 'users-mgmt',
            name: 'Usuarios',
            description: 'Usuarios',
            url: '/users',
            icon: 'people',
            type: 'main_menu',
            idMPather: null,
            order: '85',
            idApplication: this.application?.id ?? '',
          };
          if (!this.optionsMenu.some(m => m.id === usersEntry.id)) {
            this.optionsMenu.push(usersEntry);
          }
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
      this.sidebarStyle = (storedStyle === 'list' || storedStyle === 'bottom') ? storedStyle : 'lateral';
      // list/bottom son estilos de móvil: en pantalla grande se usa el lateral
      if (this.isLargeScreen && this.sidebarStyle !== 'lateral') this.sidebarStyle = 'lateral';
    }
    this.syncBottomNavClass();
  }

  /** Barra inferior activa (solo móvil). */
  get showBottomNav(): boolean {
    return this.sidebarStyle === 'bottom' && !this.isLargeScreen;
  }

  /**
   * Marca el <body> mientras se usa la barra inferior, para que elementos
   * flotantes globales (FAB de Domicilios) se suban por encima de ella.
   */
  private syncBottomNavClass(): void {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('inout-bottom-nav', this.showBottomNav);
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') document.body.classList.remove('inout-bottom-nav');
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

  setSidebarStyle(style: SidebarStyle) {
    this.sidebarStyle = style;
    this.isListHiding = false;
    if (typeof window !== 'undefined' && localStorage) {
      localStorage.setItem('sidebarStyle', style);
    }
    this.syncBottomNavClass();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (typeof window !== 'undefined') {
      this.isLargeScreen = window.innerWidth >= 992;
      if (this.isLargeScreen && this.sidebarStyle !== 'lateral') {
        this.sidebarStyle = 'lateral';
        this.isSidebarVisible = true;
        this.isListHiding = false;
        if (localStorage) {
          localStorage.setItem('sidebarStyle', 'lateral');
          localStorage.setItem('sidebarVisible', 'true');
        }
      }
      this.syncBottomNavClass();
    }
  }
}
