import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-shell.component.html',
})
export class ModalShellComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() panelClass = '';
  @Input() centered = false;
  @Input() size: 'sm' | 'md' = 'md';
  @Input() modalId: string | null = null;
}
