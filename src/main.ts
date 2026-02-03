import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Inicializar Firebase (archivo con firebase.initializeApp)
import './environments/firebase-config';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
