import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
})
export class UserFormComponent {
  @Output() userCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();

  currentStep = 1;
  totalSteps = 2;
  saving = false;
  userExists = false;
  loadedUserData: any = null;
  
  userForm: FormGroup;
  basicDataForm: FormGroup;
  documentForm: FormGroup;
  naturalForm: FormGroup;
  legalForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private customersService: CustomersService
  ) {
    this.userForm = this.fb.group({
      strUserName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    });

    this.basicDataForm = this.fb.group({
      strPersonType: ['N', Validators.required],
    });

    this.documentForm = this.fb.group({
      strDocumentType: ['CC', Validators.required],
      strDocumentNumber: ['', Validators.required],
      strDocumentDV: [''],
    });

    this.naturalForm = this.fb.group({
      firstName: ['', Validators.required],
      secondName: [''],
      firstSurname: ['', Validators.required],
      secondSurname: [''],
      birthDate: ['', Validators.required],
      maritalStatus: ['', Validators.required],
      sex: ['', Validators.required],
      phone: [''],
    });

    this.legalForm = this.fb.group({
      businessName: ['', Validators.required],
      webSite: [''],
      contactName: ['', Validators.required],
      contactEmail: ['', Validators.required],
      contactPhone: ['', Validators.required],
    });

    this.basicDataForm.get('strPersonType')?.valueChanges.subscribe(personType => {
      if (personType === 'J') {
        this.documentForm.patchValue({ strDocumentType: 'NIT' });
        this.documentForm.get('strDocumentType')?.disable();
        this.documentForm.get('strDocumentNumber')?.setValidators([Validators.required, Validators.pattern(/^\d{9}$/)]);
        this.documentForm.get('strDocumentDV')?.setValidators([Validators.required, Validators.pattern(/^\d{1}$/)]);
      } else {
        this.documentForm.get('strDocumentType')?.enable();
        this.documentForm.patchValue({ strDocumentType: 'CC' });
        this.documentForm.get('strDocumentNumber')?.setValidators([Validators.required]);
        this.documentForm.get('strDocumentDV')?.clearValidators();
      }
      this.documentForm.get('strDocumentNumber')?.updateValueAndValidity();
      this.documentForm.get('strDocumentDV')?.updateValueAndValidity();
    });
  }

  nextStep() {
    if (this.currentStep === 1) {
      this.createUser();
    } else {
      this.currentStep++;
    }
  }

  previousStep() {
    this.currentStep--;
  }

  isStepValid(step: number): boolean {
    if (step === 1) return this.userForm.valid;
    if (step === 2) {
      const isDocValid = this.documentForm.valid;
      const isPersonValid = this.basicDataForm.value.strPersonType === 'N' 
        ? this.naturalForm.valid 
        : this.legalForm.valid;
      return isDocValid && isPersonValid;
    }
    return true;
  }

  createUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const userName = this.userForm.value.strUserName;
    
    this.customersService.getUserByEmail(userName).subscribe({
      next: (userData) => {
        if (userData) {
          this.userExists = true;
          this.loadedUserData = userData;
          this.populateFormWithUserData(userData);
          this.currentStep++;
        } else {
          this.userExists = false;
          this.currentStep++;
        }
      },
      error: () => {
        this.userExists = false;
        this.currentStep++;
      },
    });
  }

  populateFormWithUserData(userData: any) {
    if (userData.basicData) {
      this.basicDataForm.patchValue({
        strPersonType: userData.basicData.strPersonType || 'N'
      });
    }

    if (userData.documentType) {
      this.documentForm.patchValue({
        strDocumentType: userData.documentType.strDocumentType || 'CC',
        strDocumentNumber: userData.documentType.strDocumentNumber || ''
      });
    }

    if (userData.naturalPersonData) {
      this.naturalForm.patchValue({
        firstName: userData.naturalPersonData.firstName || '',
        secondName: userData.naturalPersonData.secondName || '',
        firstSurname: userData.naturalPersonData.firstSurname || '',
        secondSurname: userData.naturalPersonData.secondSurname || '',
        birthDate: userData.naturalPersonData.birthDate || '',
        maritalStatus: userData.naturalPersonData.maritalStatus || '',
        sex: userData.naturalPersonData.sex || '',
        phone: userData.naturalPersonData.phone || ''
      });
    }

    if (userData.legalEntityData) {
      this.legalForm.patchValue({
        businessName: userData.legalEntityData.businessName || '',
        webSite: userData.legalEntityData.webSite || '',
        contactName: userData.legalEntityData.contactName || '',
        contactEmail: userData.legalEntityData.contactEmail || '',
        contactPhone: userData.legalEntityData.contactPhone || ''
      });
    }
  }

  onSubmit() {
    if (!this.isStepValid(2)) {
      this.basicDataForm.markAllAsTouched();
      this.documentForm.markAllAsTouched();
      if (this.basicDataForm.value.strPersonType === 'N') {
        this.naturalForm.markAllAsTouched();
      } else {
        this.legalForm.markAllAsTouched();
      }
      return;
    }

    this.saving = true;

    if (this.userExists && this.loadedUserData) {
      const dto = {
        userId: this.userForm.value.strUserName,
        tenantId: sessionStorage.getItem('tenant_id') || '1'
      };
      
      this.customersService.createCustomer(dto).subscribe({
        next: () => {
          this.saving = false;
          this.userCreated.emit();
        },
        error: (err) => {
          console.error('Error creating customer:', err);
          this.saving = false;
        },
      });
    } else {
      const dto: any = {
        user: {
          ...this.userForm.value,
          strStatus: 'UNCONFIRMED',
        },
        basicData: {
          ...this.basicDataForm.value,
          strStatus: 'ACTIVE',
        },
        documentType: {
          strDocumentType: this.basicDataForm.value.strPersonType === 'J' ? 'NIT' : this.documentForm.value.strDocumentType,
          strDocumentNumber: this.basicDataForm.value.strPersonType === 'J' 
            ? `${this.documentForm.value.strDocumentNumber}-${this.documentForm.value.strDocumentDV}`
            : this.documentForm.value.strDocumentNumber,
        },
        naturalPersonData: this.basicDataForm.value.strPersonType === 'N' ? this.naturalForm.value : undefined,
        legalEntityData: this.basicDataForm.value.strPersonType === 'J' ? this.legalForm.value : undefined,
      };

      this.customersService.createFullUser(dto).subscribe({
        next: () => {
          this.saving = false;
          this.userCreated.emit();
        },
        error: (err) => {
          console.error('Error creating user:', err);
          this.saving = false;
        },
      });
    }
  }

  cancel() {
    this.formCancelled.emit();
  }

  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (field?.hasError('required')) return 'Este campo es requerido';
    if (field?.hasError('pattern')) return 'Formato de correo inválido';
    if (field?.hasError('taken')) return 'Este correo ya está registrado';
    return '';
  }
}
