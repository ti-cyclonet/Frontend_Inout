import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialsDemoComponent } from './materials-demo.component';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [CommonModule, MaterialsDemoComponent],
  templateUrl: './materials.component.html',
  styleUrls: ['./materials.component.css']
})
export class MaterialsComponent implements OnInit {

  constructor() {}

  ngOnInit(): void {
    // Initialization logic if needed
  }
}