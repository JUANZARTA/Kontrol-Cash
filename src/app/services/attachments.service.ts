import { Injectable } from '@angular/core';
import { MovementAttachment } from '../models/attachment.model';

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private readonly key = 'movement-attachments';
  private readonly maxBytes = 5 * 1024 * 1024;

  private sanitizePathPart(value: string): string {
    return value
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private sanitizeFileName(fileName: string): string {
    const justName = fileName.split(/[\\/]/).pop() || 'attachment';
    const safe = justName
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return safe || 'attachment';
  }

  private readAll(): MovementAttachment[] {
    const raw = localStorage.getItem(this.key);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as MovementAttachment[];
    } catch {
      return [];
    }
  }

  private writeAll(items: MovementAttachment[]): void {
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  private buildPath(ownerUid: string, year: string, month: string, movementId: string, fileName: string): string {
    const safeOwner = this.sanitizePathPart(ownerUid);
    const safeYear = this.sanitizePathPart(year);
    const safeMonth = this.sanitizePathPart(month);
    const safeMovement = this.sanitizePathPart(movementId);
    const safeFile = this.sanitizeFileName(fileName);
    return `/attachments/${safeOwner}/${safeYear}/${safeMonth}/${safeMovement}/${safeFile}`;
  }

  list(ownerUid: string, year: string, month: string, movementId: string): MovementAttachment[] {
    const safeOwner = this.sanitizePathPart(ownerUid);
    const prefix = `/attachments/${safeOwner}/${this.sanitizePathPart(year)}/${this.sanitizePathPart(month)}/${this.sanitizePathPart(movementId)}/`;
    return this.readAll().filter((item) => item.ownerUid === safeOwner && item.path.startsWith(prefix));
  }

  async upload(ownerUid: string, year: string, month: string, movementId: string, file: File): Promise<MovementAttachment> {
    if (!ownerUid || !year || !month || !movementId) {
      throw new Error('Attachment routing context is required');
    }
    if (file.size > this.maxBytes) {
      throw new Error('Attachment exceeds maximum allowed size');
    }

    const content = await file.text();
    const id = crypto.randomUUID();
    const encoded = btoa(unescape(encodeURIComponent(content)));
    const safeFileName = this.sanitizeFileName(file.name);
    const attachment: MovementAttachment = {
      id,
      ownerUid: this.sanitizePathPart(ownerUid),
      path: this.buildPath(ownerUid, year, month, movementId, safeFileName),
      mime: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: new Date().toISOString(),
      fileName: safeFileName,
      downloadUrl: `data:${file.type || 'application/octet-stream'};base64,${encoded}`,
    };

    const all = this.readAll();
    all.push(attachment);
    this.writeAll(all);
    return attachment;
  }

  delete(ownerUid: string, year: string, month: string, movementId: string, attachmentId: string): boolean {
    const safeOwner = this.sanitizePathPart(ownerUid);
    const prefix = `/attachments/${safeOwner}/${this.sanitizePathPart(year)}/${this.sanitizePathPart(month)}/${this.sanitizePathPart(movementId)}/`;
    const all = this.readAll();
    const next = all.filter((item) => !(item.ownerUid === safeOwner && item.path.startsWith(prefix) && item.id === attachmentId));
    if (next.length === all.length) return false;
    this.writeAll(next);
    return true;
  }
}
