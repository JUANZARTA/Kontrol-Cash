import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-financial-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-chart.component.html',
  styleUrls: ['./financial-chart.component.css'],
})
export class FinancialChartComponent implements OnChanges {
  @Input() ingresosTotales = 0;
  @Input() gastosTotales = 0;
  @Input() totalDeuda = 0;
  @Input() totalBilletera = 0;
  @Input() totalPrestamo = 0;

  private chart: Chart | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.renderChart();
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
      chartColors = ['#e5e7eb']; // gris claro
      chartLabels = ['Sin datos'];
    } else {
      chartData = dataValues;
      chartColors = [
        '#04398fff',
        '#ef4444',
        '#f59e0b',
        '#10b981',
        '#8b5cf6',
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
              color: '#374151',
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

    console.log('🎨 Renderizando gráfica con datos:', {
      ingresos: this.ingresosTotales,
      gastos: this.gastosTotales,
      deuda: this.totalDeuda,
      billetera: this.totalBilletera,
      prestamo: this.totalPrestamo,
      total,
    });
  }
}
