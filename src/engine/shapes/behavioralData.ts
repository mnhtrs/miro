import type {
  ShapeDefinition, StateTransitionParts, UMLActivityFlowData, UMLActivityNodeData, UMLActivityPartitionData,
  UMLStateBehaviorData, UMLStateCompositeData, UMLStatePointData, UMLStateRegion, UMLStateVertexData,
} from './types';

export const UML_STATE_ROOT_REGION_ID = 'region:root';
export const UML_STATE_FIRST_REGION_ID = (compositeId: string) => `region:${compositeId}:1`;

const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const boundedString = (value: unknown, limit = 2000): string | undefined =>
  typeof value === 'string' ? value.slice(0, limit) : undefined;
const STATE_POINT_IDS = new Set(['uml.entry-point', 'uml.exit-point', 'uml.shallow-history', 'uml.deep-history']);
const STATE_VERTEX_IDS = new Set([
  'uml.state', 'uml.composite-state', 'uml.initial-state', 'uml.final-state', 'uml.choice-junction',
  'uml.shallow-history', 'uml.deep-history', 'uml.entry-point', 'uml.exit-point', 'uml.fork',
]);
const ACTIVITY_NODE_IDS = new Set([
  'uml.initial-state', 'uml.final-state', 'uml.decision', 'uml.fork', 'uml.action', 'uml.object-node',
]);

export function isStatePointShape(shapeId: string): boolean { return STATE_POINT_IDS.has(shapeId); }
export function isStateVertexShape(shapeId: string): boolean { return STATE_VERTEX_IDS.has(shapeId); }
export function isActivityNodeShape(shapeId: string): boolean { return ACTIVITY_NODE_IDS.has(shapeId); }

function normalizeRegions(value: unknown, compositeId: string): UMLStateRegion[] {
  if (!Array.isArray(value)) return [{ id: UML_STATE_FIRST_REGION_ID(compositeId), name: 'Region 1', order: 0 }];
  return value.slice(0, 64).map((raw, index) => {
    const region = object(raw);
    return {
      // Preserve malformed/duplicate identifiers so graph diagnostics can report corruption.
      id: typeof region?.id === 'string' ? region.id.slice(0, 256) : '',
      name: typeof region?.name === 'string' ? region.name.slice(0, 200) : '',
      order: typeof region?.order === 'number' && Number.isFinite(region.order) ? Math.floor(region.order) : index,
    };
  });
}

export function normalizeStateDiagramData(
  definition: ShapeDefinition,
  recordId: string,
  input: Record<string, unknown>,
  context: string | undefined,
  containerId?: string,
): Record<string, unknown> {
  if (context !== 'state') return input;
  const data = { ...input };
  const rawVertex = object(data.stateVertex);
  if (isStateVertexShape(definition.id)) {
    const fallbackRegion = containerId ? UML_STATE_FIRST_REGION_ID(containerId) : UML_STATE_ROOT_REGION_ID;
    const vertex: UMLStateVertexData = {
      version: 1,
      vertexId: recordId,
      regionId: typeof rawVertex?.regionId === 'string' ? rawVertex.regionId.slice(0, 256) : fallbackRegion,
    };
    data.stateVertex = vertex;
  }

  if (definition.id === 'uml.state' || definition.id === 'uml.composite-state') {
    const rawBehavior = object(data.stateBehavior);
    const behavior: UMLStateBehaviorData = {
      version: 1,
      stateId: recordId,
      entry: boundedString(rawBehavior?.entry) ?? '',
      doActivity: boundedString(rawBehavior?.doActivity ?? rawBehavior?.do) ?? '',
      exit: boundedString(rawBehavior?.exit) ?? '',
    };
    data.stateBehavior = behavior;
  }

  if (definition.id === 'uml.composite-state') {
    const rawComposite = object(data.stateComposite);
    const composite: UMLStateCompositeData = {
      version: 1,
      stateId: recordId,
      regions: normalizeRegions(rawComposite?.regions, recordId),
    };
    data.stateComposite = composite;
  }

  if (isStatePointShape(definition.id)) {
    const rawPoint = object(data.statePoint);
    const side = ['north', 'east', 'south', 'west'].includes(String(rawPoint?.side)) ? rawPoint!.side as UMLStatePointData['side'] : undefined;
    const offset = typeof rawPoint?.offsetPermille === 'number' && Number.isFinite(rawPoint.offsetPermille)
      ? Math.max(0, Math.min(1000, Math.round(rawPoint.offsetPermille))) : undefined;
    const point: UMLStatePointData = {
      version: 1,
      pointId: recordId,
      ...(typeof rawPoint?.ownerStateId === 'string' ? { ownerStateId: rawPoint.ownerStateId.slice(0, 256) }
        : containerId ? { ownerStateId: containerId } : {}),
      ...(side ? { side } : {}),
      ...(offset !== undefined ? { offsetPermille: offset } : {}),
    };
    data.statePoint = point;
  }
  return data;
}

