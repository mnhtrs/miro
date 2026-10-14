import { getShapeDefinition } from './registry';
import type { BehavioralPolicyRecord } from './statePolicy';

export interface ActivityFlowRule {
  minIncoming?: number;
  maxIncoming?: number;
  minOutgoing?: number;
  maxOutgoing?: number;
}

export interface ActivityPolicyIssue {
  id: string;
  code: string;
  severity: 'incomplete' | 'invalid';
  family: 'activity';
  message: string;
  relatedIds: string[];
}

const ACTIVITY_NODE_IDS = new Set(['uml.initial-state', 'uml.final-state', 'uml.decision', 'uml.fork', 'uml.action', 'uml.object-node']);
const ACTIVITY_EDGE_IDS = new Set(['uml.activity-flow', 'uml.object-flow']);
const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const shapeId = (record: BehavioralPolicyRecord) => typeof record.shapeId === 'string' ? record.shapeId : '';
const contextOf = (record: BehavioralPolicyRecord): string | undefined => {
  if (typeof record.diagramContext === 'string') return record.diagramContext;
  const families = getShapeDefinition(shapeId(record))?.semantic?.diagramFamilies ?? [];
  return families.length === 1 ? families[0] : undefined;
};
const activityNodeData = (record: BehavioralPolicyRecord) => object(object(record.data)?.activityNode);
const partitionData = (record: BehavioralPolicyRecord) => object(object(record.data)?.activityPartition);
const flowData = (record: BehavioralPolicyRecord) => object(record.activityFlow);
const isActivityNode = (record: BehavioralPolicyRecord) => record.type === 'diagram'
  && ACTIVITY_NODE_IDS.has(shapeId(record)) && contextOf(record) === 'activity';
const isActivityEdge = (record: BehavioralPolicyRecord) => record.type === 'connector'
  && ACTIVITY_EDGE_IDS.has(shapeId(record)) && contextOf(record) === 'activity';

