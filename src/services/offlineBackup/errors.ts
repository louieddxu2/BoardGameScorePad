export class BackupError extends Error {
  constructor(public code: 'invalid' | 'missing_image' | 'busy' | 'storage' | 'unsupported', detail = '') {
    super(detail || code);
  }
}
