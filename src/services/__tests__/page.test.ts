import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ConfluenceApiService } from '../confluence-api.js';
import { CleanConfluencePage, EditorMode } from '../../types/confluence.js'; // Assuming this type is needed

// Mock global fetch
const originalFetch = global.fetch;

// --- Mock Data ---
const mockPageResponse = {
  id: 'page-123',
  title: 'Test Page',
  _expandable: {
    space: '/rest/api/space/TEST',
  },
  version: {
    number: 5,
  },
  body: {
    storage: {
      value: '<p>This is test content</p>',
    },
  },
  created: '2023-01-01T12:00:00.000Z',
  updated: '2023-01-02T12:00:00.000Z',
  history: {
    createdBy: {
      accountId: 'user-123',
      displayName: 'Test User',
      email: 'user@example.com',
    },
    lastUpdated: {
      by: {
        accountId: 'user-456',
        displayName: 'Another User',
        email: 'another@example.com',
      },
    },
  },
  _links: {
    webui: '/pages/123',
    editui: '/pages/123/edit',
    tinyui: '/x/abc',
  },
  ancestors: [{ id: 'parent-123' }],
  metadata: {
    labels: {
      results: [{ name: 'test-label', id: 'label-123' }],
    },
  },
};

// --- Test Suite ---

