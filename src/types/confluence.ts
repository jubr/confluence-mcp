export interface CleanConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  version: number;
  content: string;
  created: string;
  updated: string;
  createdBy: {
    id: string;
    displayName: string;
    email?: string;
  };
  updatedBy: {
    id: string;
    displayName: string;
    email?: string;
  };
  links: {
    webui: string;
    edit?: string;
    tinyui?: string;
  };
  parentId?: string;
  childrenIds?: string[];
  labels?: {
    name: string;
    id: string;
  }[];
}

export interface SearchPagesResponse {
  total: number;
  pages: CleanConfluencePage[];
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: 'global' | 'personal' | 'team';
  status: 'current' | 'archived';
}

export interface SearchSpacesResponse {
  total: number;
  spaces: ConfluenceSpace[];
}

export interface ConfluenceComment {
  id: string;
  pageId: string;
  content: string; // Assuming Storage Format or similar
  created: string;
  createdBy: {
    id: string;
    displayName: string;
    email?: string;
  };
  updated?: string;
  updatedBy?: {
    id: string;
    displayName: string;
    email?: string;
  };
  parentId?: string; // For replies
  links: {
    webui?: string;
  };
}

export interface GetCommentsResponse {
  total: number;
  comments: ConfluenceComment[];
}

export interface ConfluenceAttachment {
  id: string;
  pageId: string;
  title: string;
  mediaType: string;
  fileSize: number;
  created: string;
  createdBy: {
    id: string;
    displayName: string;
    email?: string;
  };
  version: number;
  links: {
    webui?: string;
    download?: string;
  };
  comment?: string; // Optional comment associated with the attachment version
}

export interface GetAttachmentsResponse {
  total: number;
  attachments: ConfluenceAttachment[];
}
