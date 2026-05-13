# 🧠 Archon — Master Build Plan
> Stack: React+Vite+Tailwind+ReactBits+Framer Motion | Node.js+Express | LangChain.js | MiniMax (primary) | Gemini (fallback) | GitHub OAuth

---                 

## 📁 Final Folder Structure
```
archon/
├── frontend/          (React + Vite)
└── backend/           (Node.js + Express)
    ├── routes/
    ├── services/
    └── utils/
```

---

## DAY 1 — Project Setup + Landing Page

### 1.1 Initialize Projects
- [ ] Create root folder: `mkdir archon && cd archon`
- [ ] Init frontend: `npm create vite@latest frontend -- --template react`
- [ ] `cd frontend && npm install`
- [ ] Install frontend deps:
  ```
  npm install tailwindcss @tailwindcss/vite framer-motion react-router-dom zustand axios react-flow-renderer shiki lottie-react
  ```
- [ ] Configure Tailwind in `vite.config.js` and `index.css`
- [ ] Add Google Fonts (Inter + JetBrains Mono) in `index.html`
- [ ] Init backend: `mkdir backend && cd backend && npm init -y`
- [ ] Install backend deps:
  ```
  npm install express cors dotenv axios octokit langchain @langchain/community
  ```
- [ ] Create `.env` in backend with:
  ```
  MINIMAX_API_KEY=your_key
  GEMINI_API_KEY=your_key
  GITHUB_CLIENT_ID=your_id
  GITHUB_CLIENT_SECRET=your_secret
  PORT=5000
  ```
- [ ] Create `backend/server.js` with basic Express setup + CORS

### 1.2 Design Tokens (CSS)
- [ ] In `frontend/src/index.css` define:
  - Background: `#0a0a0f`
  - Glass panel: `rgba(255,255,255,0.05)` + `backdrop-blur`
  - Accent gradient: violet `#7c3aed` → cyan `#06b6d4`
  - Font: Inter (body), JetBrains Mono (code)
- [ ] Create `frontend/src/components/ui/GlassPanel.jsx` — reusable glassmorphism card
- [ ] Create `frontend/src/components/ui/GradientButton.jsx` — glowing CTA button
- [ ] Create `frontend/src/components/ui/Badge.jsx` — tech stack pills

### 1.3 Landing Page — Hero Section
- [ ] Create `frontend/src/pages/Landing.jsx`
- [ ] Build `HeroSection.jsx`:
  - Animated headline with Framer Motion `fadeInUp`
  - Subtitle text
  - Glowing repo URL input field (glass style)
  - "Analyze Repository" gradient button
  - Floating code particles background (CSS animation)
- [ ] Add scroll indicator arrow bouncing at bottom

### 1.4 Landing Page — How It Works
- [ ] Build `HowItWorks.jsx`:
  - 3 steps: Paste URL → AI Analyzes → Explore
  - Each step card animates in on scroll (`whileInView`)
  - Connecting animated arrows between steps

### 1.5 Landing Page — Features Showcase
- [ ] Build `FeaturesSection.jsx`:
  - 5 feature cards (Architecture, Flow Tracing, File Insights, Chat, Learning Mode)
  - Staggered scroll animations (delay each card by 0.1s)
  - Icons for each feature (use emoji or Heroicons)
  - Glass panel cards with violet border glow on hover

### 1.6 Landing Page — Tech Stack Marquee
- [ ] Build `TechMarquee.jsx`:
  - Infinite horizontal scroll ticker
  - Show: React, Node.js, LangChain, MiniMax, Gemini, FAISS, GitHub
  - CSS `@keyframes` scroll animation

### 1.7 Landing Page — CTA + Footer
- [ ] Build `CTASection.jsx` — big centered "Start Analyzing" button
- [ ] Build `Footer.jsx` — minimal, links to GitHub

### 1.8 Routing Setup
- [ ] Setup `App.jsx` with React Router:
  - `/` → Landing
  - `/auth/callback` → AuthCallback
  - `/dashboard/:owner/:repo` → Dashboard
