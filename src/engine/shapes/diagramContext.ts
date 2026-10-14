import { connectionPointById } from './model';
import { getShapeDefinition, getShapeDefinitionForLegacyType } from './registry';
import { ActivityPolicy } from './activityPolicy';
import { StatePolicy, type BehavioralPolicyRecord } from './statePolicy';
import { connectorEndpointPairAllowed, connectorEndpointSideAllowed, containerAcceptsSemanticChild } from './semantics';
import { isMultiOperandOperator, isSequenceFragmentOperator } from './sequence';
import { UML_FOUNDATION_SCHEMA_VERSION } from './types';
import type {
  DiagramContextId, DiagramNotationCapabilities, EndpointSide, SequenceFragmentOperator, ShapeDefinition, UMLDiagramFamily,
} from './types';

export { UML_FOUNDATION_SCHEMA_VERSION };

export const UML_FAMILY_LABELS: Readonly<Record<UMLDiagramFamily, string>> = Object.freeze({
  'use-case': 'Use Case', class: 'Class', sequence: 'Sequence', state: 'State', activity: 'Activity',
});

export function umlFamilyForCategory(category: string): UMLDiagramFamily | null {
  if (category === 'Use Case Diagram') return 'use-case';
  if (category === 'Class Diagram') return 'class';
  if (category === 'Sequence Diagram') return 'sequence';
  if (category === 'State Diagram') return 'state';
  if (category === 'Activity Diagram') return 'activity';
  return null;
}

function defaultTypographyRole(definition: ShapeDefinition): NonNullable<DiagramNotationCapabilities['text']>['role'] {
  const family = definition.semantic?.family ?? '';
  if (family === 'uml.actor') return 'actor';
  if (family === 'uml.use-case') return 'use-case';
  if (family === 'uml.classifier' || family === 'uml.instance') return 'classifier';
  if (family === 'uml.sequence-participant') return definition.id === 'uml.sequence-actor' || definition.id === 'uml.lifeline'
    ? 'sequence-participant' : 'sequence-object';
  if (family === 'uml.sequence-frame' || family.endsWith('.container') || family.endsWith('.frame')) return 'container-title';
  if (family === 'uml.state-vertex') return 'state';
  if (family === 'uml.activity-node') return definition.id === 'uml.object-node' ? 'object-node' : 'activity-action';
  if (family === 'uml.activity-container') return 'partition-title';
  return 'pseudostate';
}

/** Resolve all generic UML affordances from one semantic metadata record. */
export function diagramCapabilitiesFor(
  definition: ShapeDefinition | undefined, context?: UMLDiagramFamily | null,
): Required<Pick<DiagramNotationCapabilities, 'transform' | 'style' | 'text'>> & Pick<DiagramNotationCapabilities, 'connector'> {
  const uml = definition?.semantic?.notation === 'uml';
  const resizeMode = definition?.resizePolicy?.mode;
  const aspectLocked = resizeMode === 'aspect' || Boolean(definition?.aspectLocked);
  const shapeTransform = {
    resize: true,
    resizeX: resizeMode !== 'vertical',
    resizeY: resizeMode !== 'horizontal',
    ...(aspectLocked ? { aspectLocked: true, aspectRatio: resizeMode === 'aspect'
      ? definition?.resizePolicy?.mode === 'aspect' ? definition.resizePolicy.aspectRatio : 1 : 1 } : {}),
    fixedSize: false,
    rotate: true,
  };
  const shapeDefaults: Required<Pick<DiagramNotationCapabilities, 'transform' | 'style' | 'text'>> = {
    transform: shapeTransform,
    style: { fill: true, stroke: true, strokeWidth: true, textColor: true, fontSize: true },
    text: { editable: true, autoGrow: true, minFontSize: 12, role: definition ? defaultTypographyRole(definition) : 'state' },
  };
  const connectorDefaults: Required<Pick<DiagramNotationCapabilities, 'transform' | 'style' | 'text'>> & Pick<DiagramNotationCapabilities, 'connector'> = {
    transform: { resize: false, resizeX: false, resizeY: false, fixedSize: true, rotate: false },
    style: { fill: false, stroke: true, strokeWidth: true, textColor: false, fontSize: false },
    text: { editable: false, autoGrow: false, minFontSize: 12, role: 'connector-label' },
    connector: { labelMode: 'plain', lineStyleEditable: false, markersEditable: false,
      cardinalityEditable: false, routeEditable: true, labelPositionEditable: true },
  };
  if (!definition || !uml) return definition?.kind === 'connector'
    ? { ...connectorDefaults, transform: { ...connectorDefaults.transform, rotate: true },
      connector: { labelMode: 'plain', lineStyleEditable: true, markersEditable: true,
        cardinalityEditable: true, routeEditable: true, labelPositionEditable: true } }
    : shapeDefaults;
  const base = definition.kind === 'connector' ? connectorDefaults : shapeDefaults;
  const overrides = definition.semantic?.capabilities;
  const contextOverrides = context && (definition.semantic?.diagramFamilies ?? []).includes(context)
    ? definition.semantic?.contextCapabilities?.[context] : undefined;
  const transform = { ...base.transform, ...overrides?.transform, ...contextOverrides?.transform };
  if (!transform.resize) transform.fixedSize ??= true;
  return {
    transform,
    style: { ...base.style, ...overrides?.style, ...contextOverrides?.style },
    text: { ...base.text, ...overrides?.text, ...contextOverrides?.text },
    ...(definition.kind === 'connector' ? {
      connector: { ...connectorDefaults.connector, ...overrides?.connector, ...contextOverrides?.connector },
    } : {}),
  };
}

