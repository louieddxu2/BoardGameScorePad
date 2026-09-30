import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './ai-generator.js';

const createRequest = (formData, contentLength) => ({
  method: 'POST',
  headers: new Headers(contentLength ? { 'content-length': String(contentLength) } : {}),
  formData: vi.fn().mockResolvedValue(formData),
});

describe('AI generator API request guards', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.restoreAllMocks();
  });

  it('rejects an oversized request before parsing its body', async () => {
    const request = createRequest(new FormData(), 10 * 1024 * 1024 + 1);

    const response = await handler(request);

    expect(response.status).toBe(413);
    expect(request.formData).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: 'request_too_large' });
  });

  it('rejects more images than the client supports', async () => {
    const formData = new FormData();
    for (let index = 0; index < 6; index += 1) {
      formData.append(`image_${index}`, new File(['image'], `image-${index}.jpg`, { type: 'image/jpeg' }));
    }

    const response = await handler(createRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'too_many_images' });
  });

  it('rejects unsupported upload types before calling external services', async () => {
    const formData = new FormData();
    formData.append('image_0', new File(['text'], 'notes.txt', { type: 'text/plain' }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await handler(createRequest(formData));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: 'invalid_image_upload' });
  });

  it('does not expose stack traces when request parsing fails', async () => {
    const request = createRequest(new FormData());
    request.formData.mockRejectedValue(new Error('sensitive internal detail'));

    const response = await handler(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'server_error' });
  });
});
