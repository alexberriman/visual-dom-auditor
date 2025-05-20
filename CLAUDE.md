@CLAUDE-CUSTOM.md
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React frontend project with automated testing and quality checks.

## Code Style Conventions

- **Case Style**: kebab-case
- **Indentation**: spaces (2 spaces)
- **Quotes**: double quotes
- **Line Length**: Maximum 100 characters
- **Trailing Commas**: Use trailing commas
- **Semicolons**: Use semicolons

### Component Structure

Components should be organized in directories with an index.ts file.
Example:
```
components/
  button/
    index.ts       # Exports the component
    button.tsx     # Component implementation
    button.test.tsx    # Tests (adjacent to implementation)
```

### Test Files

Test files should follow the pattern: `{name}.test.ts`

## Preferred Technologies

Use the following technologies in this project:

### Frontend

- **Framework**: React v19
- **Styling**: Tailwind v4
- **Data Fetching**: React-query
- **Documentation**: Storybook

### Code Organization & Architecture

- **Component Design**: Maximize reusability
  - Create small, composable, reusable components
  - Extract common patterns into shared components
  - Build a component hierarchy that promotes reuse
- **Component Documentation**: Every presentational component must have a Storybook story
  - Stories should cover all component states and variants
  - Include proper documentation of props and usage
- **Hooks Organization**: One hook per file
  - Each custom hook should have its own dedicated file
  - Organize hooks by feature/entity
  - Create separate hooks for each API operation (e.g., useCreateUser, useDeleteUser)
- **Data Fetching Pattern**: 
  - Create custom React Query hooks for each API endpoint
  - Organize queries by entity/resource
  - Leverage QueryClient for caching and background updates

### UI Design Philosophy (2025)

All UI components and interfaces should be CUTTING-EDGE, MODERN, and SEXY:

- **Visual Design**: Create interfaces that look like they're from 2025
  - Ultra-clean layouts with purposeful whitespace
  - Neumorphic or glassmorphic elements that add depth and dimension
  - Subtle shadows, gradients, and light effects
  - Floating elements and layered UI components

- **Interactions**: Design intuitive, fluid experiences
  - Micro-animations for state changes and transitions
  - Minimal friction in user workflows
  - Context-aware interfaces that anticipate user needs

- **Styling Approach**: Use Tailwind to create UNIQUE designs
  - Push creative boundaries with modern aesthetics
  - Utilize advanced color theory and typography
  - Aim for visually IMPRESSIVE and DISTINCTIVE interfaces


### Backend

- **Framework**: Express v5

### Utilities

- **Logging**: Pino
  - Configuration:
    - Log level: info
    - Pretty print: Enabled
    - Transport: pino-pretty
  - Do not use console.log - use appropriate log levels

### Testing

- **Unit Testing**: Vitest
  - Leveraging Vite for fast test execution
  - Do NOT use Jest configuration or dependencies
- **Component Testing**: Storybook
- **Test Location**: Tests should be placed adjacent to implementation files
  - Do NOT use __tests__ directories

### Build Tools

- **Bundler**: Vite
- **CI/CD**: github-actions

**All presentational ("dumb") components should have a corresponding Storybook story file.**



## Project Architecture

Follow a clear separation of concerns with component-based architecture. Separate UI components from business logic and data fetching.


## Frontend-Only Architecture

This todo app runs entirely in the browser with these key principles:

- **localStorage**: All data persistence using browser's localStorage
- **No Backend**: Zero server dependencies, runs completely offline
- **Instant Performance**: No API calls, everything happens locally
- **Privacy-First**: User data never leaves their device
- **State Management**: Zustand for global state, synced with localStorage
- **Offline-Ready**: Full functionality without internet connection
- **PWA Support**: Installable as a progressive web app


## Visual Design Principles

This app prioritizes stunning visual design:

- **Glassmorphism**: Frosted glass effects throughout the UI
- **Smooth Animations**: Framer Motion for fluid interactions
- **Micro-interactions**: Delightful feedback for every action
- **Dynamic Backgrounds**: Animated gradients and particle effects
- **Dark/Light Modes**: Beautiful themes with smooth transitions
- **3D Effects**: Subtle depth with shadows and transforms
- **Custom Cursors**: Unique cursor styles for different states


## Component Structure

Each component should be in its own directory with the following files:

- `index.ts`: Barrel file exporting the component
- `component-name.tsx`: The actual component implementation
- `component-name.stories.tsx`: Storybook stories for the component

Example component structure:
```
src/
  components/           # All UI components
    ui/                 # @shadcn/ui components
      button/
      card/
      input/
    tasks/             # Task-related components
      task-card/
        index.ts
        task-card.tsx
        task-card.stories.tsx
  hooks/               # Custom React hooks
  stores/              # Zustand stores
  utils/               # Shared utilities
  types/               # TypeScript type definitions
```


## UI Design Guidelines

When designing and building UI components:

- Make it 🔥, sexy as fuck and beautiful for 2025
- Implement glassmorphic effects with blur and transparency
- Use vibrant gradients and bold color schemes
- Add smooth spring animations to all interactions
- Create satisfying hover and click states
- Design with dark mode as the primary theme
- Use generous spacing and modern typography
- Ensure every pixel is polished to perfection
- Add particle effects and celebrations for task completion


