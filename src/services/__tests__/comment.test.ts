import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ConfluenceApiService } from '../confluence-api.js';
import { ConfluenceComment } from '../../types/confluence.js'; // Assuming this type is needed

// Mock global fetch
const originalFetch = global.fetch;

// --- Mock Data ---
const mockCommentResponse = {
  id: 'comment-456',
  status: 'current',
  title: 'Re: Test Page',
  // pageId is not directly in the raw comment response, it's passed to cleanComment
  history: { // Changed from version to history to match cleanComment
    createdDate: '2023-01-03T10:00:00.000Z',
    createdBy: {
      accountId: 'user-789',
      displayName: 'Commenter User',
      email: 'commenter@example.com'
    }
  },
  version: { // Keep version for updatedBy if needed, though not in this mock
     number: 1
  },
  body: {
    storage: {
        value: '<p>This is a test comment</p>'
      }
    },
    _links: {
      webui: '/comment/456'
    }
};

const mockGetCommentsResponse = {
  results: [mockCommentResponse],
  size: 1
};

// --- Test Suite ---

describe('ConfluenceApiService - Comments', () => {
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
    });

    apiService = new ConfluenceApiService(mockBaseUrl, mockEmail, mockApiToken);
  });

  afterEach(() => {
    // Restore the original fetch after each test
    global.fetch = originalFetch;
  });

  describe('getComments', () => {
    test('should fetch and clean comments for a page', async () => {
      global.fetch = mock(() => {
        return Promise.resolve(new Response(JSON.stringify(mockGetCommentsResponse), {
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' })
        }));
      });

      const pageId = 'page-123';
      const result = await apiService.getComments(pageId);

      expect(result).toBeObject();
      expect(result.total).toBe(1);
      expect(result.comments).toHaveLength(1);

      const comment = result.comments[0];
      expect(comment.id).toBe(mockCommentResponse.id);
      expect(comment.content).toBe('This is a test comment');
      expect(comment.createdBy.id).toBe(mockCommentResponse.history.createdBy.accountId); // Aligned with mock and cleanComment
      expect(comment.created).toBe(mockCommentResponse.history.createdDate); // Aligned with mock and cleanComment
      expect(comment.pageId).toBe(pageId); // Check against the passed pageId

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      // Correct the expected expand parameters to match the implementation
      expect(fetchCall[0]).toBe(`${mockBaseUrl}/rest/api/content/${pageId}/child/comment?expand=body.storage%2Cversion%2Chistory%2Cancestors&limit=100`);
    });

    test('should handle pages with no comments', async () => {
      global.fetch = mock(() => {
        return Promise.resolve(new Response(JSON.stringify({ results: [], size: 0 }), {
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' })
        }));
      });

      const pageId = 'page-no-comments';
      const result = await apiService.getComments(pageId);

      expect(result.total).toBe(0);
      expect(result.comments).toHaveLength(0);
    });

    // Note: Error handling tests for getComments are moved to error.test.ts
  });

  describe('addComment', () => {
    test('should add a top-level comment and return the cleaned result', async () => {
      // Define the expected structure after creation and fetching
      const mockCreatedComment = {
       ...mockCommentResponse, // Spread base structure
       id: 'new-comment-789', // Override ID
       body: { storage: { value: '<p>New comment content</p>' } }, // Override body
       // Ensure history/version are consistent if needed, mockCommentResponse already has them
     };
     // Mock for POST request
     const postMock = mock(() => {
       // Return only the ID, as the actual API might do
       return Promise.resolve(new Response(JSON.stringify({ id: 'new-comment-789' }), {
         status: 200,
         headers: new Headers({ 'Content-Type': 'application/json' })
       }));
     });
     // Mock for subsequent GET request
     const getMock = mock(() => {
       return Promise.resolve(new Response(JSON.stringify(mockCreatedComment), {
         status: 200,
         headers: new Headers({ 'Content-Type': 'application/json' })
        }));
     });

     // Setup fetch mock to handle POST then GET
     global.fetch = mock((url, options) => {
       if (options?.method === 'POST') {
         return postMock();
       } else if (url.includes('/rest/api/content/new-comment-789')) {
         return getMock();
       }
       // Fallback for unexpected calls
       return Promise.resolve(new Response(JSON.stringify({ message: 'Unexpected fetch call' }), { status: 500 }));
     });


     const pageId = 'page-123';
      const content = '<p>New comment content</p>';

      const comment = await apiService.addComment(pageId, content);

      expect(comment).toBeObject();
      expect(comment.id).toBe('new-comment-789');
     expect(comment.content).toBe('New comment content');
     expect(comment.pageId).toBe(pageId); // cleanComment adds this

     expect(global.fetch).toHaveBeenCalledTimes(2); // POST then GET
     const postCall = (global.fetch as any).mock.calls[0];
     expect(postCall[0]).toBe(`${mockBaseUrl}/rest/api/content`);
     expect(postCall[1].method).toBe('POST');

      const requestBody = JSON.parse(postCall[1].body); // Use postCall here
      expect(requestBody.type).toBe('comment');
      expect(requestBody.container.id).toBe(pageId);
      expect(requestBody.body.storage.value).toBe(content);
     expect(requestBody.ancestors).toBeUndefined(); // No parentId provided

     const getCall = (global.fetch as any).mock.calls[1];
     expect(getCall[0]).toContain('/rest/api/content/new-comment-789');
  });

  test('should add a threaded comment (reply) and return the cleaned result', async () => {
     // Define the expected structure after creation and fetching
     const mockCreatedReply = {
       ...mockCommentResponse, // Spread base structure
       id: 'reply-101', // Override ID
       body: { storage: { value: '<p>This is a reply</p>' } }, // Override body
       // Ensure history/version are consistent
     };
      // Mock for POST request
     const postMock = mock(() => {
       return Promise.resolve(new Response(JSON.stringify({ id: 'reply-101' }), { // Return only ID
         status: 200,
         headers: new Headers({ 'Content-Type': 'application/json' })
       }));
     });
     // Mock for subsequent GET request
     const getMock = mock(() => {
       return Promise.resolve(new Response(JSON.stringify(mockCreatedReply), {
         status: 200,
         headers: new Headers({ 'Content-Type': 'application/json' })
        }));
     });

      // Setup fetch mock to handle POST then GET
     global.fetch = mock((url, options) => {
       if (options?.method === 'POST') {
         return postMock();
       } else if (url.includes('/rest/api/content/reply-101')) {
         return getMock();
       }
       // Fallback for unexpected calls
       return Promise.resolve(new Response(JSON.stringify({ message: 'Unexpected fetch call' }), { status: 500 }));
     });

     const pageId = 'page-123';
      const content = '<p>This is a reply</p>';
      const parentId = 'comment-456'; // Replying to the mock comment

      const comment = await apiService.addComment(pageId, content, parentId);

      expect(comment).toBeObject();
      expect(comment.id).toBe('reply-101');
     expect(comment.content).toBe('This is a reply');
     expect(comment.pageId).toBe(pageId); // cleanComment adds this
     // Note: The API response doesn't directly include parentId, so we verify the request body

     expect(global.fetch).toHaveBeenCalledTimes(2); // POST then GET
     const postCall = (global.fetch as any).mock.calls[0];
     expect(postCall[0]).toBe(`${mockBaseUrl}/rest/api/content`);
     expect(postCall[1].method).toBe('POST');

      const requestBody = JSON.parse(postCall[1].body); // Use postCall here
      expect(requestBody.type).toBe('comment');
      expect(requestBody.container.id).toBe(pageId);
      expect(requestBody.body.storage.value).toBe(content);
      expect(requestBody.ancestors).toBeArray();
     expect(requestBody.ancestors[0].id).toBe(parentId); // Verify parentId is sent

     const getCall = (global.fetch as any).mock.calls[1];
     expect(getCall[0]).toContain('/rest/api/content/reply-101');
  });

  // Note: Error handling tests for addComment are moved to error.test.ts
  });
});
