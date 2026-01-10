import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ModuleType = 'inventory' | 'manufacturing';

export interface ModuleConfig {
  name: string;
  displayName: string;
  color: string;
  icon: string;
  routes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ModuleService {
  private currentModuleSubject = new BehaviorSubject<ModuleType | null>(null);
  public currentModule$ = this.currentModuleSubject.asObservable();

  private moduleConfigs: Record<ModuleType, ModuleConfig> = {
    inventory: {
      name: 'inventory',
      displayName: 'INVENTARIO',
      color: '#0057B8',
      icon: 'boxes',
      routes: ['/warehouses', '/locations', '/movements', '/reports-inventory']
    },
    manufacturing: {
      name: 'manufacturing',
      displayName: 'MANUFACTURA',
      color: '#FF6600',
      icon: 'gear-fill',
      routes: ['/materials', '/products', '/menus', '/sales', '/costs', '/reports-manufacturing']
    }
  };

  constructor() {
    // Cargar módulo desde sessionStorage al inicializar
    const savedModule = sessionStorage.getItem('selectedModule') as ModuleType;
    if (savedModule && this.moduleConfigs[savedModule]) {
      this.currentModuleSubject.next(savedModule);
    }
  }

  setCurrentModule(module: ModuleType): void {
    sessionStorage.setItem('selectedModule', module);
    this.currentModuleSubject.next(module);
  }

  getCurrentModule(): ModuleType | null {
    return this.currentModuleSubject.value;
  }

  getModuleConfig(module: ModuleType): ModuleConfig {
    return this.moduleConfigs[module];
  }

  getAllModuleConfigs(): Record<ModuleType, ModuleConfig> {
    return this.moduleConfigs;
  }

  clearModule(): void {
    sessionStorage.removeItem('selectedModule');
    this.currentModuleSubject.next(null);
  }
}