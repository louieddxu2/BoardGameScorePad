export class BackupError extends Error {
  constructor(public code: 'invalid' | 'busy' | 'storage' | 'unsupported', detail = '') {
    super(detail || code);
  }
}
