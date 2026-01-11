import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MaterialService } from '../../../shared/services/material.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { Material, MaterialImage } from '../../../shared/models/material.model';
import { ImageManagerComponent } from '../../../shared/components/image-manager/image-manager.component';

@Component({
  selector: 'app-material-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageManagerComponent],
  templateUrl: './material-form.component.html',
  styleUrls: ['./material-form.component.css']
})
export class MaterialFormComponent implements OnInit {
  @Input() materialId?: number;
  @Input() isModal = false;

  materialForm: FormGroup;
  loading = false;
  saving = false;
  currentStep = 1;
  totalSteps = 4; // Increased to include images step
  isEditMode = false;
  materialImages: MaterialImage[] = [];

  constructor(
    private fb: FormBuilder,
    private materialService: MaterialService,
    private notificationService: NotificationService,
    private router: Router
  ) {
    this.materialForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.materialId) {
      this.isEditMode = true;
      this.loadMaterial();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      // Step 1: Basic Information
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      measurementUnit: ['', Validators.required],
      
      // Step 2: Inventory
      price: [0, [Validators.required, Validators.min(0)]],
      stockMin: [0, [Validators.required, Validators.min(0)]],
      stockMax: [0, [Validators.required, Validators.min(1)]],
      currentStock: [0, [Validators.min(0)]],
      ubicacion: ['', Validators.required],
      
      // Step 3: Status
      status: ['active', Validators.required]
    });
  }

  loadMaterial(): void {
    if (!this.materialId) return;
    
    this.loading = true;
    this.materialService.getMaterialById(this.materialId).subscribe({
      next: (material) => {
        if (material) {
          this.materialForm.patchValue(material);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading material:', error);
        this.loading = false;
      }
    });
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return this.materialForm.get('name')?.valid && 
               this.materialForm.get('description')?.valid && 
               this.materialForm.get('measurementUnit')?.valid || false;
      case 2:
        return this.materialForm.get('price')?.valid && 
               this.materialForm.get('stockMin')?.valid && 
               this.materialForm.get('stockMax')?.valid && 
               this.materialForm.get('ubicacion')?.valid || false;
      case 3:
        return this.materialForm.get('status')?.valid || false;
      case 4:
        return true; // Images are optional
      default:
        return false;
    }
  }

  onSubmit(): void {
    if (this.materialForm.valid) {
      this.saving = true;
      const formData = this.materialForm.value;

      // Mapear campos del frontend al backend
      const materialData = {
        strName: formData.name,
        strDescription: formData.description,
        strUnitMeasure: formData.measurementUnit,
        fltPrice: formData.price,
        ingMinStock: formData.stockMin,
        ingMaxStock: formData.stockMax,
        ingQuantity: formData.currentStock || 0,
        strLocation: formData.ubicacion,
        strStatus: formData.status,
        images: this.materialImages // Agregar imágenes al DTO
      };

      const operation = this.isEditMode 
        ? this.materialService.updateMaterial(this.materialId!, materialData as any)
        : this.materialService.createMaterial(materialData as any);

      operation.subscribe({
        next: (material) => {
          this.notificationService.success('¡Éxito!', 'Material guardado correctamente').then(() => {
            this.router.navigate(['/materials']);
          });
          this.saving = false;
        },
        error: (error) => {
          this.notificationService.error('Error', 'No se pudo guardar el material');
          console.error('Error saving material:', error);
          this.saving = false;
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  markFormGroupTouched(): void {
    Object.keys(this.materialForm.controls).forEach(key => {
      const control = this.materialForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.materialForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['min']) return `${fieldName} must be greater than or equal to ${field.errors['min'].min}`;
    }
    return '';
  }

  cancel(): void {
    // Navigate back or emit cancel event
    console.log('Form cancelled');
  }

  onImagesChange(images: MaterialImage[]): void {
    this.materialImages = images;
  }
}