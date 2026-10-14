import { getShapeDefinition } from './registry';
import { UML_STATE_ROOT_REGION_ID } from './behavioralData';

export interface BehavioralPolicyRecord extends Record<string, unknown> {
  id: string;
  type: string;
  shapeId?: string;
  diagramContext?: string;
  containerId?: string;
  sourceRef?: { shapeId?: string; pointId?: string };
  targetRef?: { shapeId?: string; pointId?: string };
  behavioralRole?: string;
  data?: Record<string, unknown>;
  stateTransition?: Record<string, unknown>;
}

export interface BehavioralPolicyIssue {
  id: string;
  code: string;
  severity: 'incomplete' | 'invalid';
  family: 'state';
  message: string;
  relatedIds: string[];
}

const STATE_EDGE = 'uml.state-transition';
const STATE_POINT_IDS = new Set(['uml.entry-point', 'uml.exit-point', 'uml.shallow-history', 'uml.deep-history']);
const STATE_VERTEX_IDS = new Set([
  'uml.state', 'uml.composite-state', 'uml.initial-state', 'uml.final-state', 'uml.choice-junction',
  'uml.shallow-history', 'uml.deep-history', 'uml.entry-point', 'uml.exit-point', 'uml.fork',
]);
const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const shapeId = (record: BehavioralPolicyRecord) => typeof record.shapeId === 'string' ? record.shapeId : '';
const contextOf = (record: BehavioralPolicyRecord): string | undefined => {
  if (typeof record.diagramContext === 'string') return record.diagramContext;
  const families = getShapeDefinition(shapeId(record))?.semantic?.diagramFamilies ?? [];
  return families.length === 1 ? families[0] : undefined;
};
const stateVertexData = (record: BehavioralPolicyRecord) => object(object(record.data)?.stateVertex);
const statePointData = (record: BehavioralPolicyRecord) => object(object(record.data)?.statePoint);
const stateCompositeData = (record: BehavioralPolicyRecord) => object(object(record.data)?.stateComposite);
const stateBehaviorData = (record: BehavioralPolicyRecord) => object(object(record.data)?.stateBehavior);
const isStateVertex = (record: BehavioralPolicyRecord) => record.type === 'diagram' && STATE_VERTEX_IDS.has(shapeId(record)) && contextOf(record) === 'state';
const isStateEdge = (record: BehavioralPolicyRecord) => record.type === 'connector' && shapeId(record) === STATE_EDGE && contextOf(record) === 'state';

export interface StateFlowRule {
  minIncoming?: number;
  maxIncoming?: number;
  minOutgoing?: number;
  maxOutgoing?: number;
}

