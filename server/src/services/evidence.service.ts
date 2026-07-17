import path from 'path';

export interface EvidenceTrace {
  route: string;
  controller: string | null;
  service: string | null;
  model: string | null;
  pathString: string;
}

export class EvidenceService {
  private isRouteFile(filePath: string): boolean {
    const normalized = filePath.toLowerCase().replace(/\\/g, '/');
    return (
      normalized.includes('/routes/') ||
      normalized.includes('/route/') ||
      normalized.includes('.routes.') ||
      normalized.includes('.route.') ||
      normalized.includes('routing')
    );
  }

  private isControllerFile(filePath: string): boolean {
    const normalized = filePath.toLowerCase().replace(/\\/g, '/');
    return (
      normalized.includes('/controllers/') ||
      normalized.includes('/controller/') ||
      normalized.includes('.controller.') ||
      normalized.includes('.controllers.')
    );
  }

  private isServiceFile(filePath: string): boolean {
    const normalized = filePath.toLowerCase().replace(/\\/g, '/');
    return (
      normalized.includes('/services/') ||
      normalized.includes('/service/') ||
      normalized.includes('.service.') ||
      normalized.includes('.services.')
    );
  }

  private isModelFile(filePath: string): boolean {
    const normalized = filePath.toLowerCase().replace(/\\/g, '/');
    return (
      normalized.includes('/models/') ||
      normalized.includes('/model/') ||
      normalized.includes('.model.') ||
      normalized.includes('prisma/schema.prisma')
    );
  }

  /**
   * Generates deterministic evidence trace paths: Route -> Controller -> Service -> Model
   */
  generateEvidenceTraces(
    scannedFiles: Array<{ path: string }>,
    dependencyGraph: Record<string, string[]>
  ): EvidenceTrace[] {
    const traces: EvidenceTrace[] = [];
    const routeFiles = scannedFiles.filter(f => this.isRouteFile(f.path));

    for (const route of routeFiles) {
      const routeDeps = dependencyGraph[route.path] || [];
      const controllers = routeDeps.filter(dep => this.isControllerFile(dep));

      if (controllers.length > 0) {
        for (const ctrl of controllers) {
          const ctrlDeps = dependencyGraph[ctrl] || [];
          const services = ctrlDeps.filter(dep => this.isServiceFile(dep));

          if (services.length > 0) {
            for (const svc of services) {
              const svcDeps = dependencyGraph[svc] || [];
              const models = svcDeps.filter(dep => this.isModelFile(dep));

              if (models.length > 0) {
                for (const model of models) {
                  traces.push(this.createTrace(route.path, ctrl, svc, model));
                }
              } else {
                traces.push(this.createTrace(route.path, ctrl, svc, null));
              }
            }
          } else {
            traces.push(this.createTrace(route.path, ctrl, null, null));
          }
        }
      } else {
        traces.push(this.createTrace(route.path, null, null, null));
      }
    }

    return traces;
  }

  private createTrace(
    route: string,
    controller: string | null,
    service: string | null,
    model: string | null
  ): EvidenceTrace {
    const parts = [
      `[${route}]`,
      controller ? ` ➔ [${controller}]` : '',
      service ? ` ➔ [${service}]` : '',
      model ? ` ➔ [${model}]` : ''
    ];
    return {
      route,
      controller,
      service,
      model,
      pathString: parts.filter(Boolean).join('')
    };
  }
}

export const evidenceService = new EvidenceService();
export default evidenceService;
