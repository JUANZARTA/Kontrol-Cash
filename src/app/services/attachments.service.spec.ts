import { TestBed } from '@angular/core/testing';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttachmentsService);
    localStorage.clear();
  });

  it('stores and lists attachments by movement and owner', async () => {
    const file = new File(['receipt'], 'receipt.txt', { type: 'text/plain' });

    const saved = await service.upload('u1', '2026', '05', 'm-1', file);

    expect(saved.ownerUid).toBe('u1');
    expect(saved.path).toContain('/attachments/u1/2026/05/m-1/');

    const listed = service.list('u1', '2026', '05', 'm-1');
    expect(listed.length).toBe(1);
    expect(listed[0].fileName).toBe('receipt.txt');
  });

  it('deletes only owner attachment and keeps others untouched', async () => {
    const a = await service.upload('u1', '2026', '05', 'm-2', new File(['a'], 'a.txt', { type: 'text/plain' }));
    await service.upload('u2', '2026', '05', 'm-2', new File(['b'], 'b.txt', { type: 'text/plain' }));

    const deleted = service.delete('u1', '2026', '05', 'm-2', a.id || '');

    expect(deleted).toBeTrue();
    expect(service.list('u1', '2026', '05', 'm-2').length).toBe(0);
    expect(service.list('u2', '2026', '05', 'm-2').length).toBe(1);
  });

  it('sanitizes unsafe filename and path segments', async () => {
    const file = new File(['receipt'], '../evil?.txt', { type: 'text/plain' });

    const saved = await service.upload('u/1', '2026', '05', 'm..1', file);

    expect(saved.path).toContain('/attachments/u_1/2026/05/m_1/');
    expect(saved.path).not.toContain('..');
    expect(saved.fileName).toBe('evil_.txt');
  });

  it('rejects upload when required routing context is missing', async () => {
    const file = new File(['receipt'], 'receipt.txt', { type: 'text/plain' });

    await expectAsync(service.upload('', '2026', '05', 'm-1', file)).toBeRejected();
  });
});
