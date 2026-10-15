import type {
  ShapeDefinition, UMLExtendRelationshipData, UMLExtensionPoint, UMLSubjectBoundaryData, UMLUseCaseData,
} from './types';

const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const boundedString = (value: unknown, limit = 2000): string | undefined =>
  typeof value === 'string' ? value.slice(0, limit) : undefined;

export function createExtensionPoint(name = 'extension point', explanation = ''): UMLExtensionPoint {
  return {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'extension point',
    ...(explanation.trim() ? { explanation: explanation.trim() } : {}),
  };
}

export function normalizeExtensionPoints(value: unknown): UMLExtensionPoint[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 32).map((item, index) => {
    const raw = object(item);
    return {
      id: typeof raw?.id === 'string' && raw.id ? raw.id.slice(0, 128) : `ep-${index + 1}`,
      name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 200) : `point_${index + 1}`,
      ...(typeof raw?.explanation === 'string' && raw.explanation.trim()
        ? { explanation: raw.explanation.trim().slice(0, 500) } : {}),
    };
  });
}

export function normalizeUseCaseDiagramData(
  definition: ShapeDefinition,
  input: Record<string, unknown>,
  context?: string | undefined,
): Record<string, unknown> {
  if (context && context !== 'use-case') return input;
  const data = { ...input };

  if (definition.id === 'uml.use-case' || definition.id === 'uml.use-case-ext') {
    const rawUseCase = object(data.usecase);
    const extensionPoints = normalizeExtensionPoints(rawUseCase?.extensionPoints);
    const stereotype = boundedString(rawUseCase?.stereotype, 120);
    const isBusinessUseCase = rawUseCase?.isBusinessUseCase === true
      || (typeof stereotype === 'string' && stereotype.toLowerCase().includes('business'));

    const usecase: UMLUseCaseData = {
      version: 1,
      ...(stereotype ? { stereotype } : {}),
      ...(extensionPoints.length ? { extensionPoints } : {}),
      ...(isBusinessUseCase ? { isBusinessUseCase: true } : {}),
    };
    data.usecase = usecase;
  }

  if (definition.id === 'uml.system-boundary') {
    const rawBoundary = object(data.subjectBoundary);
    const stereotype = boundedString(rawBoundary?.stereotype, 120);
    const subjectBoundary: UMLSubjectBoundaryData = {
      version: 1,
      ...(stereotype ? { stereotype } : {}),
    };
    data.subjectBoundary = subjectBoundary;
  }

  return data;
}

export function normalizeExtendRelationshipData(value: unknown): UMLExtendRelationshipData {
  const raw = object(value);
  const condition = boundedString(raw?.condition, 500);
  const extensionPoint = boundedString(raw?.extensionPoint, 200);

  return {
    version: 1,
    ...(condition && condition.trim() ? { condition: condition.trim() } : {}),
    ...(extensionPoint && extensionPoint.trim() ? { extensionPoint: extensionPoint.trim() } : {}),
  };
}
