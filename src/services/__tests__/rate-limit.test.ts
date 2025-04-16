import { describe, test as it, expect, mock, beforeEach, afterEach } from 'bun:test'; // Use bun:test
import { ConfluenceApiService } from '../confluence-api';
import type { Mock } from 'bun:test'; // Import Mock type

// Define mockFetch globally and initialize, then reassign in beforeEach
let mockFetch: Mock<typeof fetch> = mock(); // Initialize with a mock
global.fetch = mockFetch as any;

describe('ConfluenceApiService - Rate Limiting', () => {
  const BASE_URL = 'https://test.atlassian.net/wiki';
  const EMAIL = 'test@example.com';
  const TOKEN = 'test-token';
  // Explicitly type the spy to match Bun.sleep signature using bun:test Mock
  let sleepSpy: Mock<(ms: number | Date) => Promise<void>>;

  beforeEach(() => {
    // Reset mocks before each test
    mock.restore(); // Restore any spies/mocks
    // Create a NEW mock instance for fetch for each test
    mockFetch = mock<typeof fetch>(); // Assign new mock instance
    global.fetch = mockFetch as any;
    // Directly mock Bun.sleep to create a spy
    sleepSpy = mock<(ms: number | Date) => Promise<void>>(Bun.sleep).mockResolvedValue(undefined);
    Bun.sleep = sleepSpy; // Assign the mock
    // Provide a default successful response for fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: mock().mockResolvedValue({ id: '123', title: 'Test Page' }), // Use bun:test mock
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
    } as unknown as Response);
  });

  // Add afterEach to restore mocks
  afterEach(() => {
    mock.restore(); // Correct method
    // Restore original Bun.sleep if necessary, though mock.restore() should handle it
  });

  it('should call Bun.sleep with the configured delay if requestDelay > 0', async () => {
    const delay = 150;
    const apiService = new ConfluenceApiService(BASE_URL, EMAIL, TOKEN, delay);

    // Call any method that uses fetchJson
    await apiService.getPage('123');

    // Check if fetch was called (ensuring the sleep path was reached)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Check if Bun.sleep was called before fetch
    expect(sleepSpy).toHaveBeenCalledTimes(1); // Use the spy
    expect(sleepSpy).toHaveBeenCalledWith(delay);
  });

  it('should NOT call Bun.sleep if requestDelay is 0', async () => {
    const delay = 0;
    const apiService = new ConfluenceApiService(BASE_URL, EMAIL, TOKEN, delay);

    await apiService.getPage('123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled(); // Use the spy
  });

  it('should NOT call Bun.sleep if requestDelay is negative', async () => {
    const delay = -100;
    const apiService = new ConfluenceApiService(BASE_URL, EMAIL, TOKEN, delay);

    await apiService.getPage('123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled(); // Use the spy
  });

  // Test rate limiting specifically for addAttachment as it has its own sleep call
  it('should call Bun.sleep before fetch in addAttachment if requestDelay > 0', async () => {
    const delay = 180;
    const apiService = new ConfluenceApiService(BASE_URL, EMAIL, TOKEN, delay);
    const fileContent = Buffer.from('test content');
    const filename = 'test.txt';
    const pageId = '456';

    // Mock response for the attachment upload itself
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: mock().mockResolvedValue({ results: [{ id: 'att1' }] }), // Use bun:test mock
      status: 200,
    } as unknown as Response);
    // No second fetch mock needed anymore

    await apiService.addAttachment(pageId, fileContent, filename);

    // addAttachment now makes only one fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Bun.sleep should be called once directly in addAttachment
    expect(sleepSpy).toHaveBeenCalledTimes(1); // Use the spy
    expect(sleepSpy).toHaveBeenCalledWith(delay);
  });

  it('should NOT call Bun.sleep before fetch in addAttachment if requestDelay is 0', async () => {
    const delay = 0;
    const apiService = new ConfluenceApiService(BASE_URL, EMAIL, TOKEN, delay);
    const fileContent = Buffer.from('test content');
    const filename = 'test.txt';
    const pageId = '456';

    // Mock responses
    mockFetch.mockResolvedValueOnce({
      ok: true,
      // Ensure the mock response includes the 'results' array needed by the modified addAttachment
      json: mock().mockResolvedValue({
        results: [{ id: 'att1', title: filename }],
      }), // Use bun:test mock
      status: 200,
    } as unknown as Response);
    // No second fetch call mock needed anymore

    await apiService.addAttachment(pageId, fileContent, filename);

    // addAttachment now makes only one fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled(); // Use the spy
  });
});