export function normalizeActivityDiagramData(
  definition: ShapeDefinition,
  recordId: string,
  input: Record<string, unknown>,
  context: string | undefined,
  containerId?: string,
  parentShapeId?: string,
): Record<string, unknown> {
  if (context !== 'activity') return input;
  const data = { ...input };
  if (definition.id === 'uml.activity-partition') {
    const raw = object(data.activityPartition);
    const orientation = typeof raw?.orientation === 'string'
      ? raw.orientation : 'vertical';
    const partition: UMLActivityPartitionData = {
      version: 1,
      partitionId: recordId,
      // Invalid stored strings are retained for ActivityPolicy to diagnose, not silently reset.
      orientation: orientation as UMLActivityPartitionData['orientation'],
    };
    data.activityPartition = partition;
  }
  if (isActivityNodeShape(definition.id)) {
    const raw = object(data.activityNode);
    const partitionId = parentShapeId === 'uml.activity-partition'
      ? containerId
      : typeof raw?.partitionId === 'string' && raw.partitionId.length <= 256 ? raw.partitionId : undefined;
    const node: UMLActivityNodeData = {
      version: 1,
      nodeId: recordId,
      ...(partitionId ? { partitionId } : {}),
    };
    data.activityNode = node;
  }
  return data;
}

export function normalizeStateTransitionData(value: unknown): StateTransitionParts | undefined {
  const raw = object(value);
  if (!raw) return undefined;
  const parts: StateTransitionParts = {
    ...(typeof raw.trigger === 'string' ? { trigger: raw.trigger.slice(0, 2000) } : {}),
    ...(typeof raw.guard === 'string' ? { guard: raw.guard.slice(0, 2000) } : {}),
    ...(typeof raw.effect === 'string' ? { effect: raw.effect.slice(0, 2000) } : {}),
    ...(typeof raw.regionId === 'string' ? { regionId: raw.regionId.slice(0, 256) } : {}),
  };
  return parts;
}

export function normalizeBehavioralDiagramData(
  definition: ShapeDefinition,
  recordId: string,
  input: Record<string, unknown>,
  context: string | undefined,
  containerId?: string,
  parentShapeId?: string,
): Record<string, unknown> {
  const state = normalizeStateDiagramData(definition, recordId, input, context, containerId);
  return normalizeActivityDiagramData(definition, recordId, state, context, containerId, parentShapeId);
}

export function normalizeActivityFlowData(value: unknown, shapeId: string): UMLActivityFlowData {
  const raw = object(value);
  const defaultKind = shapeId === 'uml.object-flow' ? 'object' : 'control';
  const kind = typeof raw?.kind === 'string' ? raw.kind : defaultKind;
  const guard = typeof raw?.guard === 'string' ? raw.guard.slice(0, 2000) : undefined;
  return { version: 1, kind: kind as UMLActivityFlowData['kind'], ...(guard !== undefined ? { guard } : {}) };
}
