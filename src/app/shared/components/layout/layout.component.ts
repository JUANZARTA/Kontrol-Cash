import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter, merge, interval, fromEvent, map, distinctUntilChanged } from 'rxjs';
import { UserSettingsService } from '../../../services/user-settings.service';
import { ThemeService } from '../../../services/theme.service';
import { MonthlyCloseService } from '../../../services/monthly-close.service';
import { DateService } from '../../../services/date.service';
import { PandaLeadService } from '../../../services/panda-lead.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, FooterComponent, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export default class LayoutComponent implements OnInit, OnDestroy {
  private settingsService = inject(UserSettingsService);
  private themeService = inject(ThemeService);
  private closeService = inject(MonthlyCloseService);
  private router = inject(Router);
  private dateService = inject(DateService);
  private pandaLeadService = inject(PandaLeadService);

  pendingClose: { year: string; month: string } | null = null;
  private navSub?: Subscription;
  private pandaLeadTokenSub?: Subscription;
  private pandaLeadSyncSub?: Subscription;

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user?.localId;
    if (!userId) return;

    this.settingsService.getSettings(userId).subscribe(settings => {
      if (!settings) return;
      this.themeService.setTheme(settings.darkMode ? 'dark' : 'light');
      this.themeService.setCustomColorMode(
        settings.useCustomColor ?? false,
        settings.accentColor || '#0ea5e9'
      );
    });

    this.checkPendingClose(userId);
    // El guard de rutas ya bloquea la navegación mientras haya un mes pendiente; acá
    // solo recalculamos el aviso para que desaparezca apenas el usuario cierre el mes
    // y navegue a cualquier otra pantalla.
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.checkPendingClose(userId));

    // Suscrito a settings$ (no a un getSettings() de una sola vez) para enterarse si el
    // usuario conecta/desconecta/apaga Panda Lead desde Configuración sin recargar la página.
    // Cada vez que cambia el token o el interruptor, le avisa a Panda Lead (kontrolEnabled) y
    // arranca/corta el ciclo de sincronización acá. Esto cubre: conectar por primera vez,
    // prender/apagar el interruptor, y abrir la app con un token ya guardado (el primer valor
    // que emite settings$ ya refleja lo que había guardado, así que Panda Lead queda al día
    // aunque el interruptor se haya tocado antes de que existiera este aviso).
    this.pandaLeadTokenSub = this.settingsService.settings$
      .pipe(
        map((s) => ({ token: s.pandaLeadToken || '', enabled: s.pandaLeadEnabled !== false })),
        distinctUntilChanged((a, b) => a.token === b.token && a.enabled === b.enabled)
      )
      .subscribe(({ token, enabled }) => {
        if (token) this.pandaLeadService.writeEnabled(token, enabled);
        this.setupPandaLeadSync(userId, enabled ? token : '');
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.pandaLeadTokenSub?.unsubscribe();
    this.pandaLeadSyncSub?.unsubscribe();
  }

  // Dispara una sincronización con Panda Lead: al cambiar de mes activo, cada 60s mientras
  // la app está abierta, y al volver a enfocar la pestaña. Se reinicia solo si el token cambia.
  private setupPandaLeadSync(userId: string, token: string): void {
    this.pandaLeadSyncSub?.unsubscribe();
    if (!token) return;

    // Marca conexión + sync una vez acá, para que Panda Lead se vea "conectado" apenas se abre
    // la app con un token ya guardado (cubre también el token pegado antes de esta mejora).
    this.pandaLeadService.markConnected(token);
    this.pandaLeadService.markSynced(token);

    const tick$ = merge(
      this.dateService.selectedDate$,
      interval(60000).pipe(map(() => ({ year: this.dateService.getSelectedYear(), month: this.dateService.getSelectedMonth() }))),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => !document.hidden),
        map(() => ({ year: this.dateService.getSelectedYear(), month: this.dateService.getSelectedMonth() }))
      )
    );

    this.pandaLeadSyncSub = tick$.subscribe(({ year, month }) => {
      if (!year || !month) return;
      this.pandaLeadService.syncMonth(userId, token, year, month);
    });
  }

  private checkPendingClose(userId: string): void {
    this.closeService.getPendingClosePeriod(userId).subscribe(pending => {
      this.pendingClose = pending;
    });
  }

  get pendingClosePeriodLabel(): string {
    if (!this.pendingClose) return '';
    return this.closeService.formatPeriodLabel(`${this.pendingClose.year}-${this.pendingClose.month}`);
  }

  goToMonthClose(): void {
    // Sin esto, la pantalla de cierre operaba sobre lo que tuviera puesto el selector de
    // fecha (normalmente el mes actual real) en vez del mes realmente pendiente — se podía
    // terminar cerrando el mes equivocado y el aviso de "sin cerrar" nunca desaparecía.
    if (this.pendingClose) {
      this.dateService.setDate(parseInt(this.pendingClose.year, 10), parseInt(this.pendingClose.month, 10));
    }
    this.router.navigate(['/app/month-close']);
  }
}
