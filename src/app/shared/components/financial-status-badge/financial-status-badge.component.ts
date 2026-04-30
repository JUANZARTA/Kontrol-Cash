import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-financial-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-status-badge.component.html',
})
export class FinancialStatusBadgeComponent {
  @Input({ required: true }) label = '';
  @Input() color: 'verde' | 'rojo' | 'azul' = 'verde';
}
