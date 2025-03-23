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
