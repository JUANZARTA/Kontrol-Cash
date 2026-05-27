import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({ selector: '[appLongPress]', standalone: true })
export class LongPressDirective {
  @Output() longPress = new EventEmitter<void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private moved = false;

  @HostListener('pointerdown')
  onPointerDown(): void {
    this.moved = false;
    this.timer = setTimeout(() => {
      if (!this.moved) this.longPress.emit();
    }, 500);
  }

  @HostListener('pointermove')
  onPointerMove(): void { this.moved = true; this.clearTimer(); }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  @HostListener('pointerleave')
  onPointerEnd(): void { this.clearTimer(); }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}
