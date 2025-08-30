# Overview

Dhamma Page is a Notion-like notes application built with React on the frontend and Express.js on the backend. The application allows users to create and manage personal pages with rich text editing capabilities using Tiptap editor. Users can authenticate via Google Firebase Auth, create pages with structured content, and organize their notes in a clean, modern interface.

The application provides a dashboard view for managing multiple pages, a rich text editor for content creation, and real-time synchronization with Firebase Firestore for data persistence. The design emphasizes mindful note-taking with a clean, minimalist aesthetic.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React with Vite as the build tool and development server. The application uses TypeScript for type safety and follows a component-based architecture.

**Routing**: Wouter is used for client-side routing, providing a lightweight alternative to React Router.

**State Management**: React Query (@tanstack/react-query) handles server state management and caching, while React's built-in hooks manage local component state.

**UI Components**: The application uses shadcn/ui components built on top of Radix UI primitives, providing accessible and customizable components with Tailwind CSS for styling.

**Text Editor**: Tiptap is integrated as the rich text editor, supporting various content blocks including headings, paragraphs, and lists.

## Backend Architecture

**Framework**: Express.js server with TypeScript, providing RESTful API endpoints.

**Development Setup**: The backend uses tsx for development with hot reloading and esbuild for production builds.

**Storage Interface**: A modular storage system with an interface-based approach allowing for different storage implementations (currently using in-memory storage with plans for database integration).

**Session Management**: Express sessions with connect-pg-simple for PostgreSQL session storage.

## Data Storage Solutions

**Primary Database**: Firebase Firestore serves as the main database for storing user pages and content. The schema follows a user-centric structure: `users/{userId}/pages/{pageId}`.

**Database Schema Planning**: Drizzle ORM is configured for PostgreSQL with schema definitions in the shared directory, indicating plans for additional database functionality.

**Session Storage**: PostgreSQL is configured for session management through connect-pg-simple.

## Authentication and Authorization

**Authentication Provider**: Firebase Authentication with Google OAuth integration.

**Security Model**: User-based data isolation where each user can only access their own pages and content.

**Frontend Protection**: Route-level protection ensures unauthenticated users are redirected to the login screen.

## External Dependencies

**Firebase Services**: 
- Firebase Authentication for user management
- Firestore for real-time data storage and synchronization

**UI Framework**: 
- Radix UI primitives for accessible component foundations
- Tailwind CSS for utility-first styling
- Font Awesome for iconography

**Text Editing**: 
- Tiptap for rich text editing capabilities
- Tiptap Starter Kit for basic editing functionality

**Development Tools**: 
- Vite for fast development and building
- Replit-specific plugins for development environment integration
- TypeScript for type safety across the application

**Utility Libraries**: 
- date-fns for date formatting and manipulation
- clsx and tailwind-merge for conditional CSS class handling
- Wouter for lightweight routing

The architecture emphasizes modularity, type safety, and real-time capabilities while maintaining a clean separation between frontend presentation logic and backend data management.