export function familyForDefinition(definition: ShapeDefinition | undefined): readonly UMLDiagramFamily[] {
  return definition?.semantic?.notation === 'uml' ? definition.semantic.diagramFamilies ?? [] : [];
}

export function contextForDefinition(
  definition: ShapeDefinition | undefined,
  requested?: UMLDiagramFamily | null,
): UMLDiagramFamily | undefined {
  const families = familyForDefinition(definition);
  if (requested && families.includes(requested)) return requested;
  return families.length === 1 ? families[0] : undefined;
}

/** Resolve a shared connector's family from its explicit context or its endpoint roles. */
export function contextForConnector(
  definition: ShapeDefinition | undefined,
  source: ShapeDefinition | undefined,
  target: ShapeDefinition | undefined,
  requested?: UMLDiagramFamily | null,
): UMLDiagramFamily | undefined {
  const explicit = contextForDefinition(definition, requested);
  if (explicit) return explicit;
  const families = familyForDefinition(definition);
  const sourceFamilies = familyForDefinition(source), targetFamilies = familyForDefinition(target);
  const compatible = families.filter(family => (!source || sourceFamilies.includes(family))
    && (!target || targetFamilies.includes(family)));
  return compatible.length === 1 ? compatible[0] : undefined;
}

export interface DiagramGraphDiagnostic {
  id: string;
  code: string;
  severity: 'incomplete' | 'invalid';
  family?: UMLDiagramFamily;
  message: string;
  relatedIds: string[];
}

export interface EndpointReferenceStatus {
  status: 'connected' | 'dangling' | 'invalid';
  reason?: string;
  point?: { id: string; x: number; y: number; kind: string };
}

type BoardRecord = Record<string, unknown> & { id: string; type: string };
type ConnectorRecord = BoardRecord & {
  shapeId: string;
  sourceRef?: { shapeId: string; pointId: string; kind?: string };
  targetRef?: { shapeId: string; pointId: string; kind?: string };
  invalidEndpointRefs?: Partial<Record<EndpointSide, string>>;
  containerId?: string;
  diagramContext?: UMLDiagramFamily;
};

function definitionForRecord(record: BoardRecord | undefined): ShapeDefinition | undefined {
  if (!record) return undefined;
  if ((record.type === 'diagram' || record.type === 'connector') && typeof record.shapeId === 'string')
    return getShapeDefinition(record.shapeId);
  return getShapeDefinitionForLegacyType(record.type);
}

function isConnector(record: BoardRecord): record is ConnectorRecord {
  return record.type === 'connector' && typeof record.shapeId === 'string';
}

function isUmlRecord(record: BoardRecord): boolean {
  return definitionForRecord(record)?.semantic?.notation === 'uml';
}

function inferPointKind(pointId: string): string {
  if (pointId.startsWith('table-row:')) return 'structured';
  if (pointId.startsWith('floating:')) return 'floating';
  if (pointId.startsWith('lifeline:') || pointId.startsWith('activation:')
    || pointId.startsWith('lifeline-time:') || pointId.startsWith('activation-time:')) return 'sequence-time';
  if (pointId === 'participant:create') return 'special';
  if (pointId.startsWith('behavior:')) return 'relative';
  if (['top', 'right', 'bottom', 'left', 'center'].includes(pointId)) return 'fixed';
  return 'special';
}

export function endpointReferenceStatus(
  connector: ConnectorRecord,
  side: EndpointSide,
  shapes: ReadonlyMap<string, BoardRecord>,
): EndpointReferenceStatus {
  const malformed = connector.invalidEndpointRefs?.[side];
  if (malformed) return { status: 'invalid', reason: `malformed-${side}-reference:${malformed}` };
  const reference = side === 'source' ? connector.sourceRef : connector.targetRef;
  if (!reference) return { status: 'dangling' };
  if (typeof reference.shapeId !== 'string' || !reference.shapeId.trim())
    return { status: 'invalid', reason: `missing-${side}-shape-id` };
  if (typeof reference.pointId !== 'string' || !reference.pointId.trim())
    return { status: 'invalid', reason: `missing-${side}-point-id` };
  const owner = shapes.get(reference.shapeId);
  if (!owner) return { status: 'invalid', reason: `missing-${side}-shape:${reference.shapeId}` };
  const definition = definitionForRecord(owner);
  if (!definition || (owner.type !== 'diagram' && owner.type !== 'rect' && owner.type !== 'ellipse'
      && owner.type !== 'rounded-rect' && owner.type !== 'triangle' && owner.type !== 'diamond'))
    return { status: 'invalid', reason: `unconnectable-${side}-shape:${reference.shapeId}` };
  if (![owner.x, owner.y, owner.w, owner.h].every(value => typeof value === 'number' && Number.isFinite(value)))
    return { status: 'invalid', reason: `invalid-${side}-shape-geometry:${reference.shapeId}` };
  const point = connectionPointById(owner as unknown as Parameters<typeof connectionPointById>[0], reference.pointId);
  if (!point) return { status: 'invalid', reason: `missing-${side}-point:${reference.shapeId}/${reference.pointId}` };
  const pointKind = reference.kind ?? inferPointKind(reference.pointId);
  if (pointKind !== point.kind)
    return { status: 'invalid', reason: `attachment-kind-mismatch-${side}:${pointKind}/${point.kind}` };
  return { status: 'connected', point: { id: point.id, x: point.x, y: point.y, kind: point.kind } };
}

