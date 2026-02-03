import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { DateService } from '../../services/date.service';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export default class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private dateService = inject(DateService);
  showPassword: boolean = false;

  loginForm: FormGroup;
  showModal = false;
  showSuccessModal = false;
  errorMessage = '';
  welcomeName: string = '';

  loginError = false;
  loginSuccess = false;
  showLoginOverlay = false;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  // Método para capturar el resultado del login con Google y redirigir si es nuevo login
  ngOnInit(): void {
    // Compatibilidad: si en algún flujo se usó redirect, procesarlo aquí
    firebase
      .auth()
      .getRedirectResult()
      .then((result: firebase.auth.UserCredential) => {
        if (result && result.user) {
          // Procesar datos, guardarlos y crear perfil si hace falta
          this.authService.processGoogleSignIn(result);

          this.welcomeName = result.user.displayName || 'Usuario';
          this.showSuccessModal = true;

          setTimeout(() => {
            this.router.navigate(['app/home']);
          }, 1000);
        }
      })
      .catch((error: any) => {
        console.error('Error en getRedirectResult:', error);
      });
  }

  isInvalid(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.showLoginOverlay = true; // mostrar overlay
      this.loginSuccess = false;
      this.loginError = false; // reset error

      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: (res) => {
          const uid = res.localId;
          this.loginSuccess = true; // indica éxito

          this.authService.getUserData(uid).subscribe((userData) => {
            const nombre = userData?.nombre || '';
            this.showWelcomeModal(nombre);

            // Notificaciones
            const recomendaciones = [
              'Reservá al menos el 10% de tus ingresos como ahorro.',
              'Evitá gastos pequeños repetitivos, pueden sumar mucho.',
              'Asigná metas a tus ahorros: eso te motiva más.',
            ];

            this.authService.getUserNotifications(uid).subscribe((notifs) => {
              const existentes = notifs
                ? Object.values(notifs).map((n: any) => n.mensaje)
                : [];

              recomendaciones.forEach((msg) => {
                if (!existentes.includes(msg)) {
                  this.authService.addNotification(uid, msg).subscribe();
                }
              });
            });

            // Cerrar overlay después de 1.5s
            setTimeout(() => {
              this.showLoginOverlay = false;
            }, 1500);
          });
        },
        error: (errorMsg) => {
          this.loginSuccess = false;
          this.loginError = true; // indica error
          this.showLoginOverlay = true; // mantener overlay para mostrar mensaje

          // ocultar overlay automáticamente después de 2s
          setTimeout(() => {
            this.showLoginOverlay = false;
          }, 2000);

          // opcional: mensaje detallado
          console.error(this.getFirebaseErrorMessage(errorMsg));
        },
      });
    }
  }

  showErrorModal(message: string) {
    this.errorMessage = message;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  showWelcomeModal(nombre: string) {
    this.welcomeName = nombre;
    this.showSuccessModal = true;

    this.dateService.resetToCurrentDate();

    setTimeout(() => {
      this.showSuccessModal = false;
      this.router.navigate(['app/home']);
    }, 1000);
  }

  private getFirebaseErrorMessage(code: string): string {
    switch (code) {
      case 'EMAIL_NOT_FOUND':
      case 'INVALID_PASSWORD':
        return 'Correo o contraseña incorrectos.';
      case 'USER_DISABLED':
        return 'Este usuario ha sido deshabilitado.';
      default:
        return 'Ha ocurrido un error inesperado.';
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Método para iniciar sesión con Google (maneja popup y muestra mensajes)
  onLoginWithGoogle(): void {
    this.showLoginOverlay = true;
    this.authService
      .loginWithGoogle()
      .then((result) => {
        const name = result.user?.displayName || 'Usuario';
        this.showWelcomeModal(name);
      })
      .catch((err) => {
        this.showLoginOverlay = false;
        console.error('Error en login con Google:', err);
        this.showErrorModal('No se pudo iniciar sesión con Google.');
      });
  }
}
