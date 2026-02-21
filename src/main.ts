import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    console.log('📦 InOut corriendo en el puerto 4201');
  })
  .catch(err => console.error(err));