function componentContext(records: readonly BoardRecord[], byId: ReadonlyMap<string, BoardRecord>): DiagramContextId {
  const scores = new Map<UMLDiagramFamily, number>();
  const add = (family: UMLDiagramFamily, score: number) => scores.set(family, (scores.get(family) ?? 0) + score);
  for (const record of records) {
    if (!isUmlRecord(record)) continue;
    const definition = definitionForRecord(record)!;
    const families = familyForDefinition(definition);
    const stored = record.diagramContext;
    if (typeof stored === 'string' && families.includes(stored as UMLDiagramFamily)) add(stored as UMLDiagramFamily, 10);
    if (definition.semantic?.contextRoot && families.length === 1) add(families[0], 8);
    if (record.type === 'connector' && families.length === 1) add(families[0], 5);
    else if (record.type === 'diagram' && families.length === 1) add(families[0], 2);
  }
  // A shared association/generalization is resolved by its actual endpoint-role pair, not tool id.
  for (const record of records) {
    if (!isConnector(record)) continue;
    const definition = definitionForRecord(record);
    if (!definition) continue;
    const source = record.sourceRef ? byId.get(record.sourceRef.shapeId) : undefined;
    const target = record.targetRef ? byId.get(record.targetRef.shapeId) : undefined;
    const sourceDefinition = definitionForRecord(source), targetDefinition = definitionForRecord(target);
    if (!sourceDefinition || !targetDefinition) continue;
    const families = familyForDefinition(definition);
    for (const family of families) {
      const endpointFamilies = familyForDefinition(sourceDefinition).includes(family)
        && familyForDefinition(targetDefinition).includes(family);
      if (endpointFamilies && connectorEndpointPairAllowed(definition, sourceDefinition, targetDefinition)) add(family, 3);
    }
  }
  const ranked = [...scores].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  if (!ranked.length) return 'freeform';
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return 'mixed';
  return ranked[0][0];
}

