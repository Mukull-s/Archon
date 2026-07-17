export interface RepositoryStory {
  domain: string;
  architectureType: string;
  executionFlowStory: string;
  coreHotspots: string[];
}

export class StoryService {
  /**
   * Generates a structural narrative story for the repository.
   */
  generateStory(
    repoName: string,
    framework: string,
    languages: Record<string, number>,
    entryPoints: string[],
    dependencyGraph: Record<string, string[]>,
    hotspots: string[]
  ): RepositoryStory {
    // 1. Determine domain and architecture type
    const langNames = Object.keys(languages);
    let domain = 'General Application Service';
    let architectureType = 'Monolithic Layered Architecture';

    const lowerName = repoName.toLowerCase();
    if (lowerName.includes('portfolio')) {
      domain = 'Personal Portfolio and Showcase Application';
    } else if (lowerName.includes('bolo') || lowerName.includes('bharat') || lowerName.includes('tts')) {
      domain = 'Speech Synthesis and Translation Service / Interface';
    } else if (lowerName.includes('shop') || lowerName.includes('cart') || lowerName.includes('commerce')) {
      domain = 'E-Commerce Platform Service';
    } else if (lowerName.includes('auth') || lowerName.includes('identity')) {
      domain = 'Authentication and Identity Provider Service';
    }

    if (framework.toLowerCase().includes('next')) {
      architectureType = 'Next.js App Router (React Server Components + API Routes)';
    } else if (framework.toLowerCase().includes('express')) {
      architectureType = 'Express.js MVC / Router-Controller-Service Architecture';
    } else if (langNames.includes('TypeScript') || langNames.includes('JavaScript')) {
      architectureType = 'JavaScript/TypeScript Service Layer Architecture';
    }

    // 2. Draft the execution flow story
    let executionFlowStory = `In this repository, when a request hits the application:\n`;
    if (entryPoints.length > 0) {
      executionFlowStory += `1. Execution starts at the entry point: \`${entryPoints[0]}\`.\n`;
    } else {
      executionFlowStory += `1. Execution initializes through standard framework routing.\n`;
    }

    executionFlowStory += `2. Requests propagate down to logical controller layers which process user inputs and apply validations.\n`;
    executionFlowStory += `3. Business logic is executed within service layers which coordinate model queries.\n`;
    executionFlowStory += `4. Data persistence operations are handled by the database engine (e.g. Prisma or raw database clients).\n`;

    return {
      domain,
      architectureType,
      executionFlowStory,
      coreHotspots: hotspots.slice(0, 5)
    };
  }
}

export const storyService = new StoryService();
export default storyService;