describe('ConfluenceApiService - Pages', () => {
  let apiService: ConfluenceApiService;
  const mockBaseUrl = 'https://example.atlassian.net/wiki';
  const mockEmail = 'test@example.com';
  const mockApiToken = 'api-token-123';

  beforeEach(() => {
    // Reset the global fetch before each test
    global.fetch = mock(() => {
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        })
      );
    }) as any;

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
        return Promise.resolve(
          new Response(JSON.stringify(mockPageResponse), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          })
        );
      }) as any;

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
      expect(fetchCall[0]).toContain(
        'expand=body.storage%2Cversion%2Cancestors%2Chistory%2Cmetadata.labels%2Cspace%2Cchildren.page'
      );
    });

    // Note: Error handling tests for getPage are moved to error.test.ts
  });

  describe('createPage', () => {
    test('should create a page with v2 editor by default', async () => {
      // First mock the POST request to create the page
      const createMock = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'new-page-123' }), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      // Then mock the GET request to fetch the created page details
      const getMock = mock(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockPageResponse,
              id: 'new-page-123',
              title: 'New Test Page',
            }),
            {
              status: 200,
              statusText: 'OK',
              headers: new Headers({
                'Content-Type': 'application/json',
              }),
            }
          )
        );
      });

      // Set up the fetch mock to handle both requests in sequence
      global.fetch = mock((url) => {
        if (url.includes('/rest/api/content') && !url.includes('new-page-123')) {
          return createMock();
        } else {
          return getMock();
        }
      }) as any;

      const spaceKey = 'TEST';
      const title = 'New Test Page';
      const content = '<p>New page content</p>';
      const parentId = 'parent-123';

      const page = await apiService.createPage(spaceKey, title, content, parentId);

      // Verify the result
      expect(page).toBeObject();
      expect(page.id).toBe('new-page-123');
      expect(page.title).toBe('New Test Page');

      // Verify the fetch was called with the correct payload including v2 editor metadata
      expect(global.fetch).toHaveBeenCalledTimes(2);
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
      
      // Verify v2 editor metadata is included by default
      expect(requestBody.metadata).toBeObject();
      expect(requestBody.metadata.properties.editor.key).toBe('editor');
      expect(requestBody.metadata.properties.editor.value).toBe('v2');
    });

    test('should create a page with v1 editor when explicitly specified', async () => {
      const createMock = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'new-page-v1' }), {
            status: 200,
          })
        );
      });

      const getMock = mock(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockPageResponse,
              id: 'new-page-v1',
              title: 'V1 Editor Page',
            }),
            {
              status: 200,
            }
          )
        );
      });

      global.fetch = mock((url) => {
        if (url.includes('/rest/api/content') && !url.includes('new-page-v1')) {
          return createMock();
        } else {
          return getMock();
        }
      }) as any;

      const spaceKey = 'TEST';
      const title = 'V1 Editor Page';
      const content = '<p>V1 content</p>';
      const editorMode: EditorMode = 'v1';

      await apiService.createPage(spaceKey, title, content, undefined, editorMode);

      const createCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(createCall[1].body);
      
      // Verify v1 editor metadata is included
      expect(requestBody.metadata).toBeObject();
      expect(requestBody.metadata.properties.editor.key).toBe('editor');
      expect(requestBody.metadata.properties.editor.value).toBe('v1');
    });

    test('should create a page without editor metadata when auto mode is used', async () => {
      const createMock = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'new-page-auto' }), {
            status: 200,
          })
        );
      });

      const getMock = mock(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockPageResponse,
              id: 'new-page-auto',
              title: 'Auto Mode Page',
            }),
            {
              status: 200,
            }
          )
        );
      });

      global.fetch = mock((url) => {
        if (url.includes('/rest/api/content') && !url.includes('new-page-auto')) {
          return createMock();
        } else {
          return getMock();
        }
      }) as any;

      const spaceKey = 'TEST';
      const title = 'Auto Mode Page';
      const content = '<p>Auto content</p>';
      const editorMode: EditorMode = 'auto';

      await apiService.createPage(spaceKey, title, content, undefined, editorMode);

      const createCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(createCall[1].body);
      
      // Verify no editor metadata is included for auto mode
      expect(requestBody.metadata).toBeUndefined();
    });

    test('should create a page and return the cleaned result', async () => {
      // First mock the POST request to create the page
      const createMock = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'new-page-123' }), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      // Then mock the GET request to fetch the created page details
      const getMock = mock(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockPageResponse,
              id: 'new-page-123',
              title: 'New Test Page',
            }),
            {
              status: 200,
              statusText: 'OK',
              headers: new Headers({
                'Content-Type': 'application/json',
              }),
            }
          )
        );
      });

      // Set up the fetch mock to handle both requests in sequence
      global.fetch = mock((url) => {
        if (url.includes('/rest/api/content') && !url.includes('new-page-123')) {
          return createMock();
        } else {
          return getMock();
        }
      }) as any;

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

    // Note: Error handling tests for createPage are moved to error.test.ts
  });

  describe('updatePage', () => {
    test('should update a page and return the cleaned result', async () => {
      // First mock the GET request to fetch the current page
      const getMock = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify(mockPageResponse), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      // Then mock the PUT request to update the page
      const updateMock = mock(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockPageResponse,
              title: 'Updated Test Page',
              version: { number: 6 },
            }),
            {
              status: 200,
              statusText: 'OK',
              headers: new Headers({
                'Content-Type': 'application/json',
              }),
            }
          )
        );
      });

      // Mock response for the updated page after PUT
      const updatedPageResponse = {
        ...mockPageResponse,
        title: 'Updated Test Page',
        version: { number: 6 },
        updated: '2023-01-03T12:00:00.000Z', // Simulate updated timestamp
      };
      const getUpdatedMock = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify(updatedPageResponse), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      // Set up the fetch mock to handle the sequence: GET -> PUT -> GET
      let getCallCount = 0;
      global.fetch = mock((url, options) => {
        if (options?.method === 'PUT') {
          return updateMock(); // Handle the PUT request
        } else {
          // Handle GET requests
          getCallCount++;
          if (getCallCount === 1) {
            return getMock(); // First GET returns original page
          } else {
            return getUpdatedMock(); // Second GET returns updated page
          }
        }
      }) as any;

      const pageId = 'page-123';
      const title = 'Updated Test Page';
      const content = '<p>Updated content</p>';
      const version = 5;

      const page = await apiService.updatePage(pageId, title, content, version);

      // Verify the result
      expect(page).toBeObject();
      expect(page.id).toBe(pageId);
      // The title returned should be the one from the *final* GET request after update.
      // The previous assertion was incorrect. It should expect the updated title.
      // expect(page.title).toBe('Updated Test Page'); // Corrected expectation based on implementation logic

      // Let's re-read the updatePage implementation in confluence-api.ts to be sure.
      // Okay, the implementation is: getPage -> PUT -> getPage.
      // The final getPage fetches the *updated* page. So the expectation should be the updated title.
      expect(page.title).toBe('Updated Test Page'); // Confirmed expectation

      // Verify the fetch was called with the correct payload
      expect(global.fetch).toHaveBeenCalledTimes(3); // get -> PUT -> get
      const updateCall = (global.fetch as any).mock.calls[1]; // The PUT call is the second one
      expect(updateCall[0]).toBe(`${mockBaseUrl}/rest/api/content/${pageId}`);
      expect(updateCall[1].method).toBe('PUT');

      const requestBody = JSON.parse(updateCall[1].body);
      expect(requestBody.type).toBe('page');
      expect(requestBody.title).toBe(title);
      expect(requestBody.space.key).toBe('TEST');
      expect(requestBody.body.storage.value).toBe(content);
      expect(requestBody.version.number).toBe(version + 1);
    });

    // Note: Error handling tests for updatePage are moved to error.test.ts
  });
});
