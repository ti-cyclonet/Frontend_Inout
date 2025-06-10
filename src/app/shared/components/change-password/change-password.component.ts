import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { UserService } from "../../services/user/user.service";

@Component({
  standalone: true,
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css'],
  imports: [ReactiveFormsModule, CommonModule, FormsModule]
})
export class ChangePasswordComponent implements OnInit {
  form!: FormGroup; // ← corregido

  constructor(private fb: FormBuilder, private usersService: UserService) {}

  ngOnInit() {
    this.form = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const { oldPassword, newPassword } = this.form.value;
      const userId = localStorage.getItem('userId');

      this.usersService.changePassword(userId!, oldPassword, newPassword)
        .subscribe({
          next: () => alert('Password updated successfully!'),
          error: (err: any) => alert('Error: ' + err.error.message)
        });
    }
  }
}