- [ ] Wire repo URL input → on submit → redirect to `/dashboard/owner/repo`

---

## DAY 2 — GitHub OAuth + Repo Ingestion

### 2.1 GitHub OAuth App Setup
- [ ] Go to GitHub → Settings → Developer Settings → OAuth Apps → New
- [ ] Set callback URL: `http://localhost:5000/auth/callback`
- [ ] Save Client ID and Client Secret to `.env`

### 2.2 OAuth Backend Routes
- [ ] Create `backend/routes/auth.js`:
  - `GET /auth/github` → redirect to GitHub OAuth URL
  - `GET /auth/callback` → exchange code for access token → send to frontend

### 2.3 OAuth Frontend Flow
- [ ] Create `frontend/src/pages/Auth.jsx` — handles callback, stores token in Zustand
- [ ] Create `frontend/src/store/authStore.js` — stores GitHub access token
- [ ] "Sign in with GitHub" button on landing hero redirects to `/auth/github`

### 2.4 GitHub Ingestion Service
- [ ] Create `backend/services/github.js`:
  - `fetchRepoTree(owner, repo, token)` — gets full file tree via Octokit
  - `fetchFileContent(owner, repo, path, token)` — gets file content
  - `filterFiles(tree)` — exclude: `node_modules`, `.git`, `dist`, `build`, binaries
  - `getSupportedExtensions()` — returns `['.js','.ts','.py','.md','.json','.jsx','.tsx','.go','.rs']`

### 2.5 Repo Scope Selector UI
- [ ] Create `frontend/src/components/dashboard/ScopeSelector.jsx`:
  - After entering repo URL, show folder tree checkboxes
  - User selects which folders to include
  - "Start Analysis" button triggers ingestion with selected paths

### 2.6 Analyze Endpoint
- [ ] Create `backend/routes/analyze.js`:
  - `POST /analyze` — accepts `{ owner, repo, token, selectedPaths }`
  - Calls `github.js` to fetch all files in selected scope
  - Returns file tree + raw content for next step

---

## DAY 3 — RAG Pipeline (Core AI)

### 3.1 Code Chunking
- [ ] Create `backend/services/chunker.js`:
  - Split each file content into chunks of max 500 tokens
  - Keep file path as metadata on every chunk
  - For long files: split by function/class boundaries using regex
  - Return array of `{ content, metadata: { filePath, language } }`

### 3.2 Embeddings with MiniMax
- [ ] Create `backend/services/embedder.js`:
  - `generateEmbedding(text)` — calls MiniMax `embo-01` API
  - `batchEmbed(chunks)` — embeds all chunks (add 100ms delay between batches to avoid rate limits)
  - Returns `[{ content, embedding, metadata }]`

### 3.3 Vector Store Setup
- [ ] Create `backend/services/vectorstore.js`:
  - Use LangChain.js `MemoryVectorStore`
  - `buildStore(chunks)` — creates store from embedded chunks
  - `queryStore(store, query, topK=5)` — returns top-K relevant chunks
  - Store active vector stores in a `Map` keyed by `owner/repo`

### 3.4 RAG Chain
- [ ] Create `backend/services/ragChain.js`:
  - `buildRagChain(vectorStore)` — creates LangChain retrieval chain
  - Retriever fetches top 5 chunks
  - Prompt template: "You are a code expert. Use this code context to answer: {context} \n\nQuestion: {question}"
  - LLM: MiniMax → fallback Gemini

### 3.5 LLM Abstraction
- [ ] Create `backend/utils/llm.js`:
  - `callMiniMax(prompt)` — calls MiniMax chat API
  - `callGemini(prompt)` — calls Gemini 1.5 Flash API
  - `smartLLM(prompt, complexity)` — if `complexity === 'high'` use Gemini, else MiniMax
  - Wrap in try/catch: if MiniMax fails → auto-fallback to Gemini

