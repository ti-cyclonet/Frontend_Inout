import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialsDemoComponent } from './materials-demo.component';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [CommonModule, MaterialsDemoComponent],
  template: `<app-materials-demo></app-materials-demo>`,
  styles: []
})
export class MaterialsComponent {}