import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { BiometricService } from './core/biometric.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Kontrol Cash';

  // Instanciado al arrancar: el bloqueo por huella solo debe aplicar si ya había sesión
  // al abrir la app, nunca justo después de un login con contraseña/Google recién hecho.
  // Si se instancia recién adentro del guard, llega tarde y queda "bloqueado" al toque.
  private biometric = inject(BiometricService);

  constructor(private router: Router, private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.initTheme();
    this.themeService.initAccent();

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      window.history.replaceState({}, '', redirect);
      this.router.navigateByUrl(redirect);
    }
  }

}
