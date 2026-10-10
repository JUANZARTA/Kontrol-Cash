import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';

const STORAGE_KEY = 'kontrol-cash:biometric';

interface StoredBiometric {
  credentialId: string;
  uid: string;
}

/**
 * Bloqueo de la app con huella (WebAuthn, autenticador de plataforma).
 * NO es autenticación real: no hay backend que verifique la firma. Mientras la sesión de
 * Firebase siga viva (token/usuario en localStorage), la huella solo "desbloquea" la UI.
 *
 * Tiene que inyectarse en el componente raíz (app.component.ts) para instanciarse al
 * arrancar la app. Si se instancia recién dentro del guard, el signal `locked` se calcula
 * tarde y un login con contraseña recién hecho queda marcado como bloqueado al toque.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  private authService = inject(AuthService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly locked = signal(false);
  readonly enabled = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.isBrowser) return;
    const active = this.isEnabled();
    this.enabled.set(active);
    this.locked.set(active);
  }

  async isSupported(): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      if (!window.PublicKeyCredential || !navigator.credentials) return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  isEnabled(): boolean {
    if (!this.isBrowser) return false;
    const stored = this.read();
    const uid = this.authService.getUser()?.localId;
    return !!stored && !!uid && stored.uid === uid;
  }

  async enable(uid: string): Promise<void> {
    this.error.set(null);
    try {
      const credential = (await navigator.credentials.create({
        publicKey: {
          rp: { id: location.hostname, name: 'Kontrol Cash' },
          user: { id: new TextEncoder().encode(uid), name: uid, displayName: 'Kontrol Cash' },
          challenge: this.randomBytes(),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'discouraged',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error('Sin credencial');

      const data: StoredBiometric = { credentialId: this.toBase64Url(credential.rawId), uid };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.enabled.set(true);
      this.locked.set(false);
    } catch (err) {
      const message = this.mapError(err);
      this.error.set(message);
      throw new Error(message);
    }
  }

  disable(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(STORAGE_KEY);
    this.enabled.set(false);
    this.locked.set(false);
    this.error.set(null);
  }

  async unlock(): Promise<boolean> {
    this.error.set(null);
    const stored = this.read();
    if (!stored) {
      this.locked.set(false);
      return true;
    }

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: this.randomBytes(),
          allowCredentials: [{ type: 'public-key', id: this.fromBase64Url(stored.credentialId) }],
          userVerification: 'required',
          rpId: location.hostname,
          timeout: 60000,
        },
      });
      if (!assertion) return false;
      this.locked.set(false);
      return true;
    } catch (err) {
      this.error.set(this.mapError(err));
      return false;
    }
  }

  private read(): StoredBiometric | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.credentialId && parsed?.uid ? parsed : null;
    } catch {
      return null;
    }
  }

  private randomBytes(length = 32): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  private toBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private fromBase64Url(value: string): Uint8Array {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(base64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  }

  private mapError(err: unknown): string {
    const name = (err as { name?: string })?.name;
    switch (name) {
      case 'NotAllowedError':
        return 'Se canceló la verificación. Probá de nuevo.';
      case 'InvalidStateError':
        return 'Este dispositivo ya tiene una huella registrada para la app. Desactivala y volvé a activarla.';
      case 'NotSupportedError':
      case 'SecurityError':
        return 'Este dispositivo o navegador no soporta el desbloqueo con huella.';
      default:
        return 'No se pudo completar la verificación. Intentá otra vez.';
    }
  }
}
