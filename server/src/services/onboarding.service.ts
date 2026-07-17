export interface OnboardingGuide {
  prerequisites: string[];
  setupCommands: string[];
  databaseMigrationSteps: string[];
  runCommands: string[];
  troubleshootingTips: string[];
}

export class OnboardingService {
  /**
   * Generates step-by-step developer onboarding guides based on repository profile.
   */
  generateOnboardingGuide(
    framework: string,
    languages: Record<string, number>,
    dependencies: string[]
  ): OnboardingGuide {
    const prerequisites: string[] = ['Node.js (v18 or higher)', 'npm or yarn package manager'];
    const setupCommands: string[] = ['npm install'];
    const databaseMigrationSteps: string[] = [];
    const runCommands: string[] = [];
    const troubleshootingTips: string[] = [
      'Ensure you copy `.env.example` to a new `.env` file before running the application.',
      'Check that all required environment variables are set correctly.'
    ];

    const fwLower = framework.toLowerCase();
    
    // Check framework-specific setup/run
    if (fwLower.includes('next')) {
      runCommands.push('npm run dev (Starts Next.js local development server)');
      runCommands.push('npm run build (Compiles Next.js production build)');
    } else if (fwLower.includes('express')) {
      runCommands.push('npm run dev or npm start (Starts Express.js server)');
    } else {
      runCommands.push('npm run dev or node src/server.js');
    }

    // Check database-specific steps
    const hasPrisma = dependencies.some(dep => dep.toLowerCase().includes('prisma'));
    if (hasPrisma) {
      prerequisites.push('PostgreSQL, SQLite, or MySQL database instance running');
      databaseMigrationSteps.push('npx prisma generate (Generates Prisma client ORM types)');
      databaseMigrationSteps.push('npx prisma db push or npx prisma migrate dev (Applies migrations to database)');
      troubleshootingTips.push('If Prisma fails to connect, verify the DATABASE_URL environment variable in your .env file.');
    }

    return {
      prerequisites,
      setupCommands,
      databaseMigrationSteps,
      runCommands,
      troubleshootingTips
    };
  }
}

export const onboardingService = new OnboardingService();
export default onboardingService;
