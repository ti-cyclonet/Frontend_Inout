import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialsService } from '../../shared/services/materials/materials.service';
import { NotificationsComponent } from "../../shared/components/notifications/notifications.component";
@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [CommonModule, NotificationsComponent],
  templateUrl: './materials.component.html',
  styleUrls: ['./materials.component.css']
})
export class MaterialsComponent implements OnInit {
  @ViewChild('notification') notification!: NotificationsComponent;
  materials: any[] = [];
  selectedMaterial: any = null; 
  isModalOpen = false; 

  // configuración notificaciones tipo toast
  toastTitle: string = '';
  toastType: 'success' | 'warning' | 'danger' | 'primary' = 'success';
  notifications: Array<{
    title: string;
    type: 'success' | 'warning' | 'danger' | 'primary';
    alertType: 'A' | 'B';
    container: 0 | 1;
    visible: boolean;
  }> = [];
  SWNTF: number = 0;
  showOptions = true;

// ----------------------------------------------

  constructor(private materialsService: MaterialsService, private cdr: ChangeDetectorRef,) {
    this.notifications = [];
  }

  ngOnInit(): void {    
    // this.materialsService.getMaterials().subscribe({
    //   next: (materials: any) => {
    //     this.materials = materials;
    //   },
    //   error: (e: any) => {
    //     console.error('Error loading materials:', e);
    //   }
    // });
  }

  // Abre el modal para agregar un nuevo material
  openMaterialModal() {
    this.isModalOpen = true;
  }

  // Establece el material seleccionado para eliminar
  setSelectedMaterial(material: any) {
    this.selectedMaterial = material;
  }

  // Confirma la eliminación del material
  confirmDeleteMaterial() {
    if (this.selectedMaterial) {
      this.materialsService.deleteMaterial(this.selectedMaterial.id).subscribe({
        next: () => {
          this.materials = this.materials.filter(m => m.id !== this.selectedMaterial.id);
          this.selectedMaterial = null;
        },
        error: (error: any) => {
          console.error('Error deleting material:', error);
        }
      });
    }
  }  

  // Función trackBy para mejorar rendimiento en *ngFor
  trackById(index: number, material: any): number {
    return material.id;
  }

  // Funciones para NOTIFICACIONES
  addNotification(title: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B', container: 0 | 1) {
    this.notifications.push({ title, type, alertType, container, visible: true });
  }

  removeNotification(index: number) {
    this.notifications.splice(index, 1);
  }

  showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary', alertType: 'A' | 'B',  container: 0 | 1 ) {
    const notification = {
      title: message,
      type,
      alertType,
      container,
      visible: true
    };
    this.notifications.push(notification);
    this.cdr.detectChanges();

    if (alertType === 'A') {
      setTimeout(() => {
        notification.visible = false;
        this.cdr.detectChanges();
      }, 5000);
    }
  }
// ----------------------------------------------
}