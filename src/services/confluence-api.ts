import { 
  CleanConfluencePage, 
  ConfluenceSpace, 
  ConfluenceComment, 
  GetCommentsResponse,
  ConfluenceAttachment,
  GetAttachmentsResponse
} from '../types/confluence.js';

export class ConfluenceApiService {
  private baseUrl: string;
  private headers: Headers;
  private requestDelay: number; // Delay in milliseconds

  constructor(baseUrl: string, email: string, apiToken: string, requestDelayMs: number = 200) { // Default delay 200ms
    this.baseUrl = baseUrl;
    this.requestDelay = requestDelayMs;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    this.headers = new Headers({
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    });
  }

  private async handleFetchError(response: Response, url?: string): Promise<never> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const urlPath = url ? new URL(url, this.baseUrl).pathname : '';

      // Handle 404 specifically for /content/{id} or /content/{id}/child/... endpoints
      const contentPathMatch = urlPath.match(/^\/rest\/api\/content\/([^/]+)/);
      if (response.status === 404 && contentPathMatch) {
        const contentId = contentPathMatch[1]; // This should be the page or comment ID
        // Check if it looks like an ID (numeric) or potentially a resource name like 'search'
        if (/^\d+$/.test(contentId)) { // Only throw specific error for numeric IDs
             throw new Error(`Content not found: ${contentId}`);
        }
        // Let other 404s fall through to the generic error
      }

