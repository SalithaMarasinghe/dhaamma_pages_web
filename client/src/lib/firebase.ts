import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Page, CreatePageData, UpdatePageData } from "@shared/types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAS3DIqmf_cnh_h_cm6aw_SQVEYavDEVms",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "dhamma-pages-web"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dhamma-pages-web",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "dhamma-pages-web"}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "316460245846",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:316460245846:web:10897241276d0a289c2cf7",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-45R8Q17VJM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  return signInWithPopup(auth, provider);
};

export const signOutUser = () => {
  return signOut(auth);
};

// Firestore functions for pages
export const createPage = async (userId: string, pageData: CreatePageData): Promise<string> => {
  const pagesRef = collection(db, 'users', userId, 'pages');
  const docRef = await addDoc(pagesRef, {
    ...pageData,
    content: pageData.content || { type: 'doc', content: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
    userId
  });
  return docRef.id;
};

export const updatePage = async (userId: string, pageId: string, updates: UpdatePageData): Promise<void> => {
  try {
    console.log('[DEBUG] Updating page:', {
      userId,
      pageId,
      updates: {
        ...updates,
        content: updates.content ? 'content exists' : 'no content'
      }
    });
    
    const pageRef = doc(db, 'users', userId, 'pages', pageId);
    
    // Create update data with timestamp
    const updateData: any = {
      ...updates,
      updatedAt: new Date()
    };
    
    // Stringify content if it's an object
    if (updateData.content && typeof updateData.content === 'object') {
      updateData.content = JSON.stringify(updateData.content);
      console.log('[DEBUG] Stringified content for Firestore');
    }
    
    console.log('[DEBUG] Update data being sent to Firestore:', {
      ...updateData,
      content: typeof updateData.content === 'string' ? 'string content' : 'no content'
    });
    
    await updateDoc(pageRef, updateData);
    console.log(`[DEBUG] Page ${pageId} updated successfully`);
    
    // Verify the update
    const updatedDoc = await getDoc(pageRef);
    console.log('[DEBUG] Updated document from Firestore:', {
      exists: updatedDoc.exists(),
      data: updatedDoc.exists() ? updatedDoc.data() : null
    });
    
  } catch (error) {
    console.error('[DEBUG] Error in updatePage:', error);
    throw error;
  }
};

export const deletePage = async (userId: string, pageId: string): Promise<void> => {
  const pageRef = doc(db, 'users', userId, 'pages', pageId);
  await deleteDoc(pageRef);
};

export const getPage = async (userId: string, pageId: string): Promise<Page | null> => {
  try {
    console.log(`[DEBUG] Fetching page ${pageId} for user ${userId}`);
    const pageRef = doc(db, 'users', userId, 'pages', pageId);
    const pageSnap = await getDoc(pageRef);
    
    if (pageSnap.exists()) {
      const data = pageSnap.data();
      console.log('[DEBUG] Page data from Firestore:', {
        id: pageSnap.id,
        ...data,
        content: typeof data.content === 'string' ? 'string content' : 'object content'
      });
      
      // Ensure content is properly formatted
      let content = data.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
          console.log('[DEBUG] Successfully parsed content from string');
        } catch (e) {
          console.warn('[DEBUG] Content is not valid JSON, using as plain text');
        }
      } else if (content && typeof content === 'object') {
        console.log('[DEBUG] Content is already an object');
      }
      
      const pageData = {
        id: pageSnap.id,
        title: data.title || '',
        content: content || { type: 'doc', content: [] },
        userId: data.userId || userId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
      
      console.log('[DEBUG] Returning page data:', {
        ...pageData,
        content: typeof pageData.content === 'string' ? 'string content' : 'object content'
      });
      
      return pageData as Page;
    } else {
      console.warn(`[DEBUG] Page ${pageId} not found for user ${userId}`);
      return null;
    }
  } catch (error) {
    console.error('[DEBUG] Error in getPage:', error);
    throw error;
  }
};

export const getUserPages = async (userId: string): Promise<Page[]> => {
  const pagesRef = collection(db, 'users', userId, 'pages');
  const q = query(pagesRef, orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
  })) as Page[];
};

export const searchPages = async (userId: string, searchTerm: string): Promise<Page[]> => {
  const pagesRef = collection(db, 'users', userId, 'pages');
  const q = query(pagesRef, orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  const pages = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
  })) as Page[];
  
  return pages.filter(page => 
    page.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
};

export const subscribeToPages = (userId: string, callback: (pages: Page[]) => void) => {
  const pagesRef = collection(db, 'users', userId, 'pages');
  const q = query(pagesRef, orderBy('updatedAt', 'desc'));
  
  return onSnapshot(q, (querySnapshot) => {
    const pages = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as Page[];
    
    callback(pages);
  });
};

// Image upload functions
export const uploadImage = async (userId: string, file: File): Promise<{url: string, path: string}> => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const imagePath = `users/${userId}/images/${filename}`;
    
    // Create storage reference
    const imageRef = ref(storage, imagePath);
    
    // Upload file
    const snapshot = await uploadBytes(imageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return { url: downloadURL, path: imagePath };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
};

export const deleteImage = async (imagePath: string): Promise<void> => {
  try {
    if (!imagePath) return;
    
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw error for failed deletions to avoid breaking the main flow
  }
};

// Helper function to extract image paths from content
export const extractImagePaths = (content: any): string[] => {
  if (!content || !content.content) return [];
  
  const paths: string[] = [];
  
  const traverse = (node: any) => {
    const src = node.attrs?.src;
    if (node.type === 'image' && typeof src === 'string') {
      // If it's a Firebase Storage URL
      if (src.includes('firebasestorage.googleapis.com')) {
        try {
          const url = new URL(src);
          // The path starts after '/v0/b/{bucket}/o/' and before '?alt=media&...'
          const pathMatch = url.pathname.match(/\/v0\/b\/[^/]+\/o\/([^?]+)/);
          if (pathMatch && pathMatch[1]) {
            const path = decodeURIComponent(pathMatch[1]);
            paths.push(path);
          }
        } catch (e) {
          console.warn('Invalid image URL:', src);
        }
      } 
      // If it's a path that starts with users/{userId}/images/
      else if (src.startsWith('users/') && src.includes('/images/')) {
        paths.push(src);
      }
      // If it's a full URL that we've stored (from previous uploads)
      else if (src.startsWith('http')) {
        // Just store the full URL for now
        paths.push(src);
      }
    }
    
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };
  
  if (Array.isArray(content.content)) {
    content.content.forEach(traverse);
  } else if (typeof content.content === 'object' && content.content !== null) {
    traverse(content.content);
  }
  
  // Remove duplicates using Array.from
  return Array.from(new Set(paths));
};
