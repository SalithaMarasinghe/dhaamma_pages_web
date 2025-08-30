export interface Page {
  id: string;
  title: string;
  content: any; // Tiptap JSON content
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  preview?: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export interface CreatePageData {
  title: string;
  content?: any;
}

export interface UpdatePageData {
  title?: string;
  content?: any;
}
