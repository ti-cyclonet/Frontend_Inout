import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  success(title: string, message?: string) {
    return Swal.fire({
      icon: 'success',
      title,
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  }

  error(title: string, message?: string) {
    return Swal.fire({
      icon: 'error',
      title,
      text: message,
      confirmButtonText: 'OK'
    });
  }

  warning(title: string, message?: string) {
    return Swal.fire({
      icon: 'warning',
      title,
      text: message,
      confirmButtonText: 'OK'
    });
  }

  info(title: string, message?: string) {
    return Swal.fire({
      icon: 'info',
      title,
      text: message,
      confirmButtonText: 'OK'
    });
  }

  confirm(title: string, message?: string) {
    return Swal.fire({
      icon: 'question',
      title,
      text: message,
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No'
    });
  }

  loading(title: string = 'Cargando...') {
    return Swal.fire({
      title,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  close() {
    Swal.close();
  }
}