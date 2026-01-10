import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModuleService, ModuleType } from '../../shared/services/module/module.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  currentModule: ModuleType | null = null;

  constructor(private moduleService: ModuleService) {}

  ngOnInit(): void {
    this.moduleService.currentModule$.subscribe(module => {
      this.currentModule = module;
    });
  }

  getModuleDisplayName(): string {
    if (!this.currentModule) return '';
    return this.moduleService.getModuleConfig(this.currentModule).displayName;
  }

  getModuleIcon(): string {
    if (!this.currentModule) return 'house-fill';
    return this.moduleService.getModuleConfig(this.currentModule).icon;
  }
}
