import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MonthlyCloseSnapshot } from '../../models/monthly-close.model';
import { MonthlyCloseService } from '../../services/monthly-close.service';

@Component({
  selector: 'app-month-close',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './month-close.component.html',
})
export default class MonthCloseComponent {
  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;
  snapshots: MonthlyCloseSnapshot[] = [];

  constructor(private monthlyCloseService: MonthlyCloseService) {
    this.snapshots = this.monthlyCloseService.list(this.userId);
  }

  download(snapshot: MonthlyCloseSnapshot): void {
    this.monthlyCloseService.downloadPdf(snapshot);
  }
}
