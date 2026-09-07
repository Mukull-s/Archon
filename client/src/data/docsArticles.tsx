import React from 'react';
import DocCallout from '../components/docs/DocCallout';
import DocCodeBlock from '../components/docs/DocCodeBlock';
import {
  IndexingPipelineDiagram,
  ASTDecompositionDiagram,
  TarjanSCCDiagram,
  RiskScoreFormulaDiagram,
  RAGArchitectureDiagram,
} from '../components/docs/DocDiagrams';

export interface ArticleContent {
  id: string;
  title: string;
  category: string;
  lead: string;
  sections: { id: string; title: string }[];
  body: React.ReactNode;
}

export const DOC_ARTICLES: Record<string, ArticleContent> = {
  'what-is-archon': {
    id: 'what-is-archon',
    title: 'What is Archon?',
    category: 'Introduction',
    lead: 'Archon is an AI-powered codebase intelligence platform designed to eliminate onboarding friction and help software engineers rapidly understand unfamiliar repositories.',
    sections: [
      { id: 'problem', title: 'The Problem It Solves' },
      { id: 'inputs', title: 'Supported Ingestion Inputs' },
      { id: 'outputs', title: 'What Archon Generates' },
      { id: 'philosophy', title: 'Core Engineering Philosophy' },
    ],
    body: (
      <>
        <h2 id="problem" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          The Problem It Solves
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          When software engineers clone an unfamiliar codebase or join a new engineering team, they frequently spend days reading through configuration files, deciphering module imports, tracing control flow from API entry points, and asking teammates where specific logic resides.
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Traditional documentation is usually out-of-date, and generic AI tools often guess without understanding actual repository architecture. Archon replaces guesswork with verified static analysis combined with semantic search.
        </p>

        <DocCallout type="note" title="Engineering Focus">
          Archon is designed for developers, architects, and technical reviewers who need to understand complex codebases quickly and accurately.
        </DocCallout>

        <h2 id="inputs" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Supported Ingestion Inputs
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon accepts two primary methods to analyze a codebase:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '20px' }}>
          <li><strong style={{ color: '#fff' }}>GitHub Repositories:</strong> Provide the URL of any public or authorized repository (e.g., <code>https://github.com/owner/repo</code>).</li>
          <li><strong style={{ color: '#fff' }}>Local Project Archives:</strong> Upload a <code>.zip</code> file of your project from disk for quick local analysis.</li>
        </ul>

        <h2 id="outputs" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          What Archon Generates
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Once analyzed, Archon generates an interactive multi-view workspace containing:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '20px' }}>
          <li><strong style={{ color: '#fff' }}>Repository Overview:</strong> Framework classification, language distribution ratios, total lines of code, and auto-detected entry points.</li>
          <li><strong style={{ color: '#fff' }}>Architecture Decomposition:</strong> Separation into architectural layers (Controllers, Services, Models, Utilities, UI).</li>
          <li><strong style={{ color: '#fff' }}>Interactive Dependency Graph:</strong> File-to-file import relationships with circular dependency detection.</li>
          <li><strong style={{ color: '#fff' }}>Trace Flow Chains:</strong> Visual execution paths demonstrating how data flows from entry routes down through business logic.</li>
          <li><strong style={{ color: '#fff' }}>Codebase AI Assistant:</strong> Context-grounded technical Q&amp;A with cited file references.</li>
        </ul>

        <h2 id="philosophy" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Core Engineering Philosophy
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon prioritizes <em>deterministic analysis first</em>, then layers AI on top. The system computes concrete dependencies and call relationships through compiler parsing, then provides this verified context to the AI model to guarantee reliable, hallucination-free explanations.
        </p>
      </>
    ),
  },

  'how-it-works': {
    id: 'how-it-works',
    title: 'How Archon Works',
    category: 'Introduction',
    lead: 'A conceptual overview of Archon’s architecture: combining compiler-level static analysis with semantic retrieval.',
    sections: [
      { id: 'mental-model', title: 'The Mental Model' },
      { id: 'pipeline-stages', title: 'The Analysis Workflow' },
      { id: 'deterministic-vs-probabilistic', title: 'Static Verification + AI Assistance' },
    ],
    body: (
      <>
        <h2 id="mental-model" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          The Mental Model
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Many AI developer tools treat code simply as plain text. However, software projects are structured, hierarchical, and deeply interconnected.
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon models your codebase as an interconnected graph of symbols and dependencies. Before generating answers, Archon parses source code into an Abstract Syntax Tree (AST), identifies functions and classes, and maps out import connections.
        </p>

        <IndexingPipelineDiagram />

        <h2 id="pipeline-stages" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          The Analysis Workflow
        </h2>
        <ol style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '20px' }}>
          <li><strong style={{ color: '#fff' }}>Ingestion &amp; Filtering:</strong> Archon reads your project archive and excludes non-source directories (such as lockfiles, build outputs, and node dependencies).</li>
          <li><strong style={{ color: '#fff' }}>AST Parsing:</strong> Source files are parsed at the compiler level to extract functions, classes, exports, and import declarations.</li>
          <li><strong style={{ color: '#fff' }}>Dependency Graphing:</strong> Module imports are resolved into a directed graph, automatically identifying circular import chains.</li>
          <li><strong style={{ color: '#fff' }}>Semantic Vectorization:</strong> Code is organized along logical symbol boundaries and converted into code-specialized embeddings.</li>
          <li><strong style={{ color: '#fff' }}>Interactive Workspace:</strong> The resulting knowledge base is loaded into an interactive visual workspace for rapid exploration.</li>
        </ol>

        <h2 id="deterministic-vs-probabilistic" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Static Verification + AI Assistance
        </h2>
        <div style={{
          overflowX: 'auto',
          margin: '20px 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 16px', color: '#fff' }}>Capability</th>
                <th style={{ padding: '12px 16px', color: '#fff' }}>Methodology</th>
                <th style={{ padding: '12px 16px', color: '#fff' }}>Advantage</th>
              </tr>
            </thead>
            <tbody style={{ color: '#a1a1aa' }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Imports &amp; Cycles</td>
                <td style={{ padding: '12px 16px' }}>Compiler AST + Graph Algorithms</td>
                <td style={{ padding: '12px 16px', color: '#4ade80' }}>100% Deterministic &amp; Exact</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Impact &amp; Risk</td>
                <td style={{ padding: '12px 16px' }}>Centrality &amp; Dependency Traversal</td>
                <td style={{ padding: '12px 16px', color: '#4ade80' }}>Calculated Blast Radius</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Code Retrieval</td>
                <td style={{ padding: '12px 16px' }}>Code-specialized Semantic Vectors</td>
                <td style={{ padding: '12px 16px', color: '#60a5fa' }}>Sub-second Technical Search</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Technical Q&amp;A</td>
                <td style={{ padding: '12px 16px' }}>Context-grounded AI synthesis</td>
                <td style={{ padding: '12px 16px', color: '#c084fc' }}>Accurate answers cited to files</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },

  'quick-start': {
    id: 'quick-start',
    title: 'Quick Start',
    category: 'Getting Started',
    lead: 'Analyze your first repository in under five minutes. Follow this step-by-step walkthrough.',
    sections: [
      { id: 'step-1', title: '1. Access Archon' },
      { id: 'step-2', title: '2. Authenticate' },
      { id: 'step-3', title: '3. Provide Your Repository' },
      { id: 'step-4', title: '4. Automatic Analysis' },
      { id: 'step-5', title: '5. Explore Your Workspace' },
    ],
    body: (
      <>
        <h2 id="step-1" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          1. Access Archon
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Open the Archon web application in your browser.
        </p>

        <h2 id="step-2" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          2. Authenticate
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Click <strong>Get Started</strong> or <strong>Sign In</strong>. You can sign in using GitHub OAuth, Google OAuth, or standard email verification.
        </p>

        <h2 id="step-3" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          3. Provide Your Repository
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Paste the URL of any GitHub repository into the input field:
        </p>
        <DocCodeBlock
          language="text"
          code="https://github.com/expressjs/express"
          filename="repository-input"
        />
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Alternatively, click <strong>Upload ZIP</strong> to select a project archive from your computer.
        </p>

        <h2 id="step-4" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          4. Automatic Analysis
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon will automatically extract files, generate the dependency graph, parse syntax symbols, and create the vector search index. For standard projects, this takes 15–30 seconds.
        </p>

        <h2 id="step-5" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          5. Explore Your Workspace
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Once processing completes, your interactive workspace opens:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px' }}>
          <li>Review the <strong>Overview</strong> tab for framework, size, and entry points.</li>
          <li>Check the <strong>Dependency Graph</strong> to visualize architecture.</li>
          <li>Use <strong>AI Chat</strong> to ask specific questions about the code.</li>
        </ul>
      </>
    ),
  },

  'analyze-github': {
    id: 'analyze-github',
    title: 'GitHub Repositories',
    category: 'Getting Started',
    lead: 'Connecting and analyzing GitHub repositories with Archon.',
    sections: [
      { id: 'url-formats', title: 'Supported URL Formats' },
      { id: 'how-it-connects', title: 'How Archon Connects' },
      { id: 'rate-limits', title: 'Rate Limits & Authentication' },
    ],
    body: (
      <>
        <h2 id="url-formats" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Supported URL Formats
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          You can paste GitHub repository links in any standard format:
        </p>
        <DocCodeBlock
          language="text"
          code={`https://github.com/owner/repo
https://github.com/owner/repo.git
github.com/owner/repo
owner/repo`}
        />

        <h2 id="how-it-connects" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          How Archon Connects
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon accesses repository source files at the default branch without pulling extraneous git history. This ensures that analysis starts quickly without large download overheads.
        </p>

        <h2 id="rate-limits" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Rate Limits &amp; Authentication
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Signing in with your GitHub account grants higher API rate limits and enables seamless access to repositories you have permission to view.
        </p>
      </>
    ),
  },

  'upload-zip': {
    id: 'upload-zip',
    title: 'Local ZIP Archives',
    category: 'Getting Started',
    lead: 'How to upload and analyze local projects directly from disk.',
    sections: [
      { id: 'preparing-zip', title: 'Preparing Your ZIP Archive' },
      { id: 'exclusions', title: 'Automatic Directory Exclusions' },
      { id: 'guidelines', title: 'Size Guidelines' },
    ],
    body: (
      <>
        <h2 id="preparing-zip" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Preparing Your ZIP Archive
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          You can upload any local project by compressing the root folder into a standard <code>.zip</code> file.
        </p>
        <DocCodeBlock
          language="bash"
          code="# Example: Zip project folder excluding dependencies
zip -r my-project.zip ./my-project -x '*/node_modules/*' -x '*/.git/*'"
        />

        <h2 id="exclusions" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Automatic Directory Exclusions
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon automatically ignores common dependency and build folders during processing:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '16px' }}>
          <li>Dependency folders: <code>node_modules</code></li>
          <li>Version control: <code>.git</code></li>
          <li>Build &amp; cache outputs: <code>dist</code>, <code>build</code>, <code>.next</code>, <code>out</code>, <code>coverage</code></li>
          <li>Lockfiles: <code>package-lock.json</code>, <code>yarn.lock</code>, <code>pnpm-lock.yaml</code></li>
        </ul>

        <h2 id="guidelines" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Size Guidelines
        </h2>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px' }}>
          <li>Maximum archive size: 15 MB uncompressed.</li>
          <li>Maximum file count: up to 400 source files per workspace.</li>
          <li>Non-code binary files (images, videos, compiled binaries) are automatically skipped.</li>
        </ul>
      </>
    ),
  },

  'first-analysis': {
    id: 'first-analysis',
    title: 'Navigating Your Workspace',
    category: 'Getting Started',
    lead: 'Understanding workspace layout, confidence metrics, and health indicators.',
    sections: [
      { id: 'workspace-layout', title: 'The Workspace Layout' },
      { id: 'confidence-metrics', title: 'Confidence Metrics' },
      { id: 'entry-points', title: 'Entry Points' },
    ],
    body: (
      <>
        <h2 id="workspace-layout" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          The Workspace Layout
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Each repository workspace provides dedicated panels designed for different engineering tasks:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '20px' }}>
          <li><strong>Overview:</strong> Tech stack breakdown, lines of code, and architectural summary.</li>
          <li><strong>Architecture:</strong> Layered view showing separation between Controllers, Services, and Data layers.</li>
          <li><strong>Graph:</strong> Interactive force-directed module dependency visualization.</li>
          <li><strong>Trace Flow:</strong> End-to-end call chain path tracing.</li>
          <li><strong>AI Chat:</strong> Intelligent assistant with direct source file citations.</li>
        </ul>

        <h2 id="confidence-metrics" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Confidence Metrics
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          The workspace calculates an empirical Confidence Score based on static verification:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px' }}>
          <li>AST resolution rate (percentage of source files parsed).</li>
          <li>Dependency resolution density (percentage of module imports successfully resolved).</li>
          <li>Test suite detection (presence of matching test or spec files).</li>
        </ul>

        <h2 id="entry-points" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Entry Points
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon highlights primary application roots and routing files, serving as starting points for trace flow analysis.
        </p>
      </>
    ),
  },

  'repo-overview': {
    id: 'repo-overview',
    title: 'Repository Overview',
    category: 'Core Features',
    lead: 'High-level codebase summary: detected frameworks, language ratios, and structural metrics.',
    sections: [
      { id: 'inventory', title: 'Codebase Metrics' },
      { id: 'stack-detection', title: 'Tech Stack & Frameworks' },
      { id: 'loc-breakdown', title: 'Language Distribution' },
    ],
    body: (
      <>
        <h2 id="inventory" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Codebase Metrics
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          The Overview panel gives you an immediate high-level summary of the project size, total scanned files, and primary architecture patterns.
        </p>

        <h2 id="stack-detection" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Tech Stack &amp; Frameworks
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon inspects project manifests and import signatures to identify frameworks and key libraries (e.g., React, Express, Next.js, FastAPI, Prisma, Tailwind).
        </p>

        <h2 id="loc-breakdown" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Language Distribution
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          View lines of code and percentage breakdown by programming language across the repository.
        </p>
      </>
    ),
  },

  'architecture-view': {
    id: 'architecture-view',
    title: 'Architecture View',
    category: 'Core Features',
    lead: 'Visualizing component boundaries and architectural tiers across the codebase.',
    sections: [
      { id: 'layered-model', title: 'Layered Architecture Model' },
      { id: 'domain-modules', title: 'Module Grouping' },
      { id: 'use-cases', title: 'When to Use Architecture View' },
    ],
    body: (
      <>
        <h2 id="layered-model" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Layered Architecture Model
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Modern software projects generally follow a multi-tier separation of concerns:
        </p>
        <DocCodeBlock
          language="text"
          code={`[ Entry Points / Routes ] ➔ (HTTP & API endpoints)
          ↓
[ Controllers / Handlers ] ➔ (Validation & request flow)
          ↓
[ Services / Business Logic ] ➔ (Core domain logic & integrations)
          ↓
[ Models / Persistence ] ➔ (Database schemas & entities)`}
        />
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon categorizes files into these architectural tiers to help you verify that layer boundaries and architectural guidelines are respected.
        </p>

        <h2 id="domain-modules" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Module Grouping
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Related files that belong to common functional domains are grouped together, making system modularity clear.
        </p>

        <h2 id="use-cases" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          When to Use Architecture View
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Ideal for technical onboarding, architectural audits, and verifying that separation of concerns is maintained.
        </p>
      </>
    ),
  },

  'dependency-graph': {
    id: 'dependency-graph',
    title: 'Dependency Graph',
    category: 'Core Features',
    lead: 'Interactive module visualization, import relationships, and circular loop detection.',
    sections: [
      { id: 'nodes-edges', title: 'Nodes and Edges' },
      { id: 'circular-loops', title: 'Circular Dependency Detection' },
      { id: 'centrality', title: 'High-Impact Modules' },
    ],
    body: (
      <>
        <h2 id="nodes-edges" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Nodes and Edges
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          The Dependency Graph represents every scanned file as an interactive node:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '16px' }}>
          <li><strong style={{ color: '#fff' }}>Nodes:</strong> Individual source files. Nodes are sized proportionally to how many other files depend on them.</li>
          <li><strong style={{ color: '#fff' }}>Edges:</strong> Directed connections showing import and usage relationships between modules.</li>
        </ul>

        <h2 id="circular-loops" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Circular Dependency Detection
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Circular dependencies occur when modules directly or indirectly import each other. These can cause unexpected runtime behavior and bundler complications.
        </p>

        <TarjanSCCDiagram />

        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon flags circular import chains in red on the graph and catalogs them in the workspace panel for review.
        </p>

        <h2 id="centrality" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          High-Impact Modules
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Files with high incoming dependency counts (e.g. shared utilities, database connections, authentication middleware) represent critical paths where modifications require extra care.
        </p>
      </>
    ),
  },

  'trace-flow': {
    id: 'trace-flow',
    title: 'Trace Flow Analysis',
    category: 'Core Features',
    lead: 'Following execution paths from API routes through business logic to data persistence.',
    sections: [
      { id: 'tracing-concept', title: 'Execution Path Tracing' },
      { id: 'example-trace', title: 'Example Workflow Chain' },
      { id: 'dead-code', title: 'Unlinked File Detection' },
    ],
    body: (
      <>
        <h2 id="tracing-concept" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Execution Path Tracing
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Trace Flow connects root entry points down through downstream functions, helping you follow how requests and data move through the codebase without stepping through a debugger.
        </p>

        <h2 id="example-trace" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Example Workflow Chain
        </h2>
        <DocCodeBlock
          language="text"
          code={`POST /api/orders
  ↓
src/routes/order.routes.ts [Route Definition]
  ↓
src/controllers/order.controller.ts [Request Validation]
  ↓
src/services/order.service.ts [Domain Business Logic]
  ↓
src/models/order.model.ts [Database Persistence]`}
        />

        <h2 id="dead-code" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Unlinked File Detection
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Files that are never imported across the project and are not entry points or configuration files are flagged as potential dead code.
        </p>
      </>
    ),
  },

  'impact-analysis': {
    id: 'impact-analysis',
    title: 'Impact & Risk Scoring',
    category: 'Core Features',
    lead: 'Quantifying blast radius and regression risk before you modify or refactor code.',
    sections: [
      { id: 'risk-formula', title: 'The Risk Model' },
      { id: 'blast-radius', title: 'Downstream Blast Radius' },
      { id: 'in-degree', title: 'Module Centrality' },
    ],
    body: (
      <>
        <h2 id="risk-formula" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          The Risk Model
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon quantifies the impact of modifying any file by evaluating its position in the dependency hierarchy:
        </p>

        <RiskScoreFormulaDiagram />

        <h2 id="blast-radius" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Downstream Blast Radius
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Measures how deep the chain of downstream dependents extends. If file A is used by B, which is used by C, modifying A has a blast radius depth of 2.
        </p>

        <h2 id="in-degree" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Module Centrality
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Direct consumer count. A shared helper or configuration file imported by 25 files has high centrality; any signature change could affect all 25 consumers.
        </p>
      </>
    ),
  },

  'ai-chat': {
    id: 'ai-chat',
    title: 'Codebase AI Assistant',
    category: 'Core Features',
    lead: 'Context-grounded natural language Q&A with direct source file citations.',
    sections: [
      { id: 'grounded-answers', title: 'Context-Grounded Answers' },
      { id: 'file-citations', title: 'Clickable File Citations' },
      { id: 'sample-queries', title: 'Useful Query Patterns' },
    ],
    body: (
      <>
        <h2 id="grounded-answers" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Context-Grounded Answers
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          When you ask questions in AI Chat, Archon retrieves relevant code snippets and structural context from your repository to answer with precision, avoiding the generic hallucinations common in general-purpose AI tools.
        </p>

        <h2 id="file-citations" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Clickable File Citations
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Whenever the assistant references a specific file in its answer, it renders as a clickable badge so you can inspect the file immediately in your workspace.
        </p>

        <h2 id="sample-queries" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Useful Query Patterns
        </h2>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px' }}>
          <li>&ldquo;Where is user session validation handled in the application?&rdquo;</li>
          <li>&ldquo;How does the project configure database connections and connection pooling?&rdquo;</li>
          <li>&ldquo;Trace what happens when a checkout request is processed.&rdquo;</li>
          <li>&ldquo;What modules depend on the authentication service?&rdquo;</li>
        </ul>
      </>
    ),
  },

  'repo-history': {
    id: 'repo-history',
    title: 'Managing Workspaces',
    category: 'Core Features',
    lead: 'Switching active projects, re-indexing repositories, and workspace management.',
    sections: [
      { id: 'switching-workspaces', title: 'Switching Workspaces' },
      { id: 'refreshing-index', title: 'Re-Indexing Repositories' },
      { id: 'managing-storage', title: 'Workspace Management' },
    ],
    body: (
      <>
        <h2 id="switching-workspaces" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Switching Workspaces
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Your analyzed projects remain saved in your account. You can quickly switch between projects using the repository switcher dropdown in the navigation header or by visiting <strong>My Repositories</strong>.
        </p>

        <h2 id="refreshing-index" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Re-Indexing Repositories
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          When new commits are pushed upstream to GitHub, click <strong>Re-index</strong> in the repository header to refresh the dependency graph, symbols, and search index.
        </p>

        <h2 id="managing-storage" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Workspace Management
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          You can remove old workspaces whenever they are no longer needed. Deleting a workspace removes all cached files and embeddings associated with that project.
        </p>
      </>
    ),
  },

  'indexing-pipeline': {
    id: 'indexing-pipeline',
    title: 'The Analysis Pipeline',
    category: 'Core Concepts',
    lead: 'How Archon transforms a raw source repository into a structured, queryable workspace.',
    sections: [
      { id: 'pipeline-overview', title: 'Pipeline Architecture' },
      { id: 'data-sanitization', title: 'Data Sanitization & Preparation' },
      { id: 'performance', title: 'Analysis Speed & Throughput' },
    ],
    body: (
      <>
        <h2 id="pipeline-overview" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Pipeline Architecture
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon coordinates a multi-stage analysis pipeline that progresses through clear stages:
        </p>

        <IndexingPipelineDiagram />

        <h2 id="data-sanitization" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Data Sanitization &amp; Preparation
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Before parsing, Archon removes non-essential files (such as compiled assets, temporary test runs, and third-party dependencies) to ensure that the resulting workspace focuses purely on the actual application code.
        </p>

        <h2 id="performance" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Analysis Speed &amp; Throughput
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          By processing files concurrently and using targeted AST extraction rather than complete compiler build steps, typical repositories finish processing in 15 to 45 seconds.
        </p>
      </>
    ),
  },

  'ast-analysis': {
    id: 'ast-analysis',
    title: 'AST Code Analysis',
    category: 'Core Concepts',
    lead: 'How compiler-level syntax analysis provides deterministic code understanding.',
    sections: [
      { id: 'why-ast', title: 'Why Syntax Trees?' },
      { id: 'symbol-extraction', title: 'Symbol Extraction' },
      { id: 'visitor-pattern', title: 'Syntax Tree Representation' },
    ],
    body: (
      <>
        <h2 id="why-ast" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Why Syntax Trees?
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Simple text search and regular expressions cannot reliably distinguish between a real function declaration, a commented-out snippet, or a variable name inside a string literal.
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          An Abstract Syntax Tree (AST) represents source code the way a compiler understands it: as structured nodes of declarations, parameters, imports, and calls.
        </p>

        <ASTDecompositionDiagram />

        <h2 id="symbol-extraction" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Symbol Extraction
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon traverses the syntax tree of each file to catalog:
        </p>
        <ul style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.8, paddingLeft: '20px' }}>
          <li>Import and export declarations (both ESM and CommonJS).</li>
          <li>Function signatures and arrow function assignments.</li>
          <li>Classes, methods, and interface definitions.</li>
          <li>Exact line boundaries for each symbol.</li>
        </ul>
      </>
    ),
  },

  'dependency-resolution': {
    id: 'dependency-resolution',
    title: 'Dependency & Cycle Mapping',
    category: 'Core Concepts',
    lead: 'Resolving module relationships, normalizing aliases, and identifying circular imports.',
    sections: [
      { id: 'path-resolution', title: 'Module Path Resolution' },
      { id: 'cycle-detection', title: 'Circular Import Detection' },
    ],
    body: (
      <>
        <h2 id="path-resolution" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Module Path Resolution
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Codebases employ various import styles: relative paths (<code>./utils</code>), parent traversal (<code>../../config</code>), and path aliases (<code>@/components</code>).
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon normalizes import targets against the repository file set, constructing a unified module relationship map.
        </p>

        <h2 id="cycle-detection" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Circular Import Detection
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon checks the dependency graph for cycles. When two or more modules depend on each other in a loop, Archon highlights them to alert engineers to potential initialization bugs.
        </p>
      </>
    ),
  },

  'code-chunking': {
    id: 'code-chunking',
    title: 'Semantic Code Chunking',
    category: 'Core Concepts',
    lead: 'Organizing code into structure-preserving blocks along logical boundaries.',
    sections: [
      { id: 'boundary-chunking', title: 'Boundary-Aware Chunking' },
      { id: 'context-preservation', title: 'Context Preservation' },
    ],
    body: (
      <>
        <h2 id="boundary-chunking" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Boundary-Aware Chunking
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Splitting code by an arbitrary line count often separates functions from their signatures. Archon segments code along natural syntax boundaries (such as complete functions, classes, or logical code blocks) to maintain technical context.
        </p>

        <h2 id="context-preservation" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Context Preservation
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Each code chunk retains file context, line boundaries, and symbol metadata so that search queries match the full intent of the code.
        </p>
      </>
    ),
  },

  'vector-search': {
    id: 'vector-search',
    title: 'Semantic Vector Search',
    category: 'Core Concepts',
    lead: 'How specialized code embeddings enable high-accuracy technical retrieval.',
    sections: [
      { id: 'embeddings-concept', title: 'Code Vector Representations' },
      { id: 'instant-retrieval', title: 'Fast Similarity Matching' },
    ],
    body: (
      <>
        <h2 id="embeddings-concept" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Code Vector Representations
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon uses embeddings tailored specifically for code syntax and technical queries. Unlike general conversational models, code embeddings understand programming concepts such as interfaces, error handling, and API endpoints.
        </p>

        <h2 id="instant-retrieval" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Fast Similarity Matching
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Code vectors are indexed to enable rapid cosine similarity search, matching developer questions to relevant source files in milliseconds.
        </p>
      </>
    ),
  },

  'rag-pipeline': {
    id: 'rag-pipeline',
    title: 'Context-Grounded AI',
    category: 'Core Concepts',
    lead: 'Synthesizing verified codebase structure with AI reasoning to produce accurate answers.',
    sections: [
      { id: 'rag-architecture', title: 'The Retrieval Flow' },
      { id: 'evidence-grounding', title: 'Evidence-Grounded Explanations' },
    ],
    body: (
      <>
        <h2 id="rag-architecture" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          The Retrieval Flow
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon connects user queries with real repository data using Retrieval-Augmented Generation (RAG):
        </p>

        <RAGArchitectureDiagram />

        <h2 id="evidence-grounding" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Evidence-Grounded Explanations
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          By pairing the query with retrieved code snippets and verified import relationships, the AI model produces clear, referenced explanations tied directly to your codebase.
        </p>
      </>
    ),
  },

  'limits': {
    id: 'limits',
    title: 'Repository Guidelines & Limits',
    category: 'Reference & Policies',
    lead: 'Guidelines for repository sizes, file counts, and supported programming languages.',
    sections: [
      { id: 'guidelines-table', title: 'Repository Size & File Guidelines' },
      { id: 'supported-languages', title: 'Supported Languages' },
    ],
    body: (
      <>
        <h2 id="guidelines-table" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Repository Size &amp; File Guidelines
        </h2>
        <div style={{
          overflowX: 'auto',
          margin: '20px 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '12px 16px', color: '#fff' }}>Metric</th>
                <th style={{ padding: '12px 16px', color: '#fff' }}>Supported Limit</th>
                <th style={{ padding: '12px 16px', color: '#fff' }}>Purpose</th>
              </tr>
            </thead>
            <tbody style={{ color: '#a1a1aa' }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Repository Files</td>
                <td style={{ padding: '12px 16px' }}>Up to 400 source files</td>
                <td style={{ padding: '12px 16px' }}>Ensures rapid processing under 45 seconds</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Uncompressed Project Size</td>
                <td style={{ padding: '12px 16px' }}>Up to 15 MB</td>
                <td style={{ padding: '12px 16px' }}>Optimized for fast uploads and indexing</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Single File Size</td>
                <td style={{ padding: '12px 16px' }}>Up to 1 MB per file</td>
                <td style={{ padding: '12px 16px' }}>Excludes large minified bundles</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 16px', color: '#f4f4f5', fontWeight: 500 }}>Vector Index Capacity</td>
                <td style={{ padding: '12px 16px' }}>Up to 2,000 code chunks</td>
                <td style={{ padding: '12px 16px' }}>Provides thorough codebase coverage</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="supported-languages" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Supported Languages
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          <strong>Deep AST Analysis &amp; Module Resolution:</strong> TypeScript (<code>.ts</code>, <code>.tsx</code>), JavaScript (<code>.js</code>, <code>.jsx</code>, <code>.mjs</code>).
        </p>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          <strong>Vector Search &amp; AI Q&amp;A:</strong> Python, Go, Rust, Java, C/C++, SQL, Markdown, JSON, YAML, and HTML/CSS.
        </p>
      </>
    ),
  },

  'security-privacy': {
    id: 'security-privacy',
    title: 'Security & Privacy',
    category: 'Reference & Policies',
    lead: 'How Archon safeguards your source code, tokens, and data privacy.',
    sections: [
      { id: 'read-only', title: 'Read-Only Repository Access' },
      { id: 'ephemeral', title: 'Ephemeral Processing' },
      { id: 'no-ai-training', title: 'Zero AI Training on Your Code' },
      { id: 'user-isolation', title: 'Account Data Isolation' },
    ],
    body: (
      <>
        <h2 id="read-only" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Read-Only Repository Access
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Archon performs read-only analysis. It never creates commits, writes branches, or alters your GitHub repositories.
        </p>

        <h2 id="ephemeral" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Ephemeral Processing
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Uploaded archives are unpacked in isolated temporary workspaces solely to parse code structures and generate search vectors. Temporary files are removed as soon as processing concludes.
        </p>

        <h2 id="no-ai-training" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Zero AI Training on Your Code
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Your code is never used to train public or foundational AI models. Inference requests use commercial APIs with zero-data-retention agreements for API calls.
        </p>

        <h2 id="user-isolation" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Account Data Isolation
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          Your workspaces and indexed codebases belong exclusively to your user account. Access controls ensure that other users cannot view or query your repositories.
        </p>
      </>
    ),
  },

  'troubleshooting': {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    category: 'Reference & Policies',
    lead: 'Practical guidance for resolving upload limits, connection issues, or query delays.',
    sections: [
      { id: 'size-limits', title: 'Repository Size Exceeded' },
      { id: 'rate-limits', title: 'GitHub Rate Limits' },
      { id: 'query-tips', title: 'Getting the Most from AI Chat' },
    ],
    body: (
      <>
        <h2 id="size-limits" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Repository Size Exceeded
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          If an upload is flagged as exceeding file limits, ensure that dependency folders (<code>node_modules</code>) and build artifacts (<code>dist</code>, <code>build</code>) are excluded before creating your ZIP archive.
        </p>

        <h2 id="rate-limits" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          GitHub Rate Limits
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          If you encounter a rate limit message when connecting a public repository, sign in using <strong>Continue with GitHub</strong> on the login page to attach authenticated credentials.
        </p>

        <h2 id="query-tips" style={{ fontSize: '20px', fontWeight: 600, color: '#fff', margin: '32px 0 12px' }}>
          Getting the Most from AI Chat
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '16px' }}>
          For the most accurate answers, ask specific technical questions referencing module names or behaviors (for example, <em>&ldquo;Explain how authentication middleware verifies JWT tokens&rdquo;</em>).
        </p>
      </>
    ),
  },

  'faq': {
    id: 'faq',
    title: 'Frequently Asked Questions',
    category: 'Reference & Policies',
    lead: 'Quick answers to common questions about Archon capabilities and operations.',
    sections: [
      { id: 'faq-1', title: 'Does Archon modify my repository?' },
      { id: 'faq-2', title: 'Can I analyze private repositories?' },
      { id: 'faq-3', title: 'How fast is repository analysis?' },
      { id: 'faq-4', title: 'How does Archon detect circular dependencies?' },
    ],
    body: (
      <>
        <h2 id="faq-1" style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: '28px 0 8px' }}>
          Does Archon modify my repository?
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
          No. Archon operates strictly in read-only mode and never pushes changes or alters your repository files.
        </p>

        <h2 id="faq-2" style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: '28px 0 8px' }}>
          Can I analyze private repositories?
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
          Yes. When you sign in with GitHub OAuth with authorized repo permissions, Archon can access private repositories in your account. You can also upload a local ZIP archive directly.
        </p>

        <h2 id="faq-3" style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: '28px 0 8px' }}>
          How fast is repository analysis?
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
          For typical repositories with up to 400 source files, the entire ingestion, AST extraction, dependency resolution, and search indexing completes in 15 to 45 seconds.
        </p>

        <h2 id="faq-4" style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: '28px 0 8px' }}>
          How does Archon detect circular dependencies?
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
          Archon performs graph cycle analysis across resolved import paths to identify any mutual dependencies that form a loop, highlighting them directly on the dependency graph.
        </p>
      </>
    ),
  },
};
