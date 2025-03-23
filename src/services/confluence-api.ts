import { CleanConfluencePage, ConfluenceSpace } from '../types/confluence.js';

export class ConfluenceApiService {
  private baseUrl: string;
  private headers: Headers;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl;
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

      // Handle 404 for content endpoints
      if (response.status === 404 && url?.includes('/content/')) {
        const match = url.match(/\/content\/([^/]+)/);
        if (match) {
          throw new Error(`Content not found: ${match[1]}`);
        }
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

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
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
      expand: 'description'
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
}
