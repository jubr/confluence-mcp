import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ConfluenceApiService } from '../confluence-api.js';
import { CleanConfluencePage } from '../../types/confluence.js'; // Assuming this type is needed

// Mock global fetch
const originalFetch = global.fetch;

// --- Mock Data ---
const mockPageResponse = { // Needed for the structure within search results
  id: 'page-123',
  title: 'Test Page',
  _expandable: {
    space: '/rest/api/space/TEST'
  },
  version: {
    number: 5
  },
  body: {
    storage: {
      value: '<p>This is test content</p>'
    }
  },
  created: '2023-01-01T12:00:00.000Z',
  updated: '2023-01-02T12:00:00.000Z',
  history: {
    createdBy: {
      accountId: 'user-123',
      displayName: 'Test User',
      email: 'user@example.com'
    },
    lastUpdated: {
      by: {
        accountId: 'user-456',
        displayName: 'Another User',
        email: 'another@example.com'
      }
    }
  },
  _links: {
    webui: '/pages/123',
    editui: '/pages/123/edit',
    tinyui: '/x/abc'
  },
  ancestors: [
    { id: 'parent-123' }
  ],
  metadata: {
    labels: {
      results: [
        { name: 'test-label', id: 'label-123' }
      ]
    }
  }
};

const mockSearchResponse = {
  results: [mockPageResponse],
  totalSize: 1
};

// --- Test Suite ---

describe('ConfluenceApiService - Search', () => {
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

  describe('searchPages', () => {
    test('should search and clean pages', async () => {
      // Mock the fetch response
      global.fetch = mock(() => {
        return Promise.resolve(new Response(JSON.stringify(mockSearchResponse), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      }) as any;

      const query = 'test';
      const result = await apiService.searchPages(query);

      // Verify the result
      expect(result).toBeObject();
      expect(result.total).toBe(mockSearchResponse.totalSize);
      expect(result.pages).toBeArray();
      expect(result.pages).toHaveLength(1);

      // Check the first page
      const page = result.pages[0];
      expect(page.id).toBe(mockPageResponse.id);
      expect(page.title).toBe(mockPageResponse.title);
      // Add more checks based on cleaning if necessary
      expect(page.content).toBe('This is test content');

      // Verify the fetch was called with the correct URL and parameters
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain(`${mockBaseUrl}/rest/api/content/search`);
      expect(fetchCall[0]).toContain(`cql=${query}`);
      // Verify expand parameters match implementation
      expect(fetchCall[0]).toContain('expand=body.storage%2Cversion%2Cancestors%2Chistory%2Cmetadata.labels%2Cspace');
    });

    test('should handle empty search results', async () => {
      // Mock an empty response
      global.fetch = mock(() => {
        return Promise.resolve(new Response(JSON.stringify({ results: [], totalSize: 0 }), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      }) as any;

      const query = 'nonexistent';
      const result = await apiService.searchPages(query);

      expect(result.total).toBe(0);
      expect(result.pages).toHaveLength(0);
    });

    // Note: Error handling tests for searchPages are moved to error.test.ts
  });
});
