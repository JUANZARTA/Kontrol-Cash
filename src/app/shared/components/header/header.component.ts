import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateService } from '../../../services/date.service';
import { Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  showMonthModal = false;
  years: number[] = [];
  months: string[] = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  currentYear: string = '';
  currentMonth: string = '';
  currentRoute: string = '';

  userName: string = ''; // Para mostrar nombre si luego se quiere

  notifications: any[] = [];
  unreadCount: number = 0;
  showNotifications: boolean = false;
  isLoadingNotifications: boolean = false;
  
  // Modales de confirmación
  showMarkAllReadModal: boolean = false;
  showDeleteAllModal: boolean = false;
  showDeleteSingleModal: boolean = false;
  notificationToDelete: any = null;

  // Propiedades computadas para el template
  get unreadNotificationsCount(): number {
    return this.notifications.filter(n => !n.leido).length;
  }

  get totalNotificationsCount(): number {
    return this.notifications.length;
  }

  private dateSubscription?: Subscription;
  private routeSubscription?: Subscription;

  constructor(private dateService: DateService, private router: Router,  private authService: AuthService ) {}

  ngOnInit(): void {
    this.generateYearRange(2025, 2050);

    const today = new Date();
    const defaultYear = today.getFullYear();
    const defaultMonth = today.getMonth();

    const savedYear = this.dateService.getSelectedYear();
    const savedMonth = this.dateService.getSelectedMonth();

    if (savedYear && savedMonth) {
      this.selectedYear = parseInt(savedYear);
      this.selectedMonth = parseInt(savedMonth) - 1;
      this.dateService.setDate(this.selectedYear, this.selectedMonth + 1);
    } else {
      this.selectedYear = defaultYear;
      this.selectedMonth = defaultMonth;
      this.dateService.setDate(defaultYear, defaultMonth + 1);
    }

    this.dateSubscription = this.dateService.selectedDate$.subscribe(({ year, month }) => {
      this.currentYear = year ?? '';
      this.currentMonth = month ?? '';
    });

    this.routeSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split('/');
        this.currentRoute = this.mapRouteToTitle(path[path.length - 1]);
        // Cerrar dropdown de notificaciones al navegar
        this.showNotifications = false;
        // Cerrar todos los modales al navegar
        this.showMarkAllReadModal = false;
        this.showDeleteAllModal = false;
        this.showDeleteSingleModal = false;
        this.notificationToDelete = null;
      }
    });

    this.loadNotifications();
    
    // Limpiar notificaciones antiguas cada hora
    setInterval(() => {
      this.cleanOldNotifications();
    }, 60 * 60 * 1000); // 1 hora
  }

  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.cleanupModals();
  }

  // Limpiar todos los modales
  private cleanupModals(): void {
    this.showNotifications = false;
    this.showMarkAllReadModal = false;
    this.showDeleteAllModal = false;
    this.showDeleteSingleModal = false;
    this.notificationToDelete = null;
  }

  generateYearRange(start: number, end: number): void {
    this.years = [];
    for (let year = start; year <= end; year++) {
      this.years.push(year);
    }
  }

  openMonthModal(): void {
    this.showMonthModal = true;
  }

  closeMonthModal(): void {
    this.showMonthModal = false;
  }

  clearYearSelection(): void {
    this.selectedYear = null;
  }

  selectYear(year: number): void {
    this.selectedYear = year;
  }

  selectMonth(monthIndex: number): void {
    this.selectedMonth = monthIndex;
    this.showMonthModal = false;

    const mes = monthIndex + 1;
    this.dateService.setDate(this.selectedYear!, mes);
    console.log('Fecha seleccionada →', this.selectedYear, mes);

    // ✅ Notificar cambio de mes
    const user = this.authService.getUser();
    const uid = user?.localId;

    if (uid) {
      const yearStr = this.selectedYear!.toString();
      const monthStr = mes.toString().padStart(2, '0');
      this.dateService.notifyMonthChange(uid, yearStr, monthStr);
    }
  }


  mapRouteToTitle(route: string): string {
    switch (route) {
      case 'expense': return 'Gastos';
      case 'income': return 'Ingresos';
      case 'wallet': return 'Cartera';
      case 'saving': return 'Ahorros';
      case 'loan': return 'Préstamos';
      case 'debt': return 'Deudas';
      case 'home': return 'Inicio';
      default: return this.capitalize(route);
    }
  }

  capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  logout(): void {
    this.authService.logout(); // asegúrate de que este método exista
    this.router.navigate(['/auth/login']); // o la ruta a tu pantalla de login
  }
  // 📩 NOTIFICACIONES

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    const user = this.authService.getUser();
    const uid = user?.localId;
    if (!uid) return;

    this.isLoadingNotifications = true;
    
    this.authService.getUserNotifications(uid).subscribe({
      next: (data) => {
        if (data) {
          this.notifications = Object.entries(data).map(([key, value]: any) => ({
            id: key,
            ...value
          }));
          this.unreadCount = this.notifications.filter(n => !n.leido).length;
        }
        this.isLoadingNotifications = false;
      },
      error: (error) => {
        console.error('Error al cargar notificaciones:', error);
        this.isLoadingNotifications = false;
      }
    });
  }

  markAsRead(notifId: string): void {
    const user = this.authService.getUser();
    const uid = user?.localId;
    if (!uid) return;

    this.authService.markNotificationAsRead(uid, notifId).subscribe(() => {
      this.notifications = this.notifications.map(n => {
        if (n.id === notifId) n.leido = true;
        return n;
      });
      this.unreadCount = this.notifications.filter(n => !n.leido).length;
    });
  }

  // Marcar todas las notificaciones como leídas
  markAllAsRead(): void {
    const unreadNotifications = this.notifications.filter(n => !n.leido);
    if (unreadNotifications.length === 0) return;
    
    this.showMarkAllReadModal = true;
  }

  // Confirmar marcar todas como leídas
  confirmMarkAllAsRead(): void {
    const user = this.authService.getUser();
    const uid = user?.localId;
    if (!uid) return;

    const unreadNotifications = this.notifications.filter(n => !n.leido);
    const markAsReadPromises = unreadNotifications.map(notif => 
      this.authService.markNotificationAsRead(uid, notif.id)
    );

    // Marcar todas como leídas en paralelo
    Promise.all(markAsReadPromises).then(() => {
      this.notifications = this.notifications.map(n => ({ ...n, leido: true }));
      this.unreadCount = 0;
      this.showMarkAllReadModal = false;
    });
  }

  // Eliminar una notificación específica
  deleteNotification(notifId: string): void {
    const notification = this.notifications.find(n => n.id === notifId);
    if (!notification) return;
    
    this.notificationToDelete = notification;
    this.showDeleteSingleModal = true;
  }

  // Confirmar eliminar notificación individual
  confirmDeleteSingleNotification(): void {
    const user = this.authService.getUser();
    const uid = user?.localId;
    if (!uid || !this.notificationToDelete) return;

    this.authService.deleteNotification(uid, this.notificationToDelete.id).subscribe(() => {
      this.notifications = this.notifications.filter(n => n.id !== this.notificationToDelete.id);
      this.unreadCount = this.notifications.filter(n => !n.leido).length;
      this.showDeleteSingleModal = false;
      this.notificationToDelete = null;
    });
  }

  // Eliminar todas las notificaciones
  deleteAllNotifications(): void {
    if (this.notifications.length === 0) return;
    this.showDeleteAllModal = true;
  }

  // Confirmar eliminar todas las notificaciones
  confirmDeleteAllNotifications(): void {
    const user = this.authService.getUser();
    const uid = user?.localId;
    if (!uid) return;

    this.authService.deleteAllNotifications(uid).subscribe(() => {
      this.notifications = [];
      this.unreadCount = 0;
      this.showDeleteAllModal = false;
    });
  }

  // Limpiar notificaciones antiguas
  cleanOldNotifications(): void {
    const user = this.authService.getUser();
    const uid = user?.localId;
    if (!uid) return;

    this.authService.cleanOldNotifications(uid).subscribe(() => {
      // Recargar notificaciones después de limpiar
      this.loadNotifications();
    });
  }

  // Cerrar notificaciones cuando se hace clic fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    
    // Cerrar dropdown de notificaciones
    const notificationButton = document.querySelector('[data-notification-button]');
    const notificationDropdown = document.querySelector('[data-notification-dropdown]');
    
    if (notificationButton && notificationDropdown) {
      if (!notificationButton.contains(target) && !notificationDropdown.contains(target)) {
        this.showNotifications = false;
      }
    }

    // Cerrar modales si se hace clic fuera de ellos
    const modals = document.querySelectorAll('[data-modal]');
    modals.forEach(modal => {
      if (modal.contains(target)) return;
      
      if (this.showMarkAllReadModal && modal.getAttribute('data-modal') === 'mark-all-read') {
        this.closeMarkAllReadModal();
      }
      if (this.showDeleteAllModal && modal.getAttribute('data-modal') === 'delete-all') {
        this.closeDeleteAllModal();
      }
      if (this.showDeleteSingleModal && modal.getAttribute('data-modal') === 'delete-single') {
        this.closeDeleteSingleModal();
      }
    });
  }

  // Cerrar notificaciones con la tecla Escape
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showNotifications) {
        this.showNotifications = false;
      }
      if (this.showMarkAllReadModal) {
        this.closeMarkAllReadModal();
      }
      if (this.showDeleteAllModal) {
        this.closeDeleteAllModal();
      }
      if (this.showDeleteSingleModal) {
        this.closeDeleteSingleModal();
      }
    }
  }

  // Cerrar modales
  closeMarkAllReadModal(): void {
    this.showMarkAllReadModal = false;
  }

  closeDeleteAllModal(): void {
    this.showDeleteAllModal = false;
  }

  closeDeleteSingleModal(): void {
    this.showDeleteSingleModal = false;
    this.notificationToDelete = null;
  }
}
