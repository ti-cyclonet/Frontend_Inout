import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { CreateCustomerDto } from '../../../shared/model/customer.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
})
export class UserFormComponent {
  @Output() userCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();

  currentStep = 1;
  totalSteps = 2;
  saving = false;
  checking = false;
  userExists = false;
  loadedUserData: any = null;
  availableRoles: any[] = [];
  contractId: string | null = null;
  selectedRoleId = '';
  
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
      birthDate: [''],
      maritalStatus: [''],
      sex: [''],
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

    // Load available roles for this tenant
    this.loadAvailableRoles();
  }

  loadAvailableRoles(): void {
    // Get tenantId from JWT token (the contract owner), not the logged-in user
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    if (!token) return;
    
    let tenantId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId || payload.basicDataId || null;
    } catch { return; }
    
    if (!tenantId) return;

    this.customersService.getTenantContract(tenantId).subscribe({
      next: (data: any) => {
        this.contractId = data.contractId;
        if (this.contractId) {
          this.customersService.getRoleAvailability(this.contractId).subscribe({
            next: (roles: any[]) => {
              // Only show roles with available slots (exclude adminInout — that's for the principal)
              this.availableRoles = roles.filter(r => r.available > 0 && r.role.strName !== 'adminInout');
            },
            error: () => { this.availableRoles = []; }
          });
        }
      },
      error: () => {}
    });
  }

  nextStep() {
    if (this.currentStep === 1) {
      this.validateAndProceed();
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

  validateAndProceed() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const email = this.userForm.value.strUserName;
    this.checking = true;

    // 1. Check if already exists as customer in InOut (duplicate local)
    this.customersService.getCustomersWithDetails().subscribe({
      next: (customers) => {
        const existingLocal = customers.find(c => c.email?.toLowerCase() === email.toLowerCase());
        if (existingLocal) {
          this.checking = false;
          this.userForm.get('strUserName')?.setErrors({ taken: true });
          return;
        }

        // 2. Check if exists in Authoriza (real user)
        this.customersService.checkEmailExists(email).subscribe({
          next: (data: any) => {
            this.checking = false;
            if (data.exists) {
              // User already exists in Authoriza — load their data
              this.userExists = true;
              this.loadedUserData = data;
              if (data.basicData) this.populateFormWithUserData(data);
              this.currentStep++;
            } else {
              // User doesn't exist — will be created fresh
              this.userExists = false;
              this.loadedUserData = null;
              this.currentStep++;
            }
          },
          error: () => {
            // If check fails, allow proceeding (user will be created)
            this.checking = false;
            this.userExists = false;
            this.currentStep++;
          }
        });
      },
      error: () => {
        this.checking = false;
        this.userExists = false;
        this.currentStep++;
      }
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
      // User already exists in Authoriza — just create local customer
      this.createLocalCustomerAndFinish();
    } else {
      // Create new user in Authoriza
      const dto: any = {
        user: {
          ...this.userForm.value,
          strStatus: 'ACTIVE',
        },
        basicData: {
          ...this.basicDataForm.value,
          strStatus: 'ACTIVE',
        },
        documentType: {
          strDocumentType: this.basicDataForm.value.strPersonType === 'J' ? 'NIT' : this.documentForm.getRawValue().strDocumentType,
          strDocumentNumber: this.basicDataForm.value.strPersonType === 'J' 
            ? `${this.documentForm.value.strDocumentNumber}-${this.documentForm.value.strDocumentDV}`
            : this.documentForm.value.strDocumentNumber,
        },
        naturalPersonData: this.basicDataForm.value.strPersonType === 'N' ? {
          firstName: this.naturalForm.value.firstName,
          secondName: this.naturalForm.value.secondName || undefined,
          firstSurname: this.naturalForm.value.firstSurname,
          secondSurname: this.naturalForm.value.secondSurname || undefined,
          birthDate: this.naturalForm.value.birthDate || undefined,
          maritalStatus: this.naturalForm.value.maritalStatus || undefined,
          sex: this.naturalForm.value.sex || undefined,
        } : undefined,
        legalEntityData: this.basicDataForm.value.strPersonType === 'J' ? this.legalForm.value : undefined,
      };

      this.customersService.createFullUser(dto).subscribe({
        next: () => {
          // User created in Authoriza — now save locally
          this.createLocalCustomerAndFinish();
        },
        error: (err: any) => {
          console.error('Error creating user in Authoriza:', err);
          this.saving = false;
          const message = err?.error?.message || err?.message || 'Error al crear el usuario';
          Swal.fire({
            icon: 'error',
            title: 'Error al crear usuario',
            text: message,
            confirmButtonColor: '#0066CC',
          });
        },
      });
    }
  }

  cancel() {
    this.formCancelled.emit();
  }

  private createLocalCustomerAndFinish(): void {
    const customerDto: CreateCustomerDto = {
      email: this.userForm.value.strUserName,
      personType: this.basicDataForm.value.strPersonType,
      documentType: this.basicDataForm.value.strPersonType === 'J' ? 'NIT' : this.documentForm.value.strDocumentType,
      documentNumber: this.basicDataForm.value.strPersonType === 'J'
        ? `${this.documentForm.value.strDocumentNumber}-${this.documentForm.value.strDocumentDV}`
        : this.documentForm.value.strDocumentNumber,
      firstName: this.naturalForm.value.firstName || undefined,
      secondName: this.naturalForm.value.secondName || undefined,
      firstSurname: this.naturalForm.value.firstSurname || undefined,
      secondSurname: this.naturalForm.value.secondSurname || undefined,
      birthDate: this.naturalForm.value.birthDate || undefined,
      maritalStatus: this.naturalForm.value.maritalStatus || undefined,
      sex: this.naturalForm.value.sex || undefined,
      phone: this.naturalForm.value.phone || undefined,
      businessName: this.legalForm.value.businessName || undefined,
      contactPerson: this.legalForm.value.contactName || undefined,
    };

    this.customersService.createCustomer(customerDto).subscribe({
      next: () => {
        this.saving = false;
        this.userCreated.emit();
      },
      error: () => {
        this.saving = false;
        this.userCreated.emit();
      },
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (field?.hasError('required')) return 'Este campo es requerido';
    if (field?.hasError('pattern')) return 'Formato de correo inválido';
    if (field?.hasError('taken')) return 'Este correo ya está registrado';
    return '';
  }
}
