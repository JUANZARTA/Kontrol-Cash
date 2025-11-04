import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

export interface Notificacion {
  mensaje: string;
  leido: boolean;
  fecha: string;
  tipo?: string; // Para identificar el tipo de notificación
  idUnico?: string; // Para evitar duplicados por día
}

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

  // método: Guardar el perfil del usuario en la base de datos
  saveUserProfile(
    userId: string,
    name: string,
    correo: string
  ): Observable<any> {
    const url = `https://micartera-acd5b-default-rtdb.firebaseio.com/${userId}.json`;

    return this.http
      .put(url, {
        nombre: name,
        correo: correo,
        notificaciones: {
          '-notif1': {
            mensaje: 'Bienvenido a MiCartera',
            leido: false,
            fecha: new Date().toLocaleString(),
          },
        },
      })
      .pipe(
        tap(() => {
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          storedUser.name = name;
          localStorage.setItem('user', JSON.stringify(storedUser));
        }),
        catchError(() => throwError(() => 'Error al guardar perfil'))
      );
  }

  // método: Obtener todos los datos del usuario desde Firebase
  getUserData(uid: string): Observable<any> {
    const url = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}.json`;
    return this.http.get<any>(url);
  }

  // método: Obtener notificaciones del usuario
  getUserNotifications(uid: string): Observable<Record<string, Notificacion>> {
    const url = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones.json`;
    return this.http.get<Record<string, Notificacion>>(url);
  }

  // método: Marcar una notificación como leída
  markNotificationAsRead(uid: string, notifId: string): Observable<any> {
    const url = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones/${notifId}/leido.json`;
    return this.http.put(url, true);
  }

  // método: Eliminar una notificación específica
  deleteNotification(uid: string, notifId: string): Observable<any> {
    const url = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones/${notifId}.json`;
    return this.http.delete(url);
  }

  // método: Eliminar todas las notificaciones del usuario
  deleteAllNotifications(uid: string): Observable<any> {
    const url = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones.json`;
    return this.http.delete(url);
  }

  // método: Verificar si ya existe una notificación del mismo tipo hoy
  checkNotificationExists(uid: string, tipo: string): Observable<boolean> {
    return this.getUserNotifications(uid).pipe(
      map((data) => {
        if (!data) return false;
        
        const today = new Date().toISOString().split('T')[0];
        return Object.values(data).some((notif: any) => {
          const notifDate = new Date(notif.fecha).toISOString().split('T')[0];
          return notif.tipo === tipo && notifDate === today;
        });
      })
    );
  }

  // método: Agregar nueva notificación con control de duplicados
  addNotification(uid: string, mensaje: string, tipo?: string): Observable<any> {
    const notificacionesUrl = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones.json`;

    // Si se especifica un tipo, verificar si ya existe hoy
    if (tipo) {
      return this.checkNotificationExists(uid, tipo).pipe(
        switchMap((exists) => {
          if (exists) {
            // Ya existe una notificación de este tipo hoy, no agregar
            return of(null);
          }
          return this.addNotificationInternal(uid, mensaje, tipo);
        })
      );
    }
    
    return this.addNotificationInternal(uid, mensaje, tipo);
  }

  // método interno para agregar notificación
  private addNotificationInternal(uid: string, mensaje: string, tipo?: string): Observable<any> {
    const notificacionesUrl = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones.json`;

    return this.getUserNotifications(uid).pipe(
      switchMap((data) => {
        const allNotifs = data ? Object.entries(data) : [];
        const total = allNotifs.length;

        // Si hay más de 19 notificaciones, eliminar la más antigua
        if (total >= 20) {
          const sorted = allNotifs.sort(
            (a: any, b: any) =>
              new Date(a[1].fecha).getTime() - new Date(b[1].fecha).getTime()
          );
          const oldestKey = sorted[0][0];

          const deleteUrl = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones/${oldestKey}.json`;
          return this.http.delete(deleteUrl).pipe(
            switchMap(() => {
              return this.http.post(notificacionesUrl, {
                mensaje,
                leido: false,
                fecha: new Date().toLocaleString(),
                tipo: tipo || 'general',
                idUnico: tipo ? `${tipo}_${new Date().toISOString().split('T')[0]}` : undefined
              });
            })
          );
        } else {
          return this.http.post(notificacionesUrl, {
            mensaje,
            leido: false,
            fecha: new Date().toLocaleString(),
            tipo: tipo || 'general',
            idUnico: tipo ? `${tipo}_${new Date().toISOString().split('T')[0]}` : undefined
          });
        }
      })
    );
  }

  // método: Borrar notificaciones con más de 7 días de antigüedad
  cleanOldNotifications(uid: string): Observable<any> {
    return this.getUserNotifications(uid).pipe(
      switchMap((data) => {
        if (!data) return of(null);

        const now = new Date();
        const deletions = Object.entries(data)
          .filter(([key, notif]: any) => {
            const fecha = new Date(notif.fecha);
            const diffDays = Math.floor(
              (now.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24)
            );
            return diffDays >= 7;
          })
          .map(([key]) => {
            const delUrl = `https://micartera-acd5b-default-rtdb.firebaseio.com/${uid}/notificaciones/${key}.json`;
            return this.http.delete(delUrl);
          });

        return deletions.length > 0 ? forkJoin(deletions) : of(null);
      })
    );
  }

  // Método para iniciar sesión con Google
  loginWithGoogle(): void {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
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
