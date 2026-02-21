import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ModuleService, ModuleType } from '../../services/module/module.service';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-module-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './module-selector.component.html',
  styleUrls: ['./module-selector.component.css'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('0.6s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerIn', [
      transition(':enter', [
        query('.module-card', [
          style({ opacity: 0, transform: 'translateY(50px) scale(0.9)' }),
          stagger(200, [
            animate('0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
              style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('cardHover', [
      state('idle', style({ transform: 'scale(1)' })),
      state('hovered', style({ transform: 'scale(1.02) translateY(-8px)' })),
      transition('idle <=> hovered', animate('0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'))
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('0.3s ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class ModuleSelectorComponent {
  hoveredCard: string | null = null;
  isLoading = false;
  selectedModuleName = '';
  logoPath: string = './assets/img/logo_inout_v11.png';

  constructor(
    private router: Router,
    private moduleService: ModuleService
  ) {}

  selectModule(moduleType: ModuleType) {
    if (moduleType === 'inventory') {
      Swal.fire({
        icon: 'info',
        title: 'Función en Construcción',
        html: `
          <div style="text-align: center;">
            <div style="font-size: 80px; margin: 20px 0;">🚧</div>
            <p style="font-size: 16px; color: #666;">El módulo de Inventario está actualmente en desarrollo.</p>
          </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#5b6dff'
      });
      return;
    }
    
    this.isLoading = true;
    this.selectedModuleName = 'Manufactura';
    
    // Simular carga y transición suave
    setTimeout(() => {
      this.moduleService.setCurrentModule(moduleType);
      this.router.navigate(['/home']);
    }, 1500);
  }
}