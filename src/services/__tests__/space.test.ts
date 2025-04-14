import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ConfluenceApiService } from '../confluence-api.js';
import { ConfluenceSpace } from '../../types/confluence.js'; // Assuming this type is needed

// Mock global fetch
const originalFetch = global.fetch;

// --- Mock Data ---
const mockSpacesResponse = {
  results: [
    {
      id: 'space-123',
      key: 'TEST',
      name: 'Test Space',
      description: {
        plain: {
          value: 'This is a test space'
        }
      },
      type: 'GLOBAL',
      status: 'CURRENT'
    }
  ],
  size: 1
};

// --- Test Suite ---

describe('ConfluenceApiService - Spaces', () => {
  let apiService: ConfluenceApiService;
  const mockBaseUrl = 'https://example.atlassian.net/wiki';
  const mockEmail = 'test@example.com';
  const mockApiToken = 'api-token-123';

  beforeEach(() => {
    // Reset the global fetch before each test
    global.fetch = mock(() => {
      return Promise.resolve(new Response(JSON.stringify({}), {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      }));
    }) as any;

    apiService = new ConfluenceApiService(mockBaseUrl, mockEmail, mockApiToken);
  });

  afterEach(() => {
    // Restore the original fetch after each test
    global.fetch = originalFetch;
  });

  describe('getSpaces', () => {
    test('should fetch and clean spaces', async () => {
      // Mock the fetch response
      global.fetch = mock(() => {
        return Promise.resolve(new Response(JSON.stringify(mockSpacesResponse), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      }) as any;

      const result = await apiService.getSpaces();

      // Verify the result
      expect(result).toBeObject();
      expect(result.total).toBe(mockSpacesResponse.size);
      expect(result.spaces).toBeArray();
      expect(result.spaces).toHaveLength(1);

      // Check the first space
      const space = result.spaces[0];
      expect(space.id).toBe(mockSpacesResponse.results[0].id);
      expect(space.key).toBe(mockSpacesResponse.results[0].key);
      expect(space.name).toBe(mockSpacesResponse.results[0].name);
      expect(space.description).toBe(mockSpacesResponse.results[0].description.plain.value);
      expect(space.type).toBe('global'); // Check cleaning logic
      expect(space.status).toBe('current'); // Check cleaning logic

      // Verify the fetch was called with the correct URL
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain(`${mockBaseUrl}/rest/api/space`);
      // Verify expand parameters match implementation
      expect(fetchCall[0]).toContain('expand=description.plain');
    });

    test('should handle empty spaces result', async () => {
        // Mock an empty response
        global.fetch = mock(() => {
          return Promise.resolve(new Response(JSON.stringify({ results: [], size: 0 }), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          }));
        }) as any;

        const result = await apiService.getSpaces();

        expect(result.total).toBe(0);
        expect(result.spaces).toHaveLength(0);
      });

    // Note: Error handling tests for getSpaces are moved to error.test.ts
  });
});
