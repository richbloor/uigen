# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
npm run setup          # install deps + prisma generate + migrate

# Development
npm run dev            # Next.js dev server with Turbopack at localhost:3000
npm run dev:daemon     # Same, but runs in background, logs to logs.txt

# Testing
npm test               # Run all tests (vitest)
npm test -- src/lib/__tests__/file-system.test.ts   # Run a single test file

# Database
npx prisma migrate dev          # Apply new migrations
npx prisma studio               # Browse database
npm run db:reset                # Reset and re-migrate (destructive)
```

Set `ANTHROPIC_API_KEY` in `.env` to enable real AI generation. Without it, the app runs with a static mock provider.

## Architecture

### Request flow

1. User types a prompt → `ChatProvider` (`src/lib/contexts/chat-context.tsx`) calls `POST /api/chat`
2. Chat API (`src/app/api/chat/route.ts`) reconstructs `VirtualFileSystem` from serialized state, calls `streamText()` with two tools
3. Claude calls tools to create/edit files; tool results mutate the in-memory `VirtualFileSystem`
4. On stream finish, the updated VFS and full message history are serialized back to Prisma (`Project.data` and `Project.messages`)
5. Tool calls are forwarded to the client via Vercel AI SDK's data stream; `FileSystemContext` applies them to the client-side VFS
6. `PreviewFrame` detects VFS changes, runs `createImportMap()` + `createPreviewHTML()` and reloads the iframe

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is a pure in-memory tree. It's instantiated fresh on every API request from the serialized `Record<string, FileNode>` payload and is the only mutable state during AI generation. There are two tool adapters that wrap it:

- `str_replace_editor` — `view`, `create`, `str_replace`, `insert` (maps to `viewFile`, `createFileWithParents`, `replaceInFile`, `insertInFile`)
- `file_manager` — higher-level file management operations

### Preview pipeline

`src/lib/transform/jsx-transformer.ts` runs entirely in the browser:
1. Babel transforms each `.jsx/.tsx/.ts/.js` file and creates a blob URL
2. `createImportMap()` builds a browser import map: React/ReactDOM → `esm.sh`, local files → blob URLs, `@/` alias → root, third-party packages → `esm.sh`
3. Missing imports get placeholder stub modules so the preview doesn't crash
4. `createPreviewHTML()` injects Tailwind CSS CDN, the import map, and a `<script type="module">` that mounts `App.jsx` inside a React `ErrorBoundary`

### AI generation conventions

The system prompt (`src/lib/prompts/generation.tsx`) instructs Claude to:
- Always create `/App.jsx` as the entry point (default export required)
- Use `@/` import alias for all local files (e.g. `import Foo from '@/components/Foo'`)
- Style with Tailwind only — no hardcoded styles, no HTML files

### Authentication

JWT sessions via `jose` stored in httpOnly cookies (`src/lib/auth.ts`). Server actions in `src/actions/` handle sign-up, sign-in, and project CRUD. Anonymous users have no session; their work is tracked to `localStorage` via `src/lib/anon-work-tracker.ts`.

### State management

Two React contexts, both required to wrap the UI:
- `FileSystemProvider` — owns the client-side `VirtualFileSystem` instance and the currently selected file; exposes `handleToolCall` which the chat context calls for each AI tool invocation
- `ChatProvider` — wraps Vercel AI SDK's `useChat`, serializes VFS state into every request body, forwards tool calls to `FileSystemProvider`

### Mock provider

`MockLanguageModel` (`src/lib/provider.ts`) implements `LanguageModelV1` and returns a hard-coded 4-step workflow generating a Counter/Form/Card component. It's activated automatically when `ANTHROPIC_API_KEY` is absent. The real provider uses `claude-haiku-4-5`.

### Database

Prisma + SQLite (`prisma/dev.db`). The generated client is output to `src/generated/prisma`. `Project.messages` and `Project.data` are JSON strings; the app always parses/stringifies them explicitly. `userId` is nullable to support anonymous projects. Reference `prisma/schema.prisma` to understand the structure of data stored in the database.

## Coding conventions

- Use comments sparingly — only comment complex code where the logic isn't self-evident