/** Activity-node topology and partition rules only; StatePolicy is intentionally independent. */
export const ActivityPolicy = Object.freeze({
  controlFlowShapeId: 'uml.activity-flow',
  objectFlowShapeId: 'uml.object-flow',
  flowRule(record: BehavioralPolicyRecord): ActivityFlowRule | undefined {
    const id = shapeId(record), role = record.behavioralRole;
    if (id === 'uml.initial-state') return { maxIncoming: 0, maxOutgoing: 1 };
    if (id === 'uml.final-state') return { minIncoming: 1, maxOutgoing: 0 };
    if (id === 'uml.decision') return role === 'merge'
      ? { minIncoming: 2, maxOutgoing: 1 } : { minIncoming: 1, maxIncoming: 1, minOutgoing: 2 };
    if (id === 'uml.fork') return role === 'join'
      ? { minIncoming: 2, maxOutgoing: 1 } : { maxIncoming: 1, minOutgoing: 2 };
    return undefined;
  },
  /** Merge/Fork/Decision degree counts include both flow kinds, but flow kind remains explicit on each edge. */
  diagnose(component: readonly BehavioralPolicyRecord[], byId: ReadonlyMap<string, BehavioralPolicyRecord>): ActivityPolicyIssue[] {
    const out: ActivityPolicyIssue[] = [];
    const push = (record: BehavioralPolicyRecord, code: string, severity: 'incomplete' | 'invalid', message: string, related: string[] = [record.id]) =>
      out.push({ id: record.id, code, severity, family: 'activity', message, relatedIds: [...new Set(related)] });
    const nodes = component.filter(isActivityNode);
    const edges = component.filter(isActivityEdge);
    if (!nodes.length && !edges.length) {
      // Partition-only components still need orientation/identity validation.
      for (const record of component) if (record.type === 'diagram' && shapeId(record) === 'uml.activity-partition'
        && contextOf(record) === 'activity') validatePartition(record, push);
      return out;
    }

    for (const record of component) {
      if (record.type !== 'diagram' || contextOf(record) !== 'activity') continue;
      if (shapeId(record) === 'uml.activity-partition') validatePartition(record, push);
      if (!ACTIVITY_NODE_IDS.has(shapeId(record))) continue;
      const metadata = activityNodeData(record);
      if (!metadata) push(record, 'missing-activity-node-data', 'incomplete', 'Activity Node ownership metadata is not initialized yet.');
      else if (metadata.nodeId !== record.id)
        push(record, 'activity-node-id-mismatch', 'invalid', 'Activity Node metadata must identify its owning symbol.');
      const parent = record.containerId ? byId.get(record.containerId) : undefined;
      if (parent && shapeId(parent) === 'uml.activity-partition') {
        const partition = partitionData(parent);
        if (!partition || metadata?.partitionId !== parent.id)
          push(record, 'activity-partition-owner-mismatch', metadata ? 'invalid' : 'incomplete',
            'Activity Node partition metadata must match its direct Activity Partition owner.', [record.id, parent.id]);
      } else if (metadata?.partitionId) {
        const partition = byId.get(String(metadata.partitionId));
        if (!partition || shapeId(partition) !== 'uml.activity-partition')
          push(record, 'missing-activity-partition', 'invalid', 'Activity Node refers to a missing or non-partition owner.', [record.id, String(metadata.partitionId)]);
        else if (record.containerId !== partition.id)
          push(record, 'non-direct-activity-partition-owner', 'invalid', 'Partition ownership must be a direct semantic containment edge.', [record.id, partition.id]);
      }
    }

    for (const edge of edges) {
      const flow = flowData(edge);
      const expectedKind = shapeId(edge) === 'uml.object-flow' ? 'object' : 'control';
      if (!flow) push(edge, 'missing-activity-flow-data', 'incomplete', 'Activity Flow kind and guard fields are not initialized yet.');
      else {
        if (flow.kind !== expectedKind)
          push(edge, 'activity-flow-kind-mismatch', 'invalid', 'Flow metadata kind must agree with the registered Control/Object Flow connector.', [edge.id]);
        if (flow.guard !== undefined && typeof flow.guard !== 'string')
          push(edge, 'invalid-activity-flow-guard', 'invalid', 'An Activity Flow guard must be text.', [edge.id]);
      }
      const source = edge.sourceRef?.shapeId ? byId.get(edge.sourceRef.shapeId) : undefined;
      const target = edge.targetRef?.shapeId ? byId.get(edge.targetRef.shapeId) : undefined;
      for (const endpoint of [source, target]) if (endpoint && contextOf(endpoint) && contextOf(endpoint) !== 'activity')
        push(edge, 'activity-flow-context-mismatch', 'invalid', 'An Activity Flow cannot attach to a State-only vertex.', [edge.id, endpoint.id]);
      // Cross-partition flows are valid; node ownership is deliberately not compared here.
    }

    for (const node of nodes) {
      const rule = ActivityPolicy.flowRule(node);
      if (!rule) continue;
      const incomingEdges = edges.filter(edge => edge.targetRef?.shapeId === node.id);
      const outgoingEdges = edges.filter(edge => edge.sourceRef?.shapeId === node.id);
      const addDegree = (side: 'incoming' | 'outgoing', count: number, minimum?: number, maximum?: number) => {
        if (minimum !== undefined && count < minimum)
          push(node, `incomplete-activity-${side}-degree`, 'incomplete',
            `${node.behavioralRole ?? shapeId(node)} needs at least ${minimum} incoming/outgoing Activity Flow(s) as applicable (currently ${count}).`);
        if (maximum !== undefined && count > maximum)
          push(node, `invalid-activity-${side}-degree`, 'invalid',
            `${node.behavioralRole ?? shapeId(node)} allows at most ${maximum} ${side} Activity Flow(s) (currently ${count}).`);
      };
      addDegree('incoming', incomingEdges.length, rule.minIncoming, rule.maxIncoming);
      addDegree('outgoing', outgoingEdges.length, rule.minOutgoing, rule.maxOutgoing);
      if (shapeId(node) === 'uml.decision' && node.behavioralRole !== 'merge') {
        for (const edge of outgoingEdges) {
          const flow = flowData(edge);
          if (shapeId(edge) === 'uml.activity-flow' && typeof flow?.guard === 'string' && flow.guard.trim()) continue;
          push(edge, 'missing-decision-guard', 'incomplete', 'Each outgoing Decision Control Flow needs an explicit guard or branch condition.', [node.id, edge.id]);
        }
      }
    }
    return out;
  },
});

function validatePartition(
  record: BehavioralPolicyRecord,
  push: (record: BehavioralPolicyRecord, code: string, severity: 'incomplete' | 'invalid', message: string, related?: string[]) => void,
) {
  const metadata = partitionData(record);
  if (!metadata) {
    push(record, 'missing-activity-partition-data', 'incomplete', 'Activity Partition orientation and identity are not initialized yet.');
    return;
  }
  if (metadata.partitionId !== record.id)
    push(record, 'activity-partition-id-mismatch', 'invalid', 'Activity Partition metadata must identify its owning lane.');
  if (!['vertical', 'horizontal'].includes(String(metadata.orientation)))
    push(record, 'invalid-activity-partition-orientation', 'invalid', 'Partition orientation must be vertical or horizontal.');
}
