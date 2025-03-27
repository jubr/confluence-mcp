import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ConfluenceApiService } from '../confluence-api.js';

// Mock global fetch
const originalFetch = global.fetch;

// --- Test Suite ---

describe('ConfluenceApiService - Error Handling', () => {
  let apiService: ConfluenceApiService;
  const mockBaseUrl = 'https://example.atlassian.net/wiki';
  const mockEmail = 'test@example.com';
  const mockApiToken = 'api-token-123';

  beforeEach(() => {
    // Reset the global fetch before each test
    global.fetch = mock(() => {
      // Default mock, can be overridden in specific tests
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    apiService = new ConfluenceApiService(mockBaseUrl, mockEmail, mockApiToken);
  });

  afterEach(() => {
    // Restore the original fetch after each test
    global.fetch = originalFetch;
  });

  test('should handle network errors', async () => {
    // Mock a network error
    global.fetch = mock(() => {
      return Promise.reject(new Error('Network error'));
    });

    // Test with one method, assuming handleFetchError is used consistently
    await expect(apiService.getPage('page-123')).rejects.toThrow('Network error');
  });

  test('should handle 404 errors specifically for content URLs', async () => {
    // Mock a 404 response for a content URL
    global.fetch = mock(() => {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      }));
    });

    const pageId = 'non-existent-page';
    // Test with getPage
    await expect(apiService.getPage(pageId)).rejects.toThrow('Confluence API Error: Not found (Status: 404)');
    // Test with getComments
    await expect(apiService.getComments(pageId)).rejects.toThrow('Confluence API Error: Not found (Status: 404)');
    // Test with updatePage (will fail on the initial GET)
    await expect(apiService.updatePage(pageId, 't', 'c', 1)).rejects.toThrow('Confluence API Error: Not found (Status: 404)');
    // Test with getAttachments (add this when implemented)
    // await expect(apiService.getAttachments(pageId)).rejects.toThrow('Confluence API Error: Not found (Status: 404)');
  });

  test('should handle 404 errors for non-content URLs', async () => {
    // Mock a 404 response for a different type of URL (e.g., search)
    global.fetch = mock((url) => {
      if (url.toString().includes('/rest/api/content/search')) {
        return Promise.resolve(new Response(JSON.stringify({ message: 'Search endpoint not found' }), {
          status: 404,
          statusText: 'Not Found'
        }));
      }
      // Default mock for other calls if needed
      return Promise.resolve(new Response(JSON.stringify({})));
    });

    await expect(apiService.searchPages('test')).rejects.toThrow('Confluence API Error: Search endpoint not found');
  });

  test('should handle generic API errors (e.g., 500)', async () => {
    // Mock a 500 response
    global.fetch = mock(() => {
      return Promise.resolve(new Response(JSON.stringify({ message: 'Internal server error' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      }));
    });

    // Test with one method, assuming handleFetchError is used consistently
    await expect(apiService.getPage('page-123')).rejects.toThrow('Confluence API Error: Internal server error');
  });

  test('should handle non-JSON error responses', async () => {
     global.fetch = mock(() => {
       return Promise.resolve(new Response('<html><body>Gateway Timeout</body></html>', {
         status: 504,
         statusText: 'Gateway Timeout',
         headers: new Headers({ 'Content-Type': 'text/html' })
       }));
     });

     await expect(apiService.getPage('page-123')).rejects.toThrow('Confluence API Error: Gateway Timeout (Status: 504)');
   });

   test('should handle errors during comment creation POST', async () => {
      // Mock only the POST call to fail
      global.fetch = mock((url, options) => {
         if (options?.method === 'POST') {
            return Promise.resolve(new Response(JSON.stringify({ message: 'Container not found' }), {
              status: 400,
              statusText: 'Bad Request'
            }));
         }
         // Should not reach GET if POST fails
         return Promise.resolve(new Response(JSON.stringify({ message: 'Unexpected GET call' }), { status: 500 }));
      });

      const invalidPageId = 'invalid-page';
      const content = '<p>Test</p>';
      await expect(apiService.addComment(invalidPageId, content)).rejects.toThrow('Confluence API Error: Container not found');
    });

     test('should handle errors during subsequent GET after comment creation', async () => {
       // Mock POST success, but GET failure
       const postMock = mock(() => {
         return Promise.resolve(new Response(JSON.stringify({ id: 'temp-comment-id' }), { status: 200 }));
       });
       const getMock = mock(() => {
         return Promise.resolve(new Response(JSON.stringify({ message: 'Unauthorized to view comment' }), {
           status: 403,
           statusText: 'Forbidden'
         }));
       });

       global.fetch = mock((url, options) => {
         if (options?.method === 'POST') {
           return postMock();
         } else if (url.toString().includes('/rest/api/content/temp-comment-id')) {
           return getMock();
         }
         return Promise.resolve(new Response(JSON.stringify({ message: 'Unexpected fetch call' }), { status: 500 }));
       });


      const pageId = 'page-123';
        const content = '<p>Test</p>';
        await expect(apiService.addComment(pageId, content)).rejects.toThrow('Confluence API Error: Unauthorized');
      });

      // Add error tests for addAttachment here when implemented
      // test('should handle errors during attachment upload POST', async () => { ... });
      // test('should handle errors during subsequent GET after attachment upload', async () => { ... });

});
