import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { CreateCustomerDto } from '../../../shared/model/customer.model';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './customer-form.component.html',
  styleUrls: ['./customer-form.component.css']
})
export class CustomerFormComponent {
  @Input() isModal = false;
  @Output() customerCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();
  
  customerForm: FormGroup;
  loading = false;
  
  documentTypes = [
    { value: 'CC', label: 'Cédula de Ciudadanía' },
    { value: 'CE', label: 'Cédula de Extranjería' },
    { value: 'NIT', label: 'NIT' },
    { value: 'PP', label: 'Pasaporte' }
  ];
  
  constructor(
    private fb: FormBuilder,
    private customersService: CustomersService
  ) {
    this.customerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      personType: ['N'],
      businessName: [''],
      contactPerson: [''],
      phone: [''],
      address: [''],
      documentType: ['CC'],
      documentNumber: [''],
      documentDv: [''],
      firstName: [''],
      secondName: [''],
      firstSurname: [''],
      secondSurname: [''],
      birthDate: [''],
      maritalStatus: [''],
      sex: ['']
    });
    
    // Watch person type changes
    this.customerForm.get('personType')?.valueChanges.subscribe(value => {
      if (value === 'J') {
        this.customerForm.patchValue({ documentType: 'NIT' });
        this.customerForm.get('documentType')?.disable();
      } else {
        this.customerForm.patchValue({ documentType: 'CC' });
        this.customerForm.get('documentType')?.enable();
      }
    });
    
    // Set initial document type based on person type
    const initialPersonType = this.customerForm.get('personType')?.value;
    if (initialPersonType === 'J') {
      this.customerForm.patchValue({ documentType: 'NIT' });
      this.customerForm.get('documentType')?.disable();
    }
  }
  
  get isNaturalPerson() {
    return this.customerForm.get('personType')?.value === 'N';
  }
  
  get isLegalEntity() {
    return this.customerForm.get('personType')?.value === 'J';
  }
  
  onSubmit() {
    if (this.customerForm.valid) {
      this.loading = true;
      const formValue = this.customerForm.getRawValue();
      const customerData: CreateCustomerDto = formValue;
      
      this.customersService.createCustomer(customerData).subscribe({
        next: () => {
          this.loading = false;
          this.customerCreated.emit();
          this.customerForm.reset();
        },
        error: (error) => {
          this.loading = false;
          console.error('Error creating customer:', error);
        }
      });
    }
  }
  
  onCancel() {
    this.formCancelled.emit();
  }
}