import {
  Component,
  Input,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.component.html',
  styleUrls: ['./bar-chart.component.css']
})
export class BarChartComponent implements AfterViewInit, OnChanges {

  @Input() ingresos: number = 0;
  @Input() billetera: number = 0;
  @Input() gastos: number = 0;

  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  chart!: Chart;

  ngAfterViewInit() {
    this.createChart(); // se crea vacía o con ceros
  }

  ngOnChanges(changes: SimpleChanges) {
    // si ya existe la gráfica, se actualiza
    if (this.chart) {
      this.updateChart();
    }
  }

  createChart() {
    if (!this.barCanvas) return;

    const ctx = this.barCanvas.nativeElement.getContext('2d')!;

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
        maintainAspectRatio: false
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
