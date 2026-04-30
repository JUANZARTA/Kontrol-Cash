import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export default class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  registerForm: FormGroup;
  errorMessage = '';
  showModal = false;
  showSuccessModal = false;
  showPassword: boolean = false;

  constructor() {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordsMatch });
  }

  ngOnInit(): void {}

  isInvalid(controlName: string): boolean {
    const control = this.registerForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  private passwordsMatch(formGroup: FormGroup) {
    return formGroup.get('password')?.value === formGroup.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  onSubmit() {
    if (this.registerForm.valid) {
      const { name, email, password } = this.registerForm.value;

      this.authService.register(email, password).subscribe({
        next: (res) => {
          const uid = res.localId;
          this.authService.saveUserProfile(uid, name, email).subscribe({
            next: () => {
              this.showSuccessModal = true;
              setTimeout(() => {
                this.showSuccessModal = false;
                this.router.navigate(['/login']);
              }, 1500);
            },
            error: () => {
              this.showErrorModal('Error al guardar el nombre.');
            }
          });
        },
        error: (err) => {
          this.showErrorModal(this.getFirebaseErrorMessage(err));
        }
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

  private getFirebaseErrorMessage(code: string): string {
    switch (code) {
      case 'EMAIL_EXISTS':
        return 'Este correo ya está registrado.';
      default:
        return 'Ha ocurrido un error inesperado.';
    }
  }

  onRegisterWithGoogle(): void {
    this.authService
      .loginWithGoogle()
      .then((result) => {
        this.showSuccessModal = true;
        setTimeout(() => {
          this.showSuccessModal = false;
          this.router.navigate(['/login']);
        }, 1500);
      })
      .catch((err) => {
        console.error('Error en registro con Google:', err);
        this.showErrorModal('No se pudo registrar con Google.');
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}