### 3.6 Chat Endpoint
- [ ] Create `backend/routes/chat.js`:
  - `POST /chat` — accepts `{ owner, repo, question, token }`
  - Retrieves vector store from Map
  - Runs RAG chain → returns answer + source chunks (file paths)

---

## DAY 4 — Intelligence Modules

### 4.1 Architecture Generator
- [ ] Create `backend/services/intelligence/architecture.js`:
  - Takes repo file tree + key file summaries
  - Prompt: "Analyze this repo structure and generate a Mermaid diagram showing the main modules and their relationships"
  - Returns valid Mermaid syntax string
  - Endpoint: `GET /architecture/:owner/:repo`

### 4.2 Flow Tracer
- [ ] Create `backend/services/intelligence/flowTracer.js`:
  - User inputs feature: "How does login work?"
  - RAG retrieves relevant files
  - Prompt: "Trace how '{feature}' works in this codebase step-by-step. List each step with file name and what happens."
  - Returns array of `{ step, file, description }`
  - Endpoint: `POST /flow`

### 4.3 File Insights
- [ ] Create `backend/services/intelligence/insights.js`:
  - For each file: prompt LLM to return `{ summary, keyFunctions[], complexity: 1-10, purpose }`
  - Complexity scoring based on lines, nesting, function count
  - Endpoint: `GET /insights/:owner/:repo`

### 4.4 Learning Mode
- [ ] Create `backend/services/intelligence/learning.js`:
  - `generateInterviewQuestions(repoContext)` — returns 10 Q&As
  - `extractKeyConcepts(repoContext)` — returns key tech concepts used
  - `generateBeginnerGuide(repoContext)` — step-by-step reading order
  - Endpoint: `GET /learning/:owner/:repo`

---

## DAY 5 — Dashboard UI

### 5.1 Dashboard Layout
- [ ] Create `frontend/src/pages/Dashboard.jsx`:
  - Left sidebar (20% width) — file tree
  - Main panel (80%) — tabbed content
  - Top navbar — repo name, GitHub link, back button

### 5.2 File Tree Sidebar
- [ ] Create `frontend/src/components/dashboard/FileTree.jsx`:
  - Collapsible folder tree
  - File type icons (color-coded by extension)
  - Click a file → show its insights in main panel
  - Framer Motion: expand/collapse animation

### 5.3 Tab Navigation
- [ ] Create `frontend/src/components/dashboard/TabBar.jsx`:
  - Tabs: Architecture | Flow | Insights | Chat | Learning
  - Animated underline indicator (Framer Motion `layoutId`)

### 5.4 Architecture Tab
- [ ] Create `frontend/src/components/dashboard/ArchitectureView.jsx`:
  - Fetch Mermaid syntax from `/architecture` endpoint
  - Render with `mermaid.js` (`import mermaid from 'mermaid'`)
  - Also show React Flow graph (nodes = modules, edges = relationships)
  - Zoom/pan enabled

### 5.5 Flow Tracer Tab
- [ ] Create `frontend/src/components/dashboard/FlowView.jsx`:
  - Input: "What feature do you want to trace?"
  - Submit → call `/flow` endpoint
  - Render results as vertical step-by-step timeline
  - Each step: step number, file badge, description
  - Animate each step in sequentially

### 5.6 Insights Tab
- [ ] Create `frontend/src/components/dashboard/InsightsView.jsx`:
  - Grid of file cards
  - Each card: file name, purpose badge, complexity bar (animated), key functions list
  - Click card → expand with full summary
  - Color-code complexity: green (1-3), yellow (4-7), red (8-10)

### 5.7 Zustand Store
- [ ] Create `frontend/src/store/repoStore.js`:
  - `repoData` — file tree, raw files
  - `architecture` — Mermaid string
  - `insights` — file cards data
  - `chatHistory` — messages array
  - `isLoading` — loading states per feature

---

