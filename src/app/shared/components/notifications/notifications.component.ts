import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent {
  @Input() title: string = 'Notification';
  @Input() type: 'success' | 'warning' | 'danger' | 'primary' = 'success';
  @Input() alertType: 'A' | 'B' = 'A'; // A: se cierra automático, B: requiere acción del usuario
  @Output() close = new EventEmitter<void>();
  isVisible: boolean = false;

  // Método para obtener el icono basado en el tipo
  getIcon() {
    switch (this.type) {
      case 'success':
        return 'check-circle';
      case 'danger':
        return 'x-circle';
      case 'warning':
        return 'exclamation-triangle';
      case 'primary':
        return 'exclamation-triangle';
      default:
        return 'info-circle';
    }
  }
  // Método para obtener la clase del color del icono
  getIconColor() {
    return {
      'success': this.type === 'success',
      'warning': this.type === 'warning',
      'danger': this.type === 'danger',
      'primary': this.type === 'primary',
    };
  }


  // Método para obtener la clase de estilo basado en el tipo
  getClass() {
    return {
      'show': this.isVisible,
      'bg-success': this.type === 'success',
      'bg-danger': this.type === 'danger',
      'bg-warning': this.type === 'warning',
      'bg-primary': this.type === 'primary'
    };
  }

  // Muestra el toast, y si no es 'primary', lo cierra automáticamente
  showToast(message: string, type: 'success' | 'warning' | 'danger' | 'primary') {
    this.title = message;
    this.type = type;
    this.isVisible = true;
  
    // Solo cerrar automáticamente si es tipo A
    if (this.alertType === 'A') {
      setTimeout(() => {
        this.isVisible = false;
      }, 3000);
    }
  }
  

  // Cierra la notificación manualmente
  closeToast() {
    this.close.emit();
  }
}