function graphComponents(records: readonly BoardRecord[]): BoardRecord[][] {
  const byId = new Map(records.map(record => [record.id, record]));
  const adjacency = new Map<string, Set<string>>(records.map(record => [record.id, new Set<string>()]));
  const link = (a?: string, b?: string) => {
    if (!a || !b || !byId.has(a) || !byId.has(b)) return;
    adjacency.get(a)!.add(b); adjacency.get(b)!.add(a);
  };
  for (const record of records) {
    if (isConnector(record)) { link(record.sourceRef?.shapeId, record.id); link(record.targetRef?.shapeId, record.id); }
    if (typeof record.containerId === 'string') link(record.containerId, record.id);
  }
  const components: BoardRecord[][] = [], visited = new Set<string>();
  for (const record of records) {
    if (visited.has(record.id)) continue;
    const queue = [record.id], component: BoardRecord[] = [];
    visited.add(record.id);
    while (queue.length) {
      const id = queue.shift()!, current = byId.get(id);
      if (current) component.push(current);
      for (const next of adjacency.get(id) ?? []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
    components.push(component);
  }
  return components;
}

export function inferUmlContexts(input: readonly unknown[]): Map<string, UMLDiagramFamily> {
  const records = input.filter((value): value is BoardRecord => Boolean(value && typeof value === 'object'
    && typeof (value as Record<string, unknown>).id === 'string' && typeof (value as Record<string, unknown>).type === 'string'));
  const byId = new Map(records.map(record => [record.id, record]));
  const contexts = new Map<string, UMLDiagramFamily>();
  for (const component of graphComponents(records)) {
    const context = componentContext(component, byId);
    if (!UML_FAMILY_SET.has(context)) continue;
    const family = context as UMLDiagramFamily;
    for (const record of component) if (isUmlRecord(record) && familyForDefinition(definitionForRecord(record)).includes(family))
      contexts.set(record.id, family);
  }
  return contexts;
}

function sequenceSemanticDiagnostics(
  records: readonly BoardRecord[], byId: ReadonlyMap<string, BoardRecord>,
): DiagramGraphDiagnostic[] {
  type EventEntry = { record: BoardRecord; event: Record<string, unknown> };
  const out: DiagramGraphDiagnostic[] = [];
  const push = (id: string, code: string, severity: 'incomplete' | 'invalid', message: string, relatedIds: string[]) =>
    out.push({ id, code, severity, family: 'sequence', message, relatedIds: [...new Set(relatedIds)] });
  const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const familyOf = (record: BoardRecord | undefined) => definitionForRecord(record)?.semantic?.family;
  const participantOfEndpoint = (endpoint: BoardRecord | undefined): string | undefined => {
    if (!endpoint) return undefined;
    if (familyOf(endpoint) === 'uml.sequence-participant') return endpoint.id;
    if (familyOf(endpoint) !== 'uml.sequence-control' || endpoint.type !== 'diagram' || typeof endpoint.containerId !== 'string') return undefined;
    const owner = byId.get(endpoint.containerId);
    return familyOf(owner) === 'uml.sequence-participant' ? owner!.id : undefined;
  };
  const events: EventEntry[] = [];
  const eventIds = new Map<string, EventEntry>();
  const messageIds = new Map<string, EventEntry>();
  const occurrences = new Map<string, EventEntry>();
  const createTargets = new Map<string, EventEntry[]>();

  for (const record of records) {
    if (familyOf(record) !== 'uml.sequence-edge') continue;
    if (!object(record.sequenceEvent)) {
      push(record.id, 'missing-sequence-event', 'incomplete', 'The message has no explicit Sequence event record yet.', [record.id]);
      continue;
    }
    const event = record.sequenceEvent;
    const entry = { record, event };
    events.push(entry);
    messageIds.set(record.id, entry);
    if (event.messageId !== record.id)
      push(record.id, 'sequence-message-id-mismatch', 'invalid', 'The event points to a different message object.', [record.id]);
    if (typeof event.eventId !== 'string' || !event.eventId.trim())
      push(record.id, 'missing-sequence-event-id', 'invalid', 'The event has no stable event identity.', [record.id]);
    else {
      const previous = eventIds.get(event.eventId);
      if (previous) push(record.id, 'duplicate-sequence-event-id', 'invalid', 'Two messages share one event identity.', [previous.record.id, record.id]);
      else eventIds.set(event.eventId, entry);
    }
    if (!finiteNumber(event.order)) push(record.id, 'invalid-sequence-event-order', 'invalid', 'The event order token must be finite.', [record.id]);
    if (!finiteNumber(event.visualY)) push(record.id, 'invalid-sequence-event-time', 'invalid', 'The event display ordinate must be finite.', [record.id]);
    if (finiteNumber(record.sequenceTime) && finiteNumber(event.visualY) && Math.abs(record.sequenceTime - event.visualY) > 0.001)
      push(record.id, 'sequence-time-alias-mismatch', 'invalid', 'The legacy time alias disagrees with the explicit event ordinate.', [record.id]);
    const expectedKind: Readonly<Record<string, string>> = {
      'uml.sequence-message': 'synchronous', 'uml.async-message': 'asynchronous',
      'uml.return-message': 'return', 'uml.create-message': 'create',
      'uml.self-call-message': 'self-call',
      'uml.lost-message': 'lost', 'uml.found-message': 'found',
    };
    const expected = expectedKind[String(record.shapeId)];
    const sourceParticipantId = typeof event.sourceParticipantId === 'string' ? event.sourceParticipantId : undefined;
    const targetParticipantId = typeof event.targetParticipantId === 'string' ? event.targetParticipantId : undefined;
    const sameParticipant = Boolean(sourceParticipantId && sourceParticipantId === targetParticipantId);
    if (expected && event.kind !== expected && !(expected === 'synchronous' && event.kind === 'self-call' && sameParticipant))
      push(record.id, 'sequence-message-kind-mismatch', 'invalid', 'The event kind does not match the registered message semantics.', [record.id]);
    if (event.kind === 'self-call' && !sameParticipant) {
      if (sourceParticipantId && targetParticipantId)
        push(record.id, 'invalid-self-call-owner', 'invalid', 'A self-call must have the same participant at both ends.', [record.id]);
      else push(record.id, 'incomplete-self-call-owner', 'incomplete', 'Attach both ends to one participant to complete the self-call.', [record.id]);
    }
    if (event.selfCall === true && sourceParticipantId && targetParticipantId && !sameParticipant)
      push(record.id, 'invalid-self-call-owner', 'invalid', 'The self-call flag conflicts with the source and target participants.', [record.id]);
    if (event.selfCall === true && !finiteNumber(event.targetVisualY))
      push(record.id, 'missing-self-call-target-time', 'invalid', 'A self-call needs an explicit target occurrence ordinate.', [record.id]);
    for (const side of ['source', 'target'] as const) {
      const ref = object(record[`${side}Ref`]) ? record[`${side}Ref`] as Record<string, unknown> : undefined;
      const storedEndpoint = typeof event[`${side}EndpointId`] === 'string' ? event[`${side}EndpointId`] as string : undefined;
      const storedParticipant = typeof event[`${side}ParticipantId`] === 'string' ? event[`${side}ParticipantId`] as string : undefined;
      if (ref) {
        const endpointId = typeof ref.shapeId === 'string' ? ref.shapeId : undefined;
        if (!endpointId || storedEndpoint !== endpointId)
          push(record.id, `sequence-${side}-endpoint-owner-mismatch`, 'invalid', `The ${side} event endpoint identity disagrees with its attachment.`, [record.id, ...(endpointId ? [endpointId] : [])]);
        const endpoint = endpointId ? byId.get(endpointId) : undefined;
        const actualParticipant = participantOfEndpoint(endpoint);
        if (actualParticipant && storedParticipant !== actualParticipant)
          push(record.id, `sequence-${side}-participant-owner-mismatch`, 'invalid', `The ${side} event participant disagrees with its attached lifeline.`, [record.id, actualParticipant]);
        else if (endpoint && familyOf(endpoint) === 'uml.sequence-participant' && !storedParticipant)
          push(record.id, `missing-sequence-${side}-participant`, 'incomplete', `The attached ${side} participant has not been recorded on the event yet.`, [record.id, endpoint.id]);
      } else if (storedEndpoint) {
        push(record.id, `dangling-sequence-${side}-endpoint-owner`, 'invalid', `The event retains a ${side} endpoint identity without an attachment.`, [record.id, storedEndpoint]);
      }
      if (storedParticipant) {
        const participant = byId.get(storedParticipant);
        if (!participant || familyOf(participant) !== 'uml.sequence-participant')
          push(record.id, `missing-sequence-${side}-participant-owner`, 'invalid', `The ${side} event participant '${storedParticipant}' is missing or not a Sequence participant.`, [record.id, storedParticipant]);
      }
      const occurrenceId = event[`${side}OccurrenceId`];
      if (typeof occurrenceId !== 'string' || !occurrenceId.trim())
        push(record.id, `missing-sequence-${side}-occurrence`, 'invalid', `The ${side} message occurrence needs a stable identity.`, [record.id]);
      else {
        const previous = occurrences.get(occurrenceId);
        if (previous) push(record.id, 'duplicate-sequence-occurrence-id', 'invalid', 'Two message ends share one occurrence identity.', [previous.record.id, record.id]);
        else occurrences.set(occurrenceId, entry);
      }
    }
    if (record.shapeId === 'uml.create-message') {
      const targetRef = object(record.targetRef) ? record.targetRef as Record<string, unknown> : undefined;
      if (targetRef && targetRef.pointId !== 'participant:create')
        push(record.id, 'invalid-create-message-target', 'invalid', 'A create message must terminate at the new participant’s creation point.', [record.id, String(targetRef.shapeId ?? '')]);
      if (targetParticipantId) {
        const group = createTargets.get(targetParticipantId) ?? [];
        group.push(entry); createTargets.set(targetParticipantId, group);
      }
    }
  }

  for (const [participantId, group] of createTargets) if (group.length > 1)
    group.forEach(entry => push(entry.record.id, 'multiple-create-messages', 'invalid',
      'A participant is owned by more than one create message.', [participantId, ...group.map(item => item.record.id)]));

  const timelines = new Map<string, EventEntry[]>();
  for (const entry of events) {
    const timelineKey = typeof entry.event.timelineId === 'string' ? entry.event.timelineId : '';
    const group = timelines.get(timelineKey) ?? [];
    group.push(entry); timelines.set(timelineKey, group);
  }
  for (const group of timelines.values()) for (let leftIndex = 0; leftIndex < group.length; leftIndex++) {
    const left = group[leftIndex];
    if (!finiteNumber(left.event.order) || !finiteNumber(left.event.visualY)) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex++) {
      const right = group[rightIndex];
      if (left.event.order === right.event.order && finiteNumber(right.event.visualY)
        && Math.abs(left.event.visualY - right.event.visualY) > 1.25) {
        push(left.record.id, 'duplicate-sequence-event-order', 'invalid', 'Distinct event times cannot share one logical order token.', [left.record.id, right.record.id]);
        push(right.record.id, 'duplicate-sequence-event-order', 'invalid', 'Distinct event times cannot share one logical order token.', [left.record.id, right.record.id]);
      }
    }
  }

  for (const entry of events) {
    const { record, event } = entry;
    if (typeof event.returnForMessageId !== 'string') continue;
    const call = messageIds.get(event.returnForMessageId);
    if (!call) {
      push(record.id, 'missing-return-call', 'invalid', 'The return message refers to a missing call message.', [record.id, event.returnForMessageId]);
      continue;
    }
    if (!['synchronous', 'asynchronous', 'self-call'].includes(String(call.event.kind)))
      push(record.id, 'invalid-return-call-kind', 'invalid', 'A return message must refer to a call, not another return or create message.', [record.id, call.record.id]);
    if (finiteNumber(event.order) && finiteNumber(call.event.order) && event.order <= call.event.order)
      push(record.id, 'invalid-return-order', 'invalid', 'A linked return event must follow its call in explicit event order.', [record.id, call.record.id]);
    const reverse = event.sourceParticipantId === call.event.targetParticipantId
      && event.targetParticipantId === call.event.sourceParticipantId;
    if (event.sourceParticipantId && event.targetParticipantId && call.event.sourceParticipantId && call.event.targetParticipantId && !reverse)
      push(record.id, 'invalid-return-participant-direction', 'invalid', 'A linked return message must travel back from the call target to its source.', [record.id, call.record.id]);
  }

  for (const record of records) {
    if (record.type !== 'diagram') continue;
    const family = familyOf(record);
    if (family === 'uml.sequence-participant') {
      const data = object(record.data) && object((record.data as Record<string, unknown>).sequenceParticipant)
        ? (record.data as Record<string, unknown>).sequenceParticipant as Record<string, unknown> : undefined;
      if (!data) {
        push(record.id, 'missing-sequence-participant-data', 'incomplete', 'Participant identity metadata is not initialized yet.', [record.id]);
        continue;
      }
      if (data.participantId !== record.id)
        push(record.id, 'sequence-participant-id-mismatch', 'invalid', 'Participant metadata must identify its owning lifeline object.', [record.id]);
      if (typeof data.createdByMessageId === 'string') {
        const creator = messageIds.get(data.createdByMessageId);
        if (!creator || creator.record.shapeId !== 'uml.create-message'
          || creator.event.targetParticipantId !== record.id || (object(creator.record.targetRef)
            && (creator.record.targetRef as Record<string, unknown>).pointId !== 'participant:create'))
          push(record.id, 'invalid-participant-creator', 'invalid', 'Participant creation metadata does not resolve to its create message.', [record.id, data.createdByMessageId]);
        if (finiteNumber(data.createdAtOrder) && creator && finiteNumber(creator.event.order)
          && Math.abs(data.createdAtOrder - creator.event.order) > 1e-6)
          push(record.id, 'participant-create-order-mismatch', 'invalid', 'Participant creation order disagrees with its create event.', [record.id, creator.record.id]);
      } else if (data.createdAtOrder !== undefined) {
        push(record.id, 'orphan-participant-create-order', 'invalid', 'A creation order exists without a create message identity.', [record.id]);
      }
      if (typeof data.destroyedByEventId === 'string') {
        const marker = byId.get(data.destroyedByEventId);
        const lifecycle = object(marker?.data) && object((marker!.data as Record<string, unknown>).sequenceLifecycle)
          ? (marker!.data as Record<string, unknown>).sequenceLifecycle as Record<string, unknown> : undefined;
        if (!marker || marker.shapeId !== 'uml.destroy' || lifecycle?.participantId !== record.id)
          push(record.id, 'invalid-participant-destruction', 'invalid', 'Participant destruction metadata does not resolve to its own destruction marker.', [record.id, data.destroyedByEventId]);
        if (finiteNumber(data.destroyedAtOrder) && lifecycle && finiteNumber(lifecycle.order)
          && Math.abs(data.destroyedAtOrder - lifecycle.order) > 1e-6)
          push(record.id, 'participant-destroy-order-mismatch', 'invalid', 'Participant destruction order disagrees with its lifecycle marker.', [record.id, data.destroyedByEventId]);
      } else if (data.destroyedAtOrder !== undefined) {
        push(record.id, 'orphan-participant-destroy-order', 'invalid', 'A destruction order exists without a destruction event identity.', [record.id]);
      }
    }

    if (record.shapeId === 'uml.activation') {
      const data = object(record.data) && object((record.data as Record<string, unknown>).sequenceActivation)
        ? (record.data as Record<string, unknown>).sequenceActivation as Record<string, unknown> : undefined;
      if (!data) {
        push(record.id, 'missing-sequence-activation-data', 'incomplete', 'Activation ownership and duration metadata is not initialized yet.', [record.id]);
        continue;
      }
      if (data.activationId !== record.id) push(record.id, 'sequence-activation-id-mismatch', 'invalid', 'Activation metadata must identify its owning bar.', [record.id]);
      if (!finiteNumber(data.duration) || data.duration <= 0) push(record.id, 'invalid-sequence-activation-duration', 'invalid', 'Activation duration must be a positive finite value.', [record.id]);
      if (typeof record.containerId !== 'string')
        push(record.id, 'incomplete-sequence-activation-owner', 'incomplete', 'Attach the activation to a participant lifeline to establish its owner.', [record.id]);
      else if (data.participantId !== record.containerId)
        push(record.id, 'sequence-activation-owner-mismatch', 'invalid', 'Activation ownership must agree with its explicit lifeline container.', [record.id, record.containerId]);
      if (data.startOrder !== undefined && !finiteNumber(data.startOrder)
        || data.endOrder !== undefined && !finiteNumber(data.endOrder))
        push(record.id, 'invalid-sequence-activation-order', 'invalid', 'Activation boundary order tokens must be finite.', [record.id]);
      if (finiteNumber(data.startOrder) && finiteNumber(data.endOrder) && data.endOrder < data.startOrder)
        push(record.id, 'invalid-sequence-activation-range', 'invalid', 'Activation end order precedes its start order.', [record.id]);
      for (const key of ['startOccurrenceId', 'endOccurrenceId'] as const) if (typeof data[key] === 'string' && !occurrences.has(data[key] as string))
        push(record.id, `missing-activation-${key}`, 'invalid', `Activation ${key === 'startOccurrenceId' ? 'start' : 'end'} occurrence does not exist.`, [record.id, data[key] as string]);
    }

    if (record.shapeId === 'uml.destroy') {
      const data = object(record.data) && object((record.data as Record<string, unknown>).sequenceLifecycle)
        ? (record.data as Record<string, unknown>).sequenceLifecycle as Record<string, unknown> : undefined;
      if (!data) {
        push(record.id, 'missing-sequence-lifecycle-data', 'incomplete', 'Destruction event identity is not initialized yet.', [record.id]);
        continue;
      }
      if (data.lifecycleId !== record.id || data.kind !== 'destroy')
        push(record.id, 'invalid-sequence-lifecycle-identity', 'invalid', 'Destruction lifecycle metadata must identify its owning destroy mark.', [record.id]);
      if (!finiteNumber(data.visualY)) push(record.id, 'invalid-sequence-lifecycle-time', 'invalid', 'Destruction event ordinate must be finite.', [record.id]);
      if (data.order !== undefined && !finiteNumber(data.order)) push(record.id, 'invalid-sequence-lifecycle-order', 'invalid', 'Destruction order token must be finite.', [record.id]);
      if (typeof record.containerId !== 'string')
        push(record.id, 'incomplete-sequence-lifecycle-owner', 'incomplete', 'Attach the destruction mark to the participant whose lifeline ends.', [record.id]);
      else if (data.participantId !== record.containerId)
        push(record.id, 'sequence-lifecycle-owner-mismatch', 'invalid', 'Destruction event ownership must match its explicit participant container.', [record.id, record.containerId]);
    }

    if (record.shapeId === 'uml.frame') {
      const data = object(record.data) && object((record.data as Record<string, unknown>).sequenceFragment)
        ? (record.data as Record<string, unknown>).sequenceFragment as Record<string, unknown> : undefined;
      if (!data) {
        push(record.id, 'missing-sequence-fragment-data', 'incomplete', 'Choose a supported fragment operator and operands.', [record.id]);
        continue;
      }
      const operator = data.operator;
      const operands = Array.isArray(data.operands) ? data.operands.filter(object) : [];
      if (!isSequenceFragmentOperator(operator))
        push(record.id, 'invalid-sequence-fragment-operator', 'invalid', 'Unsupported sequence fragment operator.', [record.id]);
      const multi = isMultiOperandOperator(operator as SequenceFragmentOperator);
      if (operands.length < (multi ? 2 : 1) || operands.length > 16)
        push(record.id, 'invalid-sequence-fragment-operands', 'invalid', 'The fragment operator has an unsupported operand count.', [record.id]);
      const operandIds = new Set<string>();
      operands.forEach((operand, index) => {
        if (typeof operand.id !== 'string' || !operand.id.trim() || operandIds.has(operand.id))
          push(record.id, 'duplicate-sequence-operand-id', 'invalid', 'Fragment operand identities must be unique and non-empty.', [record.id]);
        if (typeof operand.id === 'string') operandIds.add(operand.id);
        if (operand.order !== index) push(record.id, 'invalid-sequence-operand-order', 'invalid', 'Fragment operands must use contiguous stable order tokens.', [record.id]);
        if (typeof operand.guard !== 'string') push(record.id, 'invalid-sequence-operand-guard', 'invalid', 'Fragment operand guards must be text.', [record.id]);
      });
    }
  }

  for (const entry of events) {
    const { record, event } = entry;
    const fragmentId = typeof event.fragmentId === 'string' ? event.fragmentId : undefined;
    const operandId = typeof event.operandId === 'string' ? event.operandId : undefined;
    if (fragmentId || operandId) {
      if (!fragmentId || !operandId) {
        push(record.id, 'incomplete-sequence-fragment-membership', 'incomplete', 'Both fragment and operand ownership are needed to complete this event membership.', [record.id, ...(fragmentId ? [fragmentId] : [])]);
        continue;
      }
      const frame = byId.get(fragmentId);
      const fragment = object(frame?.data) && object((frame!.data as Record<string, unknown>).sequenceFragment)
        ? (frame!.data as Record<string, unknown>).sequenceFragment as Record<string, unknown> : undefined;
      const operands = Array.isArray(fragment?.operands) ? fragment.operands.filter(object) : [];
      if (!frame || frame.shapeId !== 'uml.frame' || !fragment)
        push(record.id, 'missing-sequence-fragment-owner', 'invalid', 'Event fragment membership points to a missing or unsupported frame.', [record.id, fragmentId]);
      else if (!operands.some(operand => operand.id === operandId))
        push(record.id, 'missing-sequence-fragment-operand', 'invalid', 'Event fragment membership points to a missing operand.', [record.id, fragmentId]);
      if (record.containerId !== fragmentId)
        push(record.id, 'sequence-fragment-container-mismatch', 'invalid', 'Semantic fragment ownership must agree with connector containment.', [record.id, fragmentId, ...(typeof record.containerId === 'string' ? [record.containerId] : [])]);
    } else if (typeof record.containerId === 'string' && byId.get(record.containerId)?.shapeId === 'uml.frame') {
      push(record.id, 'incomplete-sequence-fragment-membership', 'incomplete', 'The message is inside a frame but is not assigned to an operand yet.', [record.id, record.containerId]);
    }
  }

  for (const record of records) {
    if (record.type !== 'diagram' || familyOf(record) !== 'uml.sequence-participant') continue;
    const data = object(record.data) && object((record.data as Record<string, unknown>).sequenceParticipant)
      ? (record.data as Record<string, unknown>).sequenceParticipant as Record<string, unknown> : undefined;
    const createdAt = data && finiteNumber(data.createdAtOrder) ? data.createdAtOrder : undefined;
    const destroyedAt = data && finiteNumber(data.destroyedAtOrder) ? data.destroyedAtOrder : undefined;
    if (createdAt !== undefined && destroyedAt !== undefined && destroyedAt <= createdAt)
      push(record.id, 'invalid-participant-lifetime-range', 'invalid', 'Participant destruction must follow participant creation.', [record.id]);
    const markers = records.filter(candidate => candidate.type === 'diagram' && candidate.shapeId === 'uml.destroy' && candidate.containerId === record.id);
    if (markers.length > 1) markers.forEach(marker => push(marker.id, 'multiple-sequence-destruction-marks', 'invalid', 'A participant can have only one destruction occurrence.', [record.id, ...markers.map(item => item.id)]));
    for (const entry of events) {
      const { record: message, event } = entry;
      if (event.sourceParticipantId !== record.id && event.targetParticipantId !== record.id) continue;
      if (finiteNumber(event.order) && createdAt !== undefined && event.kind !== 'create' && event.order < createdAt)
        push(message.id, 'message-before-participant-creation', 'invalid', 'A message occurs before its participant is created.', [message.id, record.id]);
      if (finiteNumber(event.order) && destroyedAt !== undefined && event.order >= destroyedAt)
        push(message.id, 'message-after-participant-destruction', 'invalid', 'A message occurs at or after the participant’s destruction.', [message.id, record.id]);
    }
  }
  return out;
}

/** Context-aware, non-blocking graph validation for exactly the five supported UML families. */
export function diagnoseUmlGraph(input: readonly unknown[]): DiagramGraphDiagnostic[] {
  const records = input.filter((value): value is BoardRecord => Boolean(value && typeof value === 'object'
    && typeof (value as Record<string, unknown>).id === 'string' && typeof (value as Record<string, unknown>).type === 'string'));
  const byId = new Map(records.map(record => [record.id, record]));
  const diagnostics: DiagramGraphDiagnostic[] = [];
  const push = (id: string, code: string, severity: 'incomplete' | 'invalid', family: UMLDiagramFamily | undefined,
    message: string, relatedIds: string[]) => diagnostics.push({ id, code, severity, ...(family ? { family } : {}), message, relatedIds: [...new Set(relatedIds)] });

  for (const component of graphComponents(records)) {
    const familyContext = componentContext(component, byId);
    const family = UML_FAMILY_SET.has(familyContext) ? familyContext as UMLDiagramFamily : undefined;
    const componentIds = component.map(record => record.id);
    for (const record of component) {
      if (!isUmlRecord(record)) continue;
      const definition = definitionForRecord(record);
      if (!definition) continue;
      if (typeof record.diagramContext === 'string' && !familyForDefinition(definition).includes(record.diagramContext as UMLDiagramFamily))
        push(record.id, 'invalid-diagram-context', 'invalid', family, `Stored context '${record.diagramContext}' is not allowed for ${definition.label}.`, componentIds);
      if (typeof record.containerId === 'string') {
        const parent = byId.get(record.containerId);
        if (!parent) push(record.id, 'missing-container', 'invalid', family, `Container '${record.containerId}' does not exist.`, componentIds);
        else {
          const parentDefinition = definitionForRecord(parent);
          if (parent.type !== 'diagram' || !parentDefinition || !containerAcceptsSemanticChild(parentDefinition, definition))
            push(record.id, 'invalid-container-role', 'invalid', family, `${definition.label} is not allowed in the referenced container.`, componentIds);
        }
      }
    }

    for (const record of component) {
      if (!isConnector(record) || !isUmlRecord(record)) continue;
      const definition = definitionForRecord(record);
      if (!definition) continue;
      const connectorFamilies = familyForDefinition(definition);
      const connectorFamily = record.diagramContext && connectorFamilies.includes(record.diagramContext)
        ? record.diagramContext : connectorFamilies.length === 1 ? connectorFamilies[0] : family;
      const source = endpointReferenceStatus(record, 'source', byId);
      const target = endpointReferenceStatus(record, 'target', byId);
      for (const [side, state] of [['source', source], ['target', target]] as const) {
        const reference = side === 'source' ? record.sourceRef : record.targetRef;
        const intent = side === 'source' ? record.sourceIntent : record.targetIntent;
        if (state.status === 'invalid') push(record.id, `invalid-${side}-reference`, 'invalid', connectorFamily,
          state.reason ?? `The ${side} endpoint reference is invalid.`, componentIds);
        else if (state.status === 'dangling' && (connectorFamily || familyContext === 'mixed'))
          push(record.id, `dangling-${side}-endpoint`, 'incomplete', connectorFamily,
            `The ${side} endpoint is intentionally free or not yet attached.`, componentIds);
        if ((intent === 'attached' && !reference) || ((intent === 'free' || intent === 'pending') && reference))
          push(record.id, `invalid-${side}-intent`, 'invalid', connectorFamily,
            `The ${side} endpoint reference and persisted intent disagree.`, componentIds);
        if (state.status === 'connected' && state.point) {
          const x = side === 'source' ? record.x1 : record.x2;
          const y = side === 'source' ? record.y1 : record.y2;
          if (typeof x === 'number' && typeof y === 'number' && Math.hypot(x - state.point.x, y - state.point.y) > 1.5)
            push(record.id, `stale-${side}-attachment-position`, 'invalid', connectorFamily,
              `The ${side} endpoint coordinates no longer match its stable attachment point.`, componentIds);
        }
      }
      if (source.status === 'connected' && target.status === 'connected') {
        const sourceRecord = byId.get(record.sourceRef!.shapeId), targetRecord = byId.get(record.targetRef!.shapeId);
        const sourceDefinition = definitionForRecord(sourceRecord), targetDefinition = definitionForRecord(targetRecord);
        if (!connectorEndpointPairAllowed(definition, sourceDefinition, targetDefinition))
          push(record.id, 'invalid-endpoint-pair', 'invalid', connectorFamily,
            `${definition.label} cannot connect ${sourceDefinition?.label ?? 'the source'} to ${targetDefinition?.label ?? 'the target'}.`,
            [record.id, record.sourceRef!.shapeId, record.targetRef!.shapeId]);
        if (!connectorEndpointSideAllowed(definition, sourceDefinition, 'source'))
          push(record.id, 'invalid-source-role', 'invalid', connectorFamily, `The source node role is not allowed for ${definition.label}.`, componentIds);
        if (!connectorEndpointSideAllowed(definition, targetDefinition, 'target'))
          push(record.id, 'invalid-target-role', 'invalid', connectorFamily, `The target node role is not allowed for ${definition.label}.`, componentIds);
      }
      if (typeof record.containerId === 'string') {
        const parent = byId.get(record.containerId), parentDefinition = definitionForRecord(parent);
        if (!parent || !parentDefinition || !containerAcceptsSemanticChild(parentDefinition, definition))
          push(record.id, 'invalid-connector-container', 'invalid', connectorFamily, 'Connector ownership is not allowed by this container.', componentIds);
      }
    }

    if (family === 'state') diagnostics.push(...StatePolicy.diagnose(
      component as BehavioralPolicyRecord[], byId as ReadonlyMap<string, BehavioralPolicyRecord>));
    if (family === 'activity') diagnostics.push(...ActivityPolicy.diagnose(
      component as BehavioralPolicyRecord[], byId as ReadonlyMap<string, BehavioralPolicyRecord>));
  }
  diagnostics.push(...sequenceSemanticDiagnostics(records, byId));
  return diagnostics;
}

const UML_FAMILY_SET = new Set<string>(['use-case', 'class', 'sequence', 'state', 'activity']);