/** State-machine topology only. Activity flow/node semantics intentionally live in ActivityPolicy. */
export const StatePolicy = Object.freeze({
  edgeShapeId: STATE_EDGE,
  rootRegionId: UML_STATE_ROOT_REGION_ID,
  flowRule(record: BehavioralPolicyRecord): StateFlowRule | undefined {
    const id = shapeId(record), role = record.behavioralRole;
    if (id === 'uml.initial-state') return { maxIncoming: 0, maxOutgoing: 1 };
    if (id === 'uml.final-state') return { minIncoming: 1, maxOutgoing: 0 };
    if (id === 'uml.choice-junction') return role === 'junction'
      ? { minIncoming: 2, maxOutgoing: 1 } : { minIncoming: 1, maxIncoming: 1, minOutgoing: 2 };
    if (id === 'uml.fork') return role === 'join'
      ? { minIncoming: 2, maxOutgoing: 1 } : { maxIncoming: 1, minOutgoing: 2 };
    if (id === 'uml.shallow-history' || id === 'uml.deep-history') return { minIncoming: 1, maxIncoming: 1, minOutgoing: 1, maxOutgoing: 1 };
    if (id === 'uml.entry-point') return { minOutgoing: 1 };
    if (id === 'uml.exit-point') return { minIncoming: 1, minOutgoing: 1 };
    return undefined;
  },
  diagnose(component: readonly BehavioralPolicyRecord[], byId: ReadonlyMap<string, BehavioralPolicyRecord>): BehavioralPolicyIssue[] {
    const out: BehavioralPolicyIssue[] = [];
    const push = (record: BehavioralPolicyRecord, code: string, severity: 'incomplete' | 'invalid', message: string, related: string[] = [record.id]) =>
      out.push({ id: record.id, code, severity, family: 'state', message, relatedIds: [...new Set(related)] });
    const vertices = component.filter(isStateVertex);
    const edges = component.filter(isStateEdge);
    if (!vertices.length && !edges.length) return out;

    const composites = new Map<string, { record: BehavioralPolicyRecord; regions: Array<Record<string, unknown>> }>();
    for (const record of vertices) {
      const id = shapeId(record);
      const vertex = stateVertexData(record);
      if (!vertex) {
        push(record, 'missing-state-vertex-data', 'incomplete', 'State vertex identity and region membership are not initialized yet.');
      } else {
        if (vertex.vertexId !== record.id)
          push(record, 'state-vertex-id-mismatch', 'invalid', 'State vertex metadata must identify its owning UML symbol.');
        if (typeof vertex.regionId !== 'string' || !vertex.regionId.trim())
          push(record, 'missing-state-region-membership', 'invalid', 'Every State vertex must name its root or owning composite region.');
      }

      if (record.containerId) {
        const parent = byId.get(record.containerId);
        if (!parent || shapeId(parent) !== 'uml.composite-state') {
          push(record, 'invalid-state-owner', 'invalid', 'A nested State vertex must be owned by a composite state.', [record.id, record.containerId]);
        } else {
          const regions = stateCompositeData(parent)?.regions;
          const regionId = vertex?.regionId;
          if (!Array.isArray(regions)) push(parent, 'missing-state-regions', 'incomplete', 'The composite state has no explicit region list.', [parent.id]);
          else if (typeof regionId === 'string' && !regions.some(region => object(region)?.id === regionId))
            push(record, 'unknown-state-region', 'invalid', 'The vertex region does not belong to its owning composite state.', [record.id, parent.id]);
        }
      } else if (vertex?.regionId !== UML_STATE_ROOT_REGION_ID) {
        push(record, 'orphaned-state-region', 'invalid', 'A top-level State vertex must belong to the root region.', [record.id]);
      }

      if (id === 'uml.state' || id === 'uml.composite-state') {
        const behavior = stateBehaviorData(record);
        if (!behavior) push(record, 'missing-state-behavior', 'incomplete', 'State entry, do-activity, and exit fields are not initialized yet.');
        else if (behavior.stateId !== record.id || ['entry', 'doActivity', 'exit'].some(key => typeof behavior[key] !== 'string'))
          push(record, 'invalid-state-behavior', 'invalid', 'Structured State behavior must have a matching owner and string-valued entry/do/exit fields.');
      }

      if (id === 'uml.composite-state') {
        const composite = stateCompositeData(record);
        const regions = composite?.regions;
        if (!composite) push(record, 'missing-state-regions', 'incomplete', 'Composite State has no explicit region data.');
        else if (composite.stateId !== record.id || !Array.isArray(regions))
          push(record, 'invalid-state-composite-owner', 'invalid', 'Composite State region data must identify its owner and contain a region list.');
        if (Array.isArray(regions)) {
          if (!regions.length) push(record, 'empty-composite-state', 'invalid', 'A composite State must contain at least one region.');
          const seen = new Set<string>();
          regions.forEach((rawRegion, index) => {
            const region = object(rawRegion), regionId = typeof region?.id === 'string' ? region.id : '';
            if (!regionId.trim()) push(record, 'missing-state-region-id', 'invalid', 'Each composite region needs a stable non-empty ID.');
            if (seen.has(regionId)) push(record, 'duplicate-state-region-id', 'invalid', 'Region IDs must be unique within their composite State.');
            seen.add(regionId);
            if (typeof region?.name !== 'string' || !region.name.trim())
              push(record, 'missing-state-region-name', 'incomplete', 'Name each State region so parallel behavior is distinguishable.');
            if (region?.order !== index) push(record, 'unstable-state-region-order', 'invalid', 'Region order must be a contiguous zero-based sequence.');
          });
          composites.set(record.id, { record, regions: regions.filter((item): item is Record<string, unknown> => Boolean(object(item))) as Array<Record<string, unknown>> });
        }
      }

      if (STATE_POINT_IDS.has(id)) {
        const point = statePointData(record);
        if (!point) push(record, 'missing-state-point-owner', 'incomplete', 'History and Entry/Exit points need explicit owner metadata.');
        else {
          if (point.pointId !== record.id) push(record, 'state-point-id-mismatch', 'invalid', 'State point metadata must identify its owning pseudostate.');
          if (!record.containerId || point.ownerStateId !== record.containerId)
            push(record, 'state-point-owner-mismatch', record.containerId ? 'invalid' : 'incomplete',
              'History and Entry/Exit points must be owned by their composite State.', record.containerId ? [record.id, record.containerId] : [record.id]);
          const owner = record.containerId ? byId.get(record.containerId) : undefined;
          if (record.containerId && shapeId(owner ?? ({} as BehavioralPolicyRecord)) !== 'uml.composite-state')
            push(record, 'invalid-state-point-owner', 'invalid', 'State point ownership must reference a composite State.', [record.id, record.containerId]);
          if (id === 'uml.entry-point' || id === 'uml.exit-point') {
            if (!['north', 'east', 'south', 'west'].includes(String(point.side))
              || typeof point.offsetPermille !== 'number' || !Number.isFinite(point.offsetPermille))
              push(record, 'unanchored-state-point', 'incomplete', 'Attach the Entry/Exit point to a composite boundary side and position.');
          }
        }
      }
    }

    for (const edge of edges) {
      const transition = object(edge.stateTransition);
      if (!transition) push(edge, 'missing-state-transition-data', 'incomplete', 'Transition trigger, guard, and effect are represented as structured data.');
      const source = edge.sourceRef?.shapeId ? byId.get(edge.sourceRef.shapeId) : undefined;
      const target = edge.targetRef?.shapeId ? byId.get(edge.targetRef.shapeId) : undefined;
      if (source && target && isStateVertex(source) && isStateVertex(target)) {
        const sourceRegion = stateVertexData(source)?.regionId, targetRegion = stateVertexData(target)?.regionId;
        const boundaryTransition = ['uml.entry-point', 'uml.exit-point'].includes(shapeId(source))
          || ['uml.entry-point', 'uml.exit-point'].includes(shapeId(target));
        if (sourceRegion && targetRegion && sourceRegion !== targetRegion && !boundaryTransition)
          push(edge, 'cross-region-transition-without-boundary-point', 'invalid', 'Transitions between State regions must use an owned Entry or Exit point.', [edge.id, source.id, target.id]);
        if (sourceRegion && sourceRegion === targetRegion) {
          if (typeof transition?.regionId !== 'string')
            push(edge, 'missing-transition-region', 'incomplete', 'The transition has not latched its owning State Region yet.', [edge.id, source.id, target.id]);
          else if (transition.regionId !== sourceRegion)
            push(edge, 'transition-region-mismatch', 'invalid', 'Transition region metadata disagrees with its endpoint vertices.', [edge.id, source.id, target.id]);
        }
      }
      if (source && contextOf(source) && contextOf(source) !== 'state' || target && contextOf(target) && contextOf(target) !== 'state')
        push(edge, 'state-transition-context-mismatch', 'invalid', 'A State Transition cannot attach to an Activity-only vertex.', [edge.id, ...(source ? [source.id] : []), ...(target ? [target.id] : [])]);
    }

    const rootVertices = vertices.filter(record => !record.containerId);
    const regionGroups = new Map<string, BehavioralPolicyRecord[]>();
    const addRegionGroup = (regionId: string, nodes: BehavioralPolicyRecord[]) => regionGroups.set(regionId, nodes);
    if (rootVertices.length) addRegionGroup(UML_STATE_ROOT_REGION_ID, rootVertices);
    for (const { regions } of composites.values()) for (const region of regions) {
      if (typeof region.id === 'string') {
        const nodes = vertices.filter(vertex => vertex.containerId === composites.get(vertex.containerId ?? '')?.record.id
          && stateVertexData(vertex)?.regionId === region.id);
        addRegionGroup(region.id, nodes);
      }
    }

    for (const [, nodes] of regionGroups) {
      const initialNodes = nodes.filter(node => shapeId(node) === 'uml.initial-state');
      if (!initialNodes.length) {
        const owner = composites.get(nodes[0]?.containerId ?? '')?.record;
        push(owner ?? nodes[0] ?? component[0], 'missing-region-initial', 'incomplete', 'Each active State Region needs one Initial pseudostate.', owner ? [owner.id] : [nodes[0]?.id ?? '']);
      } else if (initialNodes.length > 1) {
        initialNodes.forEach(node => push(node, 'multiple-region-initials', 'invalid', 'A State Region has at most one Initial pseudostate.', initialNodes.map(item => item.id)));
      }
      if (!nodes.length) continue;
      const start = initialNodes[0];
      if (!start) continue;
      const reached = new Set<string>([start.id]);
      const queue = [start.id];
      while (queue.length) {
        const id = queue.shift()!;
        for (const edge of edges) {
          if (edge.sourceRef?.shapeId !== id || !edge.targetRef?.shapeId) continue;
          const target = byId.get(edge.targetRef.shapeId);
          if (!target || !nodes.some(node => node.id === target.id)) continue;
          if (['uml.entry-point', 'uml.exit-point'].includes(shapeId(target))) continue;
          if (!reached.has(target.id)) { reached.add(target.id); queue.push(target.id); }
        }
      }
      for (const node of nodes) {
        if (['uml.entry-point', 'uml.exit-point'].includes(shapeId(node))) continue;
        if (!reached.has(node.id)) push(node, 'unreachable-state-vertex', 'incomplete', 'This vertex is not reachable from the region Initial pseudostate.', [node.id, start.id]);
      }
    }

    for (const node of vertices) {
      const rule = StatePolicy.flowRule(node);
      if (!rule) continue;
      const incoming = edges.filter(edge => edge.targetRef?.shapeId === node.id).length;
      const outgoing = edges.filter(edge => edge.sourceRef?.shapeId === node.id).length;
      const owner = node.containerId ? byId.get(node.containerId) : undefined;
      const pushDegree = (side: 'incoming' | 'outgoing', count: number, minimum?: number, maximum?: number) => {
        if (minimum !== undefined && count < minimum) push(node, `incomplete-state-${side}-degree`, 'incomplete',
          `${shapeId(node)} needs at least ${minimum} ${side} transition(s) (currently ${count}).`, owner ? [node.id, owner.id] : [node.id]);
        if (maximum !== undefined && count > maximum) push(node, `invalid-state-${side}-degree`, 'invalid',
          `${shapeId(node)} allows at most ${maximum} ${side} transition(s) (currently ${count}).`);
      };
      pushDegree('incoming', incoming, rule.minIncoming, rule.maxIncoming);
      pushDegree('outgoing', outgoing, rule.minOutgoing, rule.maxOutgoing);
    }

    return out;
  },
});