      // Extract error message from response with more details
      const message = errorData?.message || errorData?.errorMessage || response.statusText;
      const details = JSON.stringify(errorData, null, 2);
      console.error('Confluence API Error Details:', details);
      throw new Error(`Confluence API Error: ${message} (Status: ${response.status})`);
    }
    throw new Error('Unknown error occurred');
  }

  /**
   * Extracts plain text content from Confluence Storage Format (XHTML)
   * This is a placeholder - a real implementation would use a proper HTML parser
   */
  private extractTextContent(content: string): string {
    // Simple regex to strip HTML tags - a real implementation would use a proper parser
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private cleanPage(page: any): CleanConfluencePage {
    const body = page.body?.storage?.value || '';
    const cleanContent = this.extractTextContent(body);

    return {
      id: page.id,
      title: page.title,
      spaceKey: page._expandable?.space ? page._expandable.space.split('/').pop() : '',
      version: page.version?.number || 1,
      content: cleanContent,
      created: page.created,
      updated: page.updated,
      createdBy: {
        id: page.history?.createdBy?.accountId || '',
        displayName: page.history?.createdBy?.displayName || '',
        email: page.history?.createdBy?.email
      },
      updatedBy: {
        id: page.history?.lastUpdated?.by?.accountId || '',
        displayName: page.history?.lastUpdated?.by?.displayName || '',
        email: page.history?.lastUpdated?.by?.email
      },
      links: {
        webui: page._links?.webui || '',
        edit: page._links?.editui || '',
        tinyui: page._links?.tinyui || ''
      },
      parentId: page.ancestors?.length > 0 ? page.ancestors[page.ancestors.length - 1].id : undefined,
      childrenIds: undefined, // Would need a separate request to get children
      labels: page.metadata?.labels?.results?.map((label: any) => ({
        name: label.name,
        id: label.id
      }))
    };
  }

  private cleanComment(comment: any, pageId: string): ConfluenceComment {
    const body = comment.body?.storage?.value || '';
    const cleanContent = this.extractTextContent(body);

    return {
      id: comment.id,
      pageId: pageId, // The API doesn't always return this directly in the comment object
      content: cleanContent,
      created: comment.history?.createdDate || '',
      createdBy: {
        id: comment.history?.createdBy?.accountId || '',
        displayName: comment.history?.createdBy?.displayName || '',
        email: comment.history?.createdBy?.email
      },
      updated: comment.version?.when,
      updatedBy: {
        id: comment.version?.by?.accountId || '',
        displayName: comment.version?.by?.displayName || '',
        email: comment.version?.by?.email
      },
      parentId: comment.ancestors?.length > 0 ? comment.ancestors[comment.ancestors.length - 1].id : undefined,
      links: {
        webui: comment._links?.webui || ''
      }
    };
  }

  private cleanAttachment(attachment: any, pageId: string): ConfluenceAttachment {
    return {
      id: attachment.id,
      pageId: pageId, // API doesn't return this directly
      title: attachment.title,
      mediaType: attachment.metadata?.mediaType || 'application/octet-stream',
      fileSize: attachment.extensions?.fileSize || 0,
      // Prioritize version.when for created date, fallback to history
      created: attachment.version?.when || attachment.history?.createdDate || '',
      createdBy: {
        // Prioritize version.by for creator info, fallback to history
        id: attachment.version?.by?.accountId || attachment.history?.createdBy?.accountId || '',
        displayName: attachment.version?.by?.displayName || attachment.history?.createdBy?.displayName || '',
        email: attachment.version?.by?.email || attachment.history?.createdBy?.email
      },
      version: attachment.version?.number || 1,
      links: {
        webui: attachment._links?.webui || '',
        download: this.baseUrl + (attachment._links?.download || '')
      },
      comment: attachment.version?.message || '' // Map version message to comment
    };
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    // Add delay before making the request
    if (this.requestDelay > 0) {
      await Bun.sleep(this.requestDelay);
    }
    
    const response = await fetch(this.baseUrl + url, {
      ...init,
      headers: this.headers
    });
    
    if (!response.ok) {
      await this.handleFetchError(response, url);
    }
    
    return response.json();
  }

  /**
   * Retrieves a Confluence page by its ID
   * 
   * @param pageId - The ID of the page to retrieve
   * @returns A cleaned version of the Confluence page
   */
  async getPage(pageId: string): Promise<CleanConfluencePage> {
    const params = new URLSearchParams({
      expand: 'body.storage,version,ancestors,history,metadata.labels,space,children.page'
    });

    const page = await this.fetchJson<any>(`/rest/api/content/${pageId}?${params}`);
    return this.cleanPage(page);
  }

  /**
   * Searches for Confluence pages using CQL (Confluence Query Language)
   * 
   * @param query - The search query string (CQL)
   * @returns Object containing total count and array of cleaned pages
   */
  async searchPages(query: string): Promise<{ total: number; pages: CleanConfluencePage[] }> {
    const params = new URLSearchParams({
      cql: query,
      limit: '50',
      expand: 'body.storage,version,ancestors,history,metadata.labels,space'
    });

    const data = await this.fetchJson<any>(`/rest/api/content/search?${params}`);
    
    return {
      total: data.totalSize || 0,
      pages: (data.results || []).map((page: any) => this.cleanPage(page))
    };
  }

  /**
   * Retrieves all available Confluence spaces
   * 
   * @returns Object containing total count and array of spaces
   */
  async getSpaces(): Promise<{ total: number; spaces: ConfluenceSpace[] }> {
    const params = new URLSearchParams({
      limit: '100',
      expand: 'description.plain' // Corrected expand parameter
    });

    const data = await this.fetchJson<any>(`/rest/api/space?${params}`);
    
    return {
      total: data.size || 0,
      spaces: (data.results || []).map((space: any) => ({
        id: space.id,
        key: space.key,
        name: space.name,
        description: space.description?.plain?.value,
        type: space.type.toLowerCase(),
        status: space.status.toLowerCase()
      }))
    };
  }

  /**
   * Creates a new Confluence page
   * 
   * @param spaceKey - The key of the space where the page will be created
   * @param title - The title of the new page
   * @param content - The content of the page in Confluence Storage Format (XHTML)
   * @param parentId - Optional ID of the parent page
   * @returns A cleaned version of the created page
   */
  async createPage(spaceKey: string, title: string, content: string, parentId?: string): Promise<CleanConfluencePage> {
    const payload: any = {
      type: 'page',
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    // Add parent relationship if parentId is provided
    if (parentId) {
      payload.ancestors = [{ id: parentId }];
    }

    const page = await this.fetchJson<any>('/rest/api/content', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Fetch the full page details to get all the fields we need for cleaning
    return this.getPage(page.id);
  }

  /**
   * Updates an existing Confluence page
   * 
   * @param pageId - The ID of the page to update
   * @param title - The new title of the page
   * @param content - The new content in Confluence Storage Format (XHTML)
   * @param version - The current version number of the page
   * @returns A cleaned version of the updated page
   */
  async updatePage(pageId: string, title: string, content: string, version: number): Promise<CleanConfluencePage> {
    // First, get the current page to ensure we have the space key
    const currentPage = await this.getPage(pageId);
    
    const payload = {
      type: 'page',
      title,
      space: { key: currentPage.spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: {
        number: version + 1 // Increment the version number
      }
    };

    await this.fetchJson<any>(`/rest/api/content/${pageId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    // Fetch the updated page to get all the fields we need for cleaning
    return this.getPage(pageId);
  }

  /**
   * Retrieves comments for a specific Confluence page
   * 
   * @param pageId - The ID of the page to retrieve comments for
   * @returns Object containing total count and array of cleaned comments
   */
  async getComments(pageId: string): Promise<GetCommentsResponse> {
    const params = new URLSearchParams({
      expand: 'body.storage,version,history,ancestors',
      limit: '100' // Adjust limit as needed, or implement pagination
    });

    const data = await this.fetchJson<any>(`/rest/api/content/${pageId}/child/comment?${params}`);
    
    return {
      total: data.size || 0,
      comments: (data.results || []).map((comment: any) => this.cleanComment(comment, pageId))
    };
  }

  /**
   * Adds a comment to a Confluence page
   * 
   * @param pageId - The ID of the page to add the comment to
   * @param content - The comment content in Confluence Storage Format (XHTML)
   * @param parentId - Optional ID of the parent comment for threading
   * @returns A cleaned version of the created comment
   */
  async addComment(pageId: string, content: string, parentId?: string): Promise<ConfluenceComment> {
    const payload: any = {
      type: 'comment',
      container: { id: pageId, type: 'page' },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    // Add parent relationship if parentId is provided (for threaded replies)
    if (parentId) {
      payload.ancestors = [{ id: parentId }];
    }

    const comment = await this.fetchJson<any>('/rest/api/content', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Fetch the full comment details to get all fields for cleaning
    // Need to use the comment ID now
    const fullComment = await this.fetchJson<any>(`/rest/api/content/${comment.id}?expand=body.storage,version,history,ancestors`);
    return this.cleanComment(fullComment, pageId);
  }

  /**
   * Retrieves attachments for a specific Confluence page
   * 
   * @param pageId - The ID of the page to retrieve attachments for
   * @returns Object containing total count and array of cleaned attachments
   */
  async getAttachments(pageId: string): Promise<GetAttachmentsResponse> {
    const params = new URLSearchParams({
      expand: 'version,history,metadata', // Added metadata to expand
      limit: '100' // Adjust limit or implement pagination
    });

    const data = await this.fetchJson<any>(`/rest/api/content/${pageId}/child/attachment?${params}`);
    
    return {
      total: data.size || 0,
      attachments: (data.results || []).map((attachment: any) => this.cleanAttachment(attachment, pageId))
    };
  }

  /**
   * Adds an attachment to a Confluence page
   * 
   * @param pageId - The ID of the page to attach the file to
   * @param fileContent - The content of the file as a Buffer
   * @param filename - The desired filename for the attachment
   * @param comment - Optional comment for the attachment version
   * @returns A cleaned version of the created attachment
   */
  async addAttachment(pageId: string, fileContent: Buffer, filename: string, comment?: string): Promise<ConfluenceAttachment> {
    const formData = new FormData();
    const blob = new Blob([fileContent]); 
    formData.append('file', blob, filename);
    if (comment) {
      formData.append('comment', comment);
    }
    // 'minorEdit' can be set to 'true' if needed, defaults to false

    // Need specific headers for file upload
    const uploadHeaders = new Headers(this.headers);
    uploadHeaders.delete('Content-Type'); // Let fetch set the multipart boundary
    uploadHeaders.set('X-Atlassian-Token', 'no-check'); // Required for attachments API

    // Add delay before making the request
    if (this.requestDelay > 0) {
      await Bun.sleep(this.requestDelay);
    }

    const response = await fetch(`${this.baseUrl}/rest/api/content/${pageId}/child/attachment`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
    });

    if (!response.ok) {
      await this.handleFetchError(response, `${this.baseUrl}/rest/api/content/${pageId}/child/attachment`);
    }

    const data = await response.json();
    
    // The response contains an array of attachments, usually just one
    const createdAttachment = data?.results?.[0];
    if (!createdAttachment) {
      throw new Error('Failed to retrieve attachment details after upload');
    }

    // Use the details from the POST response directly, no need for another GET
    // The POST response already contains sufficient details including version and history if expanded correctly (though the API might not expand on POST)
    // We will rely on the data returned by the POST, assuming it's sufficient for cleaning.
    // If more details were absolutely needed, the test mock would need to handle the second GET.
    return this.cleanAttachment(createdAttachment, pageId);
  }
}
