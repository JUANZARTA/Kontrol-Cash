import { MonthlyCloseService } from './monthly-close.service';
import { MonthlyCloseSnapshot } from '../models/monthly-close.model';

describe('MonthlyCloseService', () => {
  let service: MonthlyCloseService;
  const uid = 'u-test';

  const baseSnapshot = (period: string): MonthlyCloseSnapshot => ({
    period,
    closedAt: '2026-05-01T00:00:00.000Z',
    totals: { income: 1000, expense: 400, net: 600, debtPending: 50 },
    categories: { hogar: 400 },
    pdf: { path: '/reports/u-test/2026-05.pdf', size: 1200, sha256: 'abc' },
  });

  beforeEach(() => {
    service = new MonthlyCloseService();
    localStorage.clear();
  });

  it('keeps snapshot immutable when same period closes twice', () => {
    service.closeMonth(uid, baseSnapshot('2026-05'));
    service.closeMonth(uid, { ...baseSnapshot('2026-05'), totals: { income: 9, expense: 9, net: 0, debtPending: 0 } });

    const list = service.list(uid);
    expect(list.length).toBe(1);
    expect(list[0].totals.income).toBe(1000);
  });

  it('sorts close history by latest period first', () => {
    service.closeMonth(uid, baseSnapshot('2026-03'));
    service.closeMonth(uid, baseSnapshot('2026-05'));
    service.closeMonth(uid, baseSnapshot('2026-04'));

    const periods = service.list(uid).map((item) => item.period);
    expect(periods).toEqual(['2026-05', '2026-04', '2026-03']);
  });

  it('uses safe filename when period includes invalid chars', () => {
    const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test-url');
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = jasmine.createSpy('click');
    const appendSpy = spyOn(document.body, 'appendChild').and.callFake(<T extends Node>(node: T) => node);
    const removeSpy = spyOn(document.body, 'removeChild').and.callFake(<T extends Node>(node: T) => node);
    const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
    spyOn(document, 'createElement').and.returnValue(anchor);

    service.downloadPdf({ ...baseSnapshot('2026/05?') });

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchor.download).toBe('2026-05--resumen.pdf');
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('does not throw when snapshot totals are incomplete', () => {
    const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test-url');
    spyOn(URL, 'revokeObjectURL');
    const clickSpy = jasmine.createSpy('click');
    spyOn(document.body, 'appendChild').and.callFake(<T extends Node>(node: T) => node);
    spyOn(document.body, 'removeChild').and.callFake(<T extends Node>(node: T) => node);
    const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
    spyOn(document, 'createElement').and.returnValue(anchor);

    expect(() => service.downloadPdf({ period: '2026-05' } as MonthlyCloseSnapshot)).not.toThrow();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });
});
