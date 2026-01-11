import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialService } from '../../../shared/services/material.service';
import { Material, MaterialComposition } from '../../../shared/models/material.model';

@Component({
  selector: 'app-material-composition',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './material-composition.component.html',
  styleUrls: ['./material-composition.component.css']
})
export class MaterialCompositionComponent implements OnInit {
  @Input() materialId?: number;
  
  compositions: MaterialComposition[] = [];
  availableMaterials: Material[] = [];
  loading = false;
  saving = false;
  
  // Form state
  selectedMaterialId: number | null = null;
  quantity: number = 1;
  showAddForm = false;

  constructor(private materialService: MaterialService) {}

  ngOnInit(): void {
    this.loadAvailableMaterials();
    if (this.materialId) {
      this.loadCompositions();
    }
  }

  loadAvailableMaterials(): void {
    this.materialService.getMaterials().subscribe({
      next: (response) => {
        this.availableMaterials = response.data.filter(m => m.id !== this.materialId);
      },
      error: (error) => {
        console.error('Error loading materials:', error);
      }
    });
  }

  loadCompositions(): void {
    if (!this.materialId) return;
    
    this.loading = true;
    this.materialService.getMaterialComposition(this.materialId).subscribe({
      next: (compositions) => {
        this.compositions = compositions;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading compositions:', error);
        this.compositions = [];
        this.loading = false;
      }
    });
  }

  addComponent(): void {
    if (!this.selectedMaterialId || this.quantity <= 0) return;

    const componentMaterial = this.availableMaterials.find(m => m.id === this.selectedMaterialId);
    if (!componentMaterial) return;

    const newComposition: MaterialComposition = {
      id: Date.now(),
      materialId: this.materialId!,
      componentMaterialId: this.selectedMaterialId,
      quantity: this.quantity,
      componentMaterial
    };

    this.compositions.push(newComposition);
    this.resetForm();
  }

  removeComponent(composition: MaterialComposition): void {
    const index = this.compositions.findIndex(c => c.id === composition.id);
    if (index > -1) {
      this.compositions.splice(index, 1);
    }
  }

  updateQuantity(composition: MaterialComposition, newQuantity: number): void {
    if (newQuantity > 0) {
      composition.quantity = newQuantity;
    }
  }

  resetForm(): void {
    this.selectedMaterialId = null;
    this.quantity = 1;
    this.showAddForm = false;
  }

  getTotalCost(): number {
    return this.compositions.reduce((total, comp) => {
      const materialCost = comp.componentMaterial?.price || 0;
      return total + (materialCost * comp.quantity);
    }, 0);
  }

  saveComposition(): void {
    if (!this.materialId) return;
    
    this.saving = true;
    this.materialService.updateMaterialComposition(this.materialId, this.compositions).subscribe({
      next: (updatedCompositions) => {
        this.compositions = updatedCompositions;
        this.saving = false;
        console.log('Composition saved successfully');
      },
      error: (error) => {
        console.error('Error saving composition:', error);
        this.saving = false;
      }
    });
  }

  getFilteredMaterials(): Material[] {
    return this.availableMaterials.filter(material => 
      !this.compositions.some(comp => comp.componentMaterialId === material.id)
    );
  }

  trackByCompositionId(index: number, composition: MaterialComposition): number {
    return composition.id;
  }
}