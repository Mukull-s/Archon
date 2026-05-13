# Archon Client - AI Codebase Intelligence

A modern, AI-powered codebase intelligence tool that helps developers understand, analyze, and navigate complex codebases effortlessly.

## Features

- **AI Codebase Analysis**: Leverage advanced AI to understand codebase structure and functionality.
- **Interactive UI**: A beautiful and intuitive interface for exploring codebases.
- **Modern Stack**: Built with React 18 and Vite for a fast and responsive experience.

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS, Lucide Icons
- **Architecture**: Component-based design with clean separation of concerns

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## Development

### Project Structure

```
client/
├── src/
│   ├── components/    # Reusable UI components
│   ├── pages/         # Main application pages
│   ├── utils/         # Utility functions
│   ├── App.tsx        # Root component
│   ├── main.tsx       # Entry point
│   └── index.css      # Global styles
└── vite.config.ts     # Vite configuration
```

### Available Scripts

- **`npm run dev`**: Starts the development server with hot module replacement.
- **`npm run build`**: Builds the application for production.
- **`npm run lint`**: Runs ESLint to check for code quality issues.
- **`npm run preview`**: Locally previews the production build.

### Adding New Components

To add a new component, create a new folder in `src/components/` with the following structure:

```
src/components/MyComponent/
├── MyComponent.tsx
├── MyComponent.css
└── index.ts
```

Then, export it from `index.ts` and import it in your pages:

```typescript
// src/components/MyComponent/index.ts
export { default } from './MyComponent';

// src/pages/HomePage.tsx
import MyComponent from '../components/MyComponent';
```

### Environment Variables

Create a `.env` file in the root directory for environment variables:

```env
VITE_API_URL=http://localhost:3000/api
```

## Running the Application

After installation, run:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.

---

## Tech Stack Deep Dive

### React 18

We use the latest version of React with Hooks for state management and component composition. Key features:

- **Functional Components**: All components are written as functional components.
- **Hooks**: `useState`, `useEffect`, and custom hooks for logic reuse.
- **Concurrent Features**: Ready for future concurrent features in React.

### Vite

Vite provides a fast development experience with:

- **Native ES Modules**: Instant server start without bundling.
- **Hot Module Replacement**: See changes in milliseconds.
- **Optimized Builds**: Rollup under the hood for production.

### TypeScript

We use TypeScript for type safety and better developer experience:

- **Type Annotations**: All components and utilities are strongly typed.
- **Type Inference**: TypeScript infers types where possible to reduce boilerplate.
- **Interfaces**: Well-defined interfaces for API responses and component props.

### Tailwind CSS

A utility-first CSS framework for rapid UI development:

- **Custom Configuration**: Pre-configured with Archon's design system.
- **Dark Mode**: Built-in dark mode support.
- **Responsive Design**: Mobile-first approach with responsive utilities.

### Lucide Icons

A modern icon set with 1000+ open-source icons:

- **Scalable Vector Icons**: Crisp and clear at any size.
- **Tree-Shakable**: Only the icons you use are included in the bundle.
- **Customizable**: Easily adjust size, color, and stroke width.

### Project Structure Explained

```
src/
├── components/
│   ├── ui/              # Atomic UI primitives (Button, Input, Card, etc.)
│   ├── layout/          # Layout components (Navbar, Sidebar, Footer, etc.)
│   └── features/        # Feature-specific components (CodebaseViewer, ChatPanel, etc.)
├── pages/
│   ├── DashboardPage.tsx  # Main dashboard with codebase overview
│   ├── ChatPage.tsx       # AI chat interface
│   ├── ProjectPage.tsx    # Project-specific details
│   └── SettingsPage.tsx   # User settings and preferences
├── hooks/
│   ├── useCodebases.ts    # Custom hook for managing codebase data
│   ├── useChat.ts         # Custom hook for chat functionality
│   └── useTheme.ts        # Custom hook for theme management
├── services/
│   ├── api.ts             # API client configuration
│   ├── codebaseService.ts # Codebase-related API calls
│   └── chatService.ts     # Chat-related API calls
├── utils/
│   ├── formatters.ts      # Data formatting utilities
│   ├── validation.ts      # Validation utilities
│   └── constants.ts       # Application constants
├── assets/
│   ├── images/            # Image assets
│   └── icons/             # SVG icons
├── App.tsx                # Main application component with routing
├── main.tsx               # React entry point with Redux Toolkit setup
└── index.css              # Global styles and Tailwind directives
```

## Component Architecture

### Atomic Design Principles

We follow Atomic Design principles to create a maintainable component hierarchy:

1. **Atoms** (src/components/ui/): The smallest, indivisible UI elements.
   - Examples: `Button`, `Input`, `Checkbox`, `Icon`, `Avatar`.

2. **Molecules** (src/components/features/): Combinations of atoms that work together.
   - Examples: `SearchBar` (Input + Button), `CodeCard` (Card + Icon + Text).

3. **Organisms** (src/components/layout/): More complex UI components composed of molecules and atoms.
   - Examples: `Navbar` (Logo + Links + Search), `CodebaseViewer` (Tree + Viewer).

4. **Pages** (src/pages/): Full page views that combine organisms into complete screens.
   - Examples: `DashboardPage`, `ChatPage`.

5. **Templates**: Page-level structures without real content.
   - (Implied in page structure)

6. **Wrapper** (src/App.tsx): The root application wrapper with global context providers and routing.

### Component Patterns

#### Container/Presentational Components

- **Container Components** (pages/, hooks/): Handle data fetching, state management, and business logic.
- **Presentational Components** (components/ui/, components/features/): Handle UI rendering and styling.

#### Compound Components

For components that need to be used together, we use the compound component pattern:

```typescript
// src/components/features/CodeCard.tsx
import React from 'react';

interface CodeCardProps {
  children: React.ReactNode;
}

interface CodeCardHeaderProps {
  children: React.ReactNode;
}

export function CodeCard({ children }: CodeCardProps) {
  return <div className="card">{children}</div>;
}

export function CodeCardHeader({ children }: CodeCardHeaderProps) {
  return <div className="card-header">{children}</div>;
}

export function CodeCardContent({ children }: CodeCardContentProps) {
  return <div className="card-content">{children}</div>;
}

// Usage:
<CodeCard>
  <Code

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
