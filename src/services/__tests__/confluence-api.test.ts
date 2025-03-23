import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ConfluenceApiService } from '../confluence-api.js';
import { CleanConfluencePage, ConfluenceSpace } from '../../types/confluence.js';

// Mock global fetch
const originalFetch = global.fetch;

describe('ConfluenceApiService', () => {
  let apiService: ConfluenceApiService;
  const mockBaseUrl = 'https://example.atlassian.net/wiki';
  const mockEmail = 'test@example.com';
  const mockApiToken = 'api-token-123';

  // Mock response data
  const mockPageResponse = {
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
    });

    apiService = new ConfluenceApiService(mockBaseUrl, mockEmail, mockApiToken);
  });

  afterEach(() => {
    // Restore the original fetch after each test
    global.fetch = originalFetch;
  });

  describe('getPage', () => {
    test('should fetch and clean a page', async () => {
      // Mock the fetch response for this specific test
      global.fetch = mock(() => {
        return Promise.resolve(new Response(JSON.stringify(mockPageResponse), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      });

      const pageId = 'page-123';
      const page = await apiService.getPage(pageId);

      // Verify the result is properly cleaned
      expect(page).toBeObject();
      expect(page.id).toBe(mockPageResponse.id);
      expect(page.title).toBe(mockPageResponse.title);
      expect(page.spaceKey).toBe('TEST');
      expect(page.version).toBe(mockPageResponse.version.number);
      expect(page.content).toBe('This is test content');
      expect(page.created).toBe(mockPageResponse.created);
      expect(page.updated).toBe(mockPageResponse.updated);
      expect(page.createdBy.displayName).toBe(mockPageResponse.history.createdBy.displayName);
      expect(page.updatedBy.displayName).toBe(mockPageResponse.history.lastUpdated.by.displayName);
      expect(page.links.webui).toBe(mockPageResponse._links.webui);
      expect(page.parentId).toBe(mockPageResponse.ancestors[0].id);
      expect(page.labels).toHaveLength(1);
      expect(page.labels?.[0].name).toBe('test-label');

      // Verify the fetch was called with the correct URL and headers
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain(`${mockBaseUrl}/rest/api/content/${pageId}`);
      expect(fetchCall[0]).toContain('expand=body.storage%2Cversion%2Cancestors%2Chistory%2Cmetadata.labels%2Cspace%2Cchildren.page');
    });

    test('should handle API errors', async () => {
      // Mock an error response
      global.fetch = mock(() => {
        return Promise.resolve(new Response(JSON.stringify({ message: 'Page not found' }), {
          status: 404,
          statusText: 'Not Found',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      });

      const pageId = 'non-existent-page';
      
      // Expect the getPage call to throw an error
      await expect(apiService.getPage(pageId)).rejects.toThrow('Content not found');
    });
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
      });

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

      // Verify the fetch was called with the correct URL and parameters
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain(`${mockBaseUrl}/rest/api/content/search`);
      expect(fetchCall[0]).toContain(`cql=${query}`);
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
      });

      const query = 'nonexistent';
      const result = await apiService.searchPages(query);

      expect(result.total).toBe(0);
      expect(result.pages).toHaveLength(0);
    });
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
      });

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
      expect(space.type).toBe('global');
      expect(space.status).toBe('current');

      // Verify the fetch was called with the correct URL
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain(`${mockBaseUrl}/rest/api/space`);
    });
  });

  describe('createPage', () => {
    test('should create a page and return the cleaned result', async () => {
      // First mock the POST request to create the page
      const createMock = mock(() => {
        return Promise.resolve(new Response(JSON.stringify({ id: 'new-page-123' }), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      });

      // Then mock the GET request to fetch the created page details
      const getMock = mock(() => {
        return Promise.resolve(new Response(JSON.stringify({
          ...mockPageResponse,
          id: 'new-page-123',
          title: 'New Test Page'
        }), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      });

      // Set up the fetch mock to handle both requests in sequence
      global.fetch = mock((url) => {
        if (url.includes('/rest/api/content') && !url.includes('new-page-123')) {
          return createMock();
        } else {
          return getMock();
        }
      });

      const spaceKey = 'TEST';
      const title = 'New Test Page';
      const content = '<p>New page content</p>';
      const parentId = 'parent-123';

      const page = await apiService.createPage(spaceKey, title, content, parentId);

      // Verify the result
      expect(page).toBeObject();
      expect(page.id).toBe('new-page-123');
      expect(page.title).toBe('New Test Page');
      expect(page.spaceKey).toBe('TEST');

      // Verify the fetch was called with the correct payload
      expect(global.fetch).toHaveBeenCalledTimes(2); // Once for create, once for get
      const createCall = (global.fetch as any).mock.calls[0];
      expect(createCall[0]).toBe(`${mockBaseUrl}/rest/api/content`);
      expect(createCall[1].method).toBe('POST');
      
      const requestBody = JSON.parse(createCall[1].body);
      expect(requestBody.type).toBe('page');
      expect(requestBody.title).toBe(title);
      expect(requestBody.space.key).toBe(spaceKey);
      expect(requestBody.body.storage.value).toBe(content);
      expect(requestBody.ancestors).toBeArray();
      expect(requestBody.ancestors[0].id).toBe(parentId);
    });
  });

  describe('updatePage', () => {
    test('should update a page and return the cleaned result', async () => {
      // First mock the GET request to fetch the current page
      const getMock = mock(() => {
        return Promise.resolve(new Response(JSON.stringify(mockPageResponse), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      });

      // Then mock the PUT request to update the page
      const updateMock = mock(() => {
        return Promise.resolve(new Response(JSON.stringify({
          ...mockPageResponse,
          title: 'Updated Test Page',
          version: { number: 6 }
        }), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        }));
      });

      // Set up the fetch mock to handle both requests in sequence
      global.fetch = mock((url, options) => {
        if (options?.method === 'PUT') {
          return updateMock();
        } else {
          return getMock();
        }
      });

      const pageId = 'page-123';
      const title = 'Updated Test Page';
      const content = '<p>Updated content</p>';
      const version = 5;

      const page = await apiService.updatePage(pageId, title, content, version);

      // Verify the result
      expect(page).toBeObject();
      expect(page.id).toBe(pageId);
      expect(page.title).toBe(mockPageResponse.title); // The title from the GET response

      // Verify the fetch was called with the correct payload
      expect(global.fetch).toHaveBeenCalledTimes(3); // Once for get, once for update, and once for get again
      const updateCall = (global.fetch as any).mock.calls[1];
      expect(updateCall[0]).toBe(`${mockBaseUrl}/rest/api/content/${pageId}`);
      expect(updateCall[1].method).toBe('PUT');
      
      const requestBody = JSON.parse(updateCall[1].body);
      expect(requestBody.type).toBe('page');
      expect(requestBody.title).toBe(title);
      expect(requestBody.space.key).toBe('TEST');
      expect(requestBody.body.storage.value).toBe(content);
      expect(requestBody.version.number).toBe(version + 1);
    });
  });

  describe('error handling', () => {
    test('should handle network errors', async () => {
      // Mock a network error
      global.fetch = mock(() => {
        return Promise.reject(new Error('Network error'));
      });

      await expect(apiService.getPage('page-123')).rejects.toThrow('Network error');
    });

    test('should handle 404 errors with content ID', async () => {
      // Mock a 404 response
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
      await expect(apiService.getPage(pageId)).rejects.toThrow(`Content not found: ${pageId}`);
    });

    test('should handle other API errors', async () => {
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

      await expect(apiService.getPage('page-123')).rejects.toThrow('Confluence API Error: Internal server error');
    });
  });
});
