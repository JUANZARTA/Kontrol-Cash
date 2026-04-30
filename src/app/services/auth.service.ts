import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiKey = 'AIzaSyBzluPST056-3rTmei5t38M6GaF9CNCo2Q';
  private baseUrl = 'https://identitytoolkit.googleapis.com/v1/accounts';

  constructor(private http: HttpClient) {}

  // método: Iniciar sesión con correo y contraseña
  login(email: string, password: string): Observable<any> {
    const url = `${this.baseUrl}:signInWithPassword?key=${this.apiKey}`;
    const body = { email, password, returnSecureToken: true };

    return this.http.post(url, body).pipe(
      tap((res: any) => {
        localStorage.setItem('user', JSON.stringify(res));
      }),
      catchError((err) => {
        return throwError(() => err.error.error.message);
      })
    );
  }

  // método: Cerrar sesión y limpiar localStorage
  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('selectedYear');
    localStorage.removeItem('selectedMonth');
  }

  // método: Verificar si el usuario está logueado
  isLoggedIn(): boolean {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('user');
    }
    return false;
  }

  // método: Obtener datos del usuario guardados en localStorage
  getUser(): any {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }

  // método: Registrar un nuevo usuario
  register(email: string, password: string): Observable<any> {
    const url = `${this.baseUrl}:signUp?key=${this.apiKey}`;
    const body = { email, password, returnSecureToken: true };

    return this.http.post(url, body).pipe(
      tap((res: any) => {
        localStorage.setItem('user', JSON.stringify(res));
      }),
      catchError((err) => {
        return throwError(() => err.error.error.message);
      })
    );
  }

  // método: Guardar el perfil del usuario en la base de datos (ahora adjunta token)
  saveUserProfile(
    userId: string,
    name: string,
    correo: string
  ): Observable<any> {
    const base = `https://micartera-acd5b-default-rtdb.firebaseio.com/${userId}.json`;

    return from(this.getIdToken()).pipe(
      switchMap((token) => {
        const target = token ? `${base}?auth=${token}` : base;
        return this.http.put(target, {
          nombre: name,
          correo: correo,
        }).pipe(
          tap(() => {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            storedUser.name = name;
            localStorage.setItem('user', JSON.stringify(storedUser));
          }),
          catchError(() => throwError(() => 'Error al guardar perfil'))
        );
      })
    );
  }

  // Helper: obtener token actual (desde firebase o localStorage como fallback)
  public async getIdToken(): Promise<string | null> {
    try {
      const current = firebase.auth().currentUser;
      if (current) return await current.getIdToken();

      const stored = this.getUser();
      return stored?.idToken ?? null;
    } catch (err) {
      return null;
    }
  }

  // método: Obtener todos los datos del usuario desde Firebase (adjunta token)
  getUserData(uid: string): Observable<any> {
    const url = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}.json`;
    return from(this.getIdToken()).pipe(
      switchMap((token) => {
        const target = token ? `${url}?auth=${token}` : url;
        return this.http.get<any>(target);
      })
    );
  }

  // Método para iniciar sesión con Google (usa popup para flujo inmediato y más sencillo)
  loginWithGoogle(): Promise<firebase.auth.UserCredential> {
    const provider = new firebase.auth.GoogleAuthProvider();
    return firebase
      .auth()
      .signInWithPopup(provider)
      .then((result) => {
        // Guardar y procesar datos del usuario
        this.processGoogleSignIn(result);
        return result;
      })
      .catch((err) => {
        console.error('Google sign-in error:', err);
        throw err;
      });
  }

  // Procesar credenciales de Google: guarda en localStorage y crea perfil en RTDB si no existe
  processGoogleSignIn(result: firebase.auth.UserCredential): void {
    const user = result.user;
    if (!user) return;

    user.getIdToken().then((token) => {
      const userObj: any = {
        localId: user.uid,
        idToken: token,
        email: user.email || '',
        name: user.displayName || ''
      };

      localStorage.setItem('user', JSON.stringify(userObj));

      // Si no existe perfil en la base de datos, crear uno básico
      this.getUserData(user.uid).subscribe((data) => {
        if (!data || !data.nombre) {
          this.saveUserProfile(user.uid, user.displayName || '', user.email || '').subscribe({
            next: () => {
            },
            error: () => {
              // no hacemos nada crítico si falla
            }
          });
        }
      });
    });
  }

  // Método para obtener el token de Firebase
  startAutoLogout(): void {
    let timer: any;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.logout();
        // window.location.href = '/miCartera/login'; // Redirigir al login

        
        window.location.href = `${document.baseURI}login`;

      }, 5 * 60 * 1000); // 2 minutos
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    resetTimer(); // Iniciar temporizador al entrar
  }

}