## DAY 6 — Chat Interface + Learning Mode + Polish

### 6.1 Chat Tab
- [ ] Create `frontend/src/components/chat/ChatWindow.jsx`:
  - Message bubbles: user (right, violet) and AI (left, glass)
  - Code blocks in AI responses: use Shiki for syntax highlighting
  - Source pills: show retrieved file paths under each AI message
  - Auto-scroll to latest message

### 6.2 Quick Prompts
- [ ] Add pre-built question chips above chat input:
  - "How does authentication work?"
  - "What is the main entry point?"
  - "Explain the folder structure"
  - "What dependencies are used?"

### 6.3 Learning Mode Tab
- [ ] Create `frontend/src/components/dashboard/LearningView.jsx`:
  - Three sections: "Beginner Guide" | "Key Concepts" | "Interview Questions"
  - Interview Q&As: accordion expand/collapse
  - Key concepts: animated tag cloud
  - Beginner guide: numbered reading path

### 6.4 Loading States
- [ ] Create `frontend/src/components/ui/AnalysisLoader.jsx`:
  - Shows while repo is being analyzed
  - Step indicators: "Fetching files..." → "Creating embeddings..." → "Building knowledge base..." → "Ready!"
  - Lottie animation or CSS spinner

### 6.5 Error Handling
- [ ] Add error toast notifications for:
  - Repo not found
  - Private repo (no access)
  - API rate limit hit
  - Network error
- [ ] Create `frontend/src/components/ui/Toast.jsx`

### 6.6 Scroll Animations Audit
- [ ] Ensure every section on landing page uses `whileInView` with `once: true`
- [ ] Add `staggerChildren` to feature cards
- [ ] Add parallax effect to hero background
- [ ] Smooth page transitions with `AnimatePresence`

---

## DAY 7 — Testing + Deployment

### 7.1 End-to-End Testing
- [ ] Test with small repo (< 20 files)
- [ ] Test with medium repo (50-100 files)
- [ ] Test chat: ask 5 different questions per repo
- [ ] Test flow tracer with 3 feature questions
- [ ] Test architecture generation
- [ ] Test learning mode

### 7.2 Bug Fixes Checklist
- [ ] Confirm OAuth flow works end-to-end
- [ ] Confirm fallback from MiniMax → Gemini works
- [ ] Confirm vector store is cleared between different repos
- [ ] Confirm file tree renders correctly for nested folders

### 7.3 Deploy Frontend (Vercel)
- [ ] `cd frontend && npm run build`
- [ ] Push to GitHub repo
- [ ] Connect repo to Vercel
- [ ] Add env variable: `VITE_API_URL=https://your-backend.render.com`

### 7.4 Deploy Backend (Render)
- [ ] Push backend to GitHub
- [ ] Create new Web Service on Render
- [ ] Set all env variables (MINIMAX_API_KEY, GEMINI_API_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
- [ ] Update GitHub OAuth App callback URL to production URL

### 7.5 Final Polish
- [ ] Add meta tags + Open Graph tags to `index.html`
- [ ] Add favicon (code brain icon)
- [ ] Write final `README.md` with screenshots
- [ ] Test on mobile (responsive check)

---

## 🔑 API Keys Reference

| Key | Where to Get | Env Variable |
|---|---|---|
| MiniMax API Key | minimaxi.com → API | `MINIMAX_API_KEY` |
| Gemini API Key | aistudio.google.com | `GEMINI_API_KEY` |
| GitHub Client ID | GitHub OAuth App | `GITHUB_CLIENT_ID` |
| GitHub Client Secret | GitHub OAuth App | `GITHUB_CLIENT_SECRET` |

---

## ⚡ Quick Commands

```bash
# Start frontend
cd frontend && npm run dev

# Start backend
cd backend && node server.js

# Install all at once
cd frontend && npm install && cd ../backend && npm install
```

---

## 📌 Current Status
> Start here: **DAY 1 — Step 1.1 Initialize Projects**
