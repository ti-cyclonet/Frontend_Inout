import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MaterialService } from '../../../shared/services/material.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { CategoryService, Category } from '../../../shared/services/category/category.service';
import { Material, MaterialImage } from '../../../shared/models/material.model';
import { ImageManagerComponent } from '../../../shared/components/image-manager/image-manager.component';

@Component({
  selector: 'app-material-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ImageManagerComponent],
  templateUrl: './material-form.component.html',
  styleUrls: ['./material-form.component.css']
})
export class MaterialFormComponent implements OnInit {
  @Input() materialId?: number;
  @Input() isModal = false;
  @Output() materialCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();

  materialForm: FormGroup;
  loading = false;
  saving = false;
  currentStep = 1;
  totalSteps = 4; // Increased to include images step
  isEditMode = false;
  materialImages: MaterialImage[] = [];
  categories: Category[] = [];
  showCategoryForm = false;
  useDifferentDischargeUnit = false;
  newCategory = {
    name: '',
    code: '',
    description: ''
  };

  constructor(
    private fb: FormBuilder,
    private materialService: MaterialService,
    private categoryService: CategoryService,
    private notificationService: NotificationService,
    private router: Router
  ) {
    this.materialForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadCategories();
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
      dischargeUnit: [''],
      categoryId: [null],
      
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

  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
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
        return true; // Category is optional
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
      const materialData: any = {
        strName: formData.name,
        strDescription: formData.description,
        strUnitMeasure: formData.measurementUnit,
        strDischargeUnit: this.useDifferentDischargeUnit && formData.dischargeUnit ? formData.dischargeUnit : formData.measurementUnit,
        fltPrice: formData.price,
        ingMinStock: formData.stockMin,
        ingMaxStock: formData.stockMax,
        ingQuantity: formData.currentStock || 0,
        strLocation: formData.ubicacion,
        strStatus: formData.status,
        images: this.materialImages
      };

      // Solo agregar categoryId si hay una categoría seleccionada
      if (formData.categoryId) {
        materialData.categoryId = +formData.categoryId;
      }

      const operation = this.isEditMode 
        ? this.materialService.updateMaterial(this.materialId!, materialData as any)
        : this.materialService.createMaterial(materialData as any);

      operation.subscribe({
        next: (material) => {
          this.notificationService.success('¡Éxito!', 'Material guardado correctamente').then(() => {
            if (this.isModal) {
              this.materialCreated.emit();
            } else {
              this.router.navigate(['/materials']);
            }
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
    if (this.isModal) {
      this.formCancelled.emit();
    } else {
      console.log('Form cancelled');
    }
  }

  onImagesChange(images: MaterialImage[]): void {
    this.materialImages = images;
  }

  createCategory(): void {
    if (!this.newCategory.name) return;
    
    const categoryData = {
      name: this.newCategory.name,
      description: this.newCategory.description
    };
    
    this.categoryService.create(categoryData).subscribe({
      next: (category) => {
        this.categories.push(category);
        this.materialForm.patchValue({ categoryId: category.id });
        this.notificationService.success('¡Éxito!', 'Categoría creada correctamente');
        this.cancelCategoryForm();
      },
      error: (error) => {
        this.notificationService.error('Error', 'No se pudo crear la categoría');
        console.error('Error creating category:', error);
      }
    });
  }

  cancelCategoryForm(): void {
    this.showCategoryForm = false;
    this.newCategory = {
      name: '',
      code: '',
      description: ''
    };
  }
}