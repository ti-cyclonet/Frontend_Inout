import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { decodeJwtPayload } from '../../../shared/utils/jwt.util';
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
  tenantId: string | null = null;
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

    const payload = decodeJwtPayload(token);
    this.tenantId = payload?.tenantId || payload?.basicDataId || null;
    if (!this.tenantId) return;

    this.customersService.getTenantContract(this.tenantId).subscribe({
      next: (data: any) => {
        this.contractId = data.contractId;
        if (this.contractId) {
          this.customersService.getRoleAvailability(this.contractId).subscribe({
            next: (roles: any[]) => {
              // Solo roles con cupo disponible en el plan contratado. adminInout
              // SI puede volver a aparecer aqui si el plan permite mas de una
              // cuenta admin (ej. PRO permite 2): la exclusion anterior impedia
              // crear exactamente el caso que se necesita — admins adicionales.
              this.availableRoles = roles.filter(r => r.available > 0);
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
      const isRoleValid = !!this.selectedRoleId;
      return isDocValid && isPersonValid && isRoleValid;
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
      if (!this.selectedRoleId) {
        Swal.fire({ icon: 'warning', title: 'Selecciona un rol', text: 'Debes asignar un rol para poder crear el usuario.', confirmButtonColor: '#0066CC' });
      }
      return;
    }

    if (!this.tenantId || !this.contractId) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo determinar el contrato de tu cuenta. Cierra sesión y vuelve a ingresar.', confirmButtonColor: '#0066CC' });
      return;
    }

    this.saving = true;

    if (this.userExists && this.loadedUserData) {
      // El usuario ya existe en Authoriza: vincularlo como dependiente del
      // tenant en sesión y asignarle el rol (con validación de cupo).
      this.customersService.createUserDependency(this.tenantId, this.loadedUserData.userId).subscribe({
        next: () => this.assignRoleAndFinish(this.loadedUserData.userId),
        error: () => this.assignRoleAndFinish(this.loadedUserData.userId), // la dependencia puede ya existir
      });
    } else {
      // Usuario nuevo: proceso completo de Authoriza (User + BasicData + datos
      // de persona) + dependencia + rol, todo en un único paso atómico.
      const dto: any = {
        email: this.userForm.value.strUserName,
        personType: this.basicDataForm.value.strPersonType,
        documentType: this.basicDataForm.value.strPersonType === 'J' ? 'NIT' : this.documentForm.getRawValue().strDocumentType,
        documentNumber: this.basicDataForm.value.strPersonType === 'J'
          ? `${this.documentForm.value.strDocumentNumber}-${this.documentForm.value.strDocumentDV}`
          : this.documentForm.value.strDocumentNumber,
        naturalPersonData: this.basicDataForm.value.strPersonType === 'N' ? {
          firstName: this.naturalForm.value.firstName,
          secondName: this.naturalForm.value.secondName || undefined,
          firstSurname: this.naturalForm.value.firstSurname,
          secondSurname: this.naturalForm.value.secondSurname || undefined,
          birthDate: this.naturalForm.value.birthDate || undefined,
          maritalStatus: this.naturalForm.value.maritalStatus || undefined,
          sex: this.naturalForm.value.sex || undefined,
          phone: this.naturalForm.value.phone || undefined,
        } : undefined,
        legalEntityData: this.basicDataForm.value.strPersonType === 'J' ? this.legalForm.value : undefined,
        roleId: this.selectedRoleId,
      };

      this.customersService.createDependentUser(dto).subscribe({
        next: () => {
          this.saving = false;
          Swal.fire({ icon: 'success', title: 'Usuario creado', text: 'El usuario fue creado y vinculado correctamente.', confirmButtonColor: '#0066CC', timer: 2000, showConfirmButton: false });
          this.userCreated.emit();
        },
        error: (err: any) => {
          console.error('Error creating dependent user:', err);
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

  private assignRoleAndFinish(userId: string): void {
    this.customersService.assignRole(userId, this.selectedRoleId, this.contractId!).subscribe({
      next: () => {
        this.saving = false;
        Swal.fire({ icon: 'success', title: 'Usuario vinculado', text: 'El usuario fue vinculado y el rol asignado correctamente.', confirmButtonColor: '#0066CC', timer: 2000, showConfirmButton: false });
        this.userCreated.emit();
      },
      error: (err: any) => {
        this.saving = false;
        const message = err?.error?.message || err?.message || 'No se pudo asignar el rol';
        Swal.fire({ icon: 'error', title: 'Error', text: message, confirmButtonColor: '#0066CC' });
      }
    });
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
