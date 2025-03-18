import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialsService } from '../../shared/services/materials/materials.service';
@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './materials.component.html',
  styleUrls: ['./materials.component.css']
})
export class MaterialsComponent implements OnInit {
  materials: any[] = [];
  selectedMaterial: any = null; 
  isModalOpen = false; 

  constructor(private materialsService: MaterialsService) {}

  ngOnInit(): void {
    this.materialsService.getMaterials().subscribe({
      next: (materials: any) => {
        this.materials = materials;
      },
      error: (e: any) => {
        console.error('Error loading materials:', e);
      }
    });
  }

  // Abre el modal para agregar un nuevo material
  openMaterialModal() {
    this.isModalOpen = true;
  }

  // Establece el material seleccionado para eliminar
  setSelectedMaterial(material: any) {
    this.selectedMaterial = material;
  }

  // Confirma la eliminación del material
  confirmDeleteMaterial() {
    if (this.selectedMaterial) {
      this.materialsService.deleteMaterial(this.selectedMaterial.id).subscribe({
        next: () => {
          this.materials = this.materials.filter(m => m.id !== this.selectedMaterial.id);
          this.selectedMaterial = null;
        },
        error: (error: any) => {
          console.error('Error deleting material:', error);
        }
      });
    }
  }  

  // Función trackBy para mejorar rendimiento en *ngFor
  trackById(index: number, material: any): number {
    return material.id;
  }
}