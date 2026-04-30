import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, ModalShellComponent],
  templateUrl: './confirm-modal.component.html',
})
export class ConfirmModalComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() confirmText = 'Confirmar';
  @Input() cancelText = 'Cancelar';
  @Input() tone: 'danger' | 'warning' | 'primary' = 'danger';
  @Input() icon = 'report_problem';
  @Input() modalId: string | null = null;

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  get iconColorClass(): string {
    switch (this.tone) {
      case 'warning':
        return 'text-orange-600';
      case 'primary':
        return 'text-sky-600';
      default:
        return 'text-red-600';
    }
  }

  get confirmButtonClass(): string {
    switch (this.tone) {
      case 'warning':
        return 'app-warning-button';
      case 'primary':
        return 'app-primary-button';
      default:
        return 'app-warning-button';
    }
  }
}
