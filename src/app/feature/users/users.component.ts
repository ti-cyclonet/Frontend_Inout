import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersDemoComponent } from './users-demo.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, UsersDemoComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent {
  constructor() { }
}