import { bootstrapApplication } from '@angular/platform-browser';
import Swal from 'sweetalert2';

// Las ventanas modales solo se cierran con sus botones, nunca al hacer clic
// fuera (evita perder lo diligenciado por un clic accidental). Se aplica a
// todos los Swal.fire de la app; los avisos tipo toast no se afectan.
const swalFire = Swal.fire.bind(Swal);
(Swal as any).fire = (...args: any[]) => {
  if (args.length === 1 && args[0] && typeof args[0] === 'object') {
    if (args[0].toast) return swalFire(args[0]);
    return swalFire({ allowOutsideClick: false, ...args[0] });
  }
  if (typeof args[0] === 'string') {
    return swalFire({ title: args[0], html: args[1], icon: args[2], allowOutsideClick: false });
  }
  return swalFire(...(args as [any]));
};
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    console.log('📦 InOut corriendo en el puerto 4201');
  })
  .catch(err => console.error(err));
