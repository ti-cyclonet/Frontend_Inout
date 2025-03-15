import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent {
  @Input() title: string = 'Notification';
  @Input() type: 'success' | 'warning' | 'danger' = 'success';
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
    };
  }


  // Método para obtener la clase de estilo basado en el tipo
  getClass() {
    return {
      'show': this.isVisible,
      'bg-success': this.type === 'success',
      'bg-danger': this.type === 'danger',
      'bg-warning': this.type === 'warning'
    };
  }

  // Función para mostrar el Toast
  showToast(message: string, type: 'success' | 'warning' | 'danger') {
    this.title = message;
    this.type = type;  // Ahora acepta solo 'success', 'warning' o 'danger'
    this.isVisible = true;

    // Ocultar el toast después de 3 segundos
    setTimeout(() => {
      this.isVisible = false;
    }, 3000);
  }
}
