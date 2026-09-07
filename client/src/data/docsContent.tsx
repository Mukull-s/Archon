import React from 'react';

export interface DocSection {
  id: string;
  title: string;
}

export interface DocPage {
  id: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  sections: DocSection[];
}

export interface DocCategory {
  title: string;
  pages: { id: string; title: string; summary: string }[];
}

export const DOC_CATEGORIES: DocCategory[] = [
  {
    title: 'Introduction',
    pages: [
      { id: 'what-is-archon', title: 'What is Archon?', summary: 'Overview of the codebase intelligence platform and the problems it solves.' },
      { id: 'how-it-works', title: 'How Archon Works', summary: 'High-level mental model of static analysis, embeddings, and workspace exploration.' },
    ],
  },
  {
    title: 'Getting Started',
    pages: [
      { id: 'quick-start', title: 'Quick Start', summary: 'From zero to an active codebase workspace in five minutes.' },
      { id: 'analyze-github', title: 'GitHub Repositories', summary: 'Connecting public and authorized GitHub repositories.' },
      { id: 'upload-zip', title: 'Local ZIP Archives', summary: 'Uploading local projects directly from disk.' },
      { id: 'first-analysis', title: 'Navigating Your Workspace', summary: 'Understanding confidence metrics, entry points, and workspace panels.' },
    ],
  },
  {
    title: 'Core Features',
    pages: [
      { id: 'repo-overview', title: 'Repository Overview', summary: 'High-level metrics, detected tech stack, lines of code, and entry-point catalogs.' },
      { id: 'architecture-view', title: 'Architecture View', summary: 'Component boundaries, multi-tier layout, and architectural layers.' },
      { id: 'dependency-graph', title: 'Dependency Graph', summary: 'Interactive module graphs, import resolution, and circular loop detection.' },
      { id: 'trace-flow', title: 'Trace Flow Analysis', summary: 'Following execution paths from API entry points to data models.' },
      { id: 'impact-analysis', title: 'Impact & Risk Scoring', summary: 'Blast radius estimation, in-degree centrality, and change risk scoring.' },
      { id: 'ai-chat', title: 'Codebase AI Assistant', summary: 'Context-grounded technical Q&A with clickable code citations.' },
      { id: 'repo-history', title: 'Managing Workspaces', summary: 'Switching active codebases, re-indexing, and workspace management.' },
    ],
  },
  {
    title: 'Core Concepts',
    pages: [
      { id: 'indexing-pipeline', title: 'The Analysis Pipeline', summary: 'End-to-end lifecycle from raw repository to an interactive workspace.' },
      { id: 'ast-analysis', title: 'AST Code Analysis', summary: 'How compiler-level syntax analysis provides deterministic code understanding.' },
      { id: 'dependency-resolution', title: 'Dependency & Cycle Mapping', summary: 'Resolving module relationships and identifying circular dependencies.' },
      { id: 'code-chunking', title: 'Semantic Code Chunking', summary: 'Structure-preserving code extraction along logical boundaries.' },
      { id: 'vector-search', title: 'Semantic Vector Search', summary: 'How code embeddings enable high-accuracy technical retrieval.' },
      { id: 'rag-pipeline', title: 'Context-Grounded AI', summary: 'Synthesizing verified codebase structure with AI reasoning.' },
    ],
  },
  {
    title: 'Reference & Policies',
    pages: [
      { id: 'limits', title: 'Repository Guidelines & Limits', summary: 'Repository size, file count guidelines, and supported languages.' },
      { id: 'security-privacy', title: 'Security & Privacy', summary: 'Data protection, ephemeral processing, and zero AI training on your code.' },
      { id: 'troubleshooting', title: 'Troubleshooting', summary: 'Practical guidance for large repositories and connection issues.' },
      { id: 'faq', title: 'Frequently Asked Questions', summary: 'Answers to common questions about usage, privacy, and architecture.' },
    ],
  },
];

export const ALL_DOC_PAGES = DOC_CATEGORIES.flatMap(c => c.pages);
