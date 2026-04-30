import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../../services/theme.service';

Chart.register(...registerables);

@Component({
  selector: 'app-financial-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-chart.component.html',
  styleUrls: ['./financial-chart.component.css'],
})
export class FinancialChartComponent implements OnInit, OnChanges, OnDestroy {
  @Input() ingresosTotales = 0;
  @Input() gastosTotales = 0;
  @Input() totalDeuda = 0;
  @Input() totalBilletera = 0;
  @Input() totalPrestamo = 0;

  private chart: Chart | null = null;
  private themeSubscription?: Subscription;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeSubscription = this.themeService.theme$.subscribe(() => {
      this.renderChart();
    });
  }

  ngOnChanges(_: SimpleChanges): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.themeSubscription?.unsubscribe();
    this.chart?.destroy();
  }

  private renderChart() {
    if (!isPlatformBrowser(this.platformId)) return;

    const canvas = document.getElementById(
      'financialChart'
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const dataValues = [
      this.ingresosTotales,
      this.gastosTotales,
      this.totalDeuda,
      this.totalBilletera,
      this.totalPrestamo,
    ];

    const labels = [
      'Ingresos',
      'Gastos',
      'Deudas',
      'Billetera',
      'Préstamos',
    ];

    const total = dataValues.reduce((a, b) => a + b, 0);

    // 🔸 Si no hay datos, dibuja un anillo gris (placeholder)
    let chartData: number[];
    let chartColors: string[];
    let chartLabels: string[];

    if (total === 0) {
      chartData = [1]; // valor ficticio para renderizar
      chartColors = [this.themeService.isDarkMode() ? '#334155' : '#e5e7eb'];
      chartLabels = ['Sin datos'];
    } else {
      chartData = dataValues;
      chartColors = [
        '#00af4fff',
        '#ff7b00ff',
        '#df0f00ff',
        '#0045dbff',
        '#753affff',
      ];
      chartLabels = labels;
    }

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [
          {
            data: chartData,
            backgroundColor: chartColors,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.themeService.isDarkMode() ? '#e2e8f0' : '#374151',
              font: { size: 13 },
            },
          },
          tooltip: {
            enabled: total > 0, // 🔹 sin tooltip si está vacío
          },
        },
        animation: {
          animateScale: true,
          animateRotate: true,
          duration: 800,
        },
      },
    });

    // console.log('🎨 Renderizando gráfica con datos:', {
    //   ingresos: this.ingresosTotales,
    //   gastos: this.gastosTotales,
    //   deuda: this.totalDeuda,
    //   billetera: this.totalBilletera,
    //   prestamo: this.totalPrestamo,
    //   total,
    // });
  }
}
