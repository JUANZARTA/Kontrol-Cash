import {
  Component,
  Input,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import Chart from 'chart.js/auto';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.component.html',
  styleUrls: ['./bar-chart.component.css']
})
export class BarChartComponent implements AfterViewInit, OnChanges, OnInit, OnDestroy {

  @Input() ingresos: number = 0;
  @Input() billetera: number = 0;
  @Input() gastos: number = 0;

  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  chart!: Chart;

  private themeSubscription?: Subscription;

  constructor(private themeService: ThemeService) {}

  ngOnInit() {
    this.themeSubscription = this.themeService.theme$.subscribe(() => {
      if (this.chart) {
        this.createChart();
      }
    });
  }

  ngAfterViewInit() {
    this.createChart(); // se crea vacía o con ceros
  }

  ngOnChanges(changes: SimpleChanges) {
    // si ya existe la gráfica, se actualiza
    if (this.chart) {
      this.updateChart();
    }
  }

  ngOnDestroy() {
    this.themeSubscription?.unsubscribe();
    this.chart?.destroy();
  }

  createChart() {
    if (!this.barCanvas) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.barCanvas.nativeElement.getContext('2d')!;
    const isDarkMode = this.themeService.isDarkMode();
    const tickColor = isDarkMode ? '#cbd5e1' : '#475569';
    const gridColor = isDarkMode ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.24)';

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Ingresos', 'billetera', 'Gastos'],
        datasets: [
          {
            label: 'Valores ($)',
            data: [this.ingresos, this.billetera, this.gastos],
            backgroundColor: ['#00af4fff', '#0045dbff', '#ff7b00ff'],
            borderRadius: 10,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: tickColor,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: tickColor,
            },
            grid: {
              color: gridColor,
            },
          },
          y: {
            ticks: {
              color: tickColor,
            },
            grid: {
              color: gridColor,
            },
          },
        },
      }
    });
  }

  updateChart() {
    this.chart.data.datasets[0].data = [
      this.ingresos,
      this.billetera,
      this.gastos
    ];
    this.chart.update();
  }
}
