import type {
  DiagramData, SequenceActivationData, SequenceFragmentData, SequenceFragmentOperand, SequenceFragmentOperator,
  SequenceLifecycleData, SequenceMessageEventData, SequenceMessageKind, SequenceParticipantData,
} from './types';

const MESSAGE_KIND_BY_SHAPE: Readonly<Record<string, SequenceMessageKind>> = Object.freeze({
  'uml.sequence-message': 'synchronous',
  'uml.async-message': 'asynchronous',
  'uml.return-message': 'return',
  'uml.create-message': 'create',
  'uml.self-call-message': 'self-call',
  'uml.lost-message': 'lost',
  'uml.found-message': 'found',
});
const FRAGMENT_OPERATORS = new Set<SequenceFragmentOperator>([
  'alt', 'opt', 'loop', 'par', 'critical', 'break', 'seq', 'strict', 'neg', 'assert', 'ignore', 'consider',
]);
const MESSAGE_KINDS = new Set<SequenceMessageKind>([
  'synchronous', 'asynchronous', 'return', 'create', 'self-call', 'lost', 'found',
]);

export function isMultiOperandOperator(operator: SequenceFragmentOperator): boolean {
  return ['alt', 'par', 'seq', 'strict'].includes(operator);
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const safeId = (value: unknown): string | undefined => typeof value === 'string' && value.trim() && value.length <= 256 ? value : undefined;
const safeNumber = (value: unknown, fallback: number, low = -1_000_000_000_000, high = 1_000_000_000_000) =>
  finite(value) ? Math.max(low, Math.min(high, value)) : fallback;

/** Stable fallback identity for one-time legacy migration; new events receive fresh explicit IDs. */
export function legacySequenceEventId(messageId: string): string {
  const full = `legacy-event:${messageId}`;
  if (full.length <= 256) return full;
  let hash = 2166136261;
  for (const character of messageId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return `legacy-event:${hash.toString(36)}`;
}

export function sequenceMessageKindForShape(shapeId: string): SequenceMessageKind | undefined {
  return MESSAGE_KIND_BY_SHAPE[shapeId];
}

/** Normalize persisted values without discarding unknown top-level UML data. */
export function normalizeSequenceMessageEvent(
  value: unknown,
  messageId: string,
  shapeId: string,
  fallbackY: number,
  sequenceTime?: number,
  sourceRef?: { shapeId: string },
  targetRef?: { shapeId: string },
  targetY?: number,
): SequenceMessageEventData | undefined {
  const defaultKind = MESSAGE_KIND_BY_SHAPE[shapeId];
  if (!defaultKind) return undefined;
  const raw = isRecord(value) ? value : {};
  const visualY = safeNumber(raw.visualY, finite(sequenceTime) ? sequenceTime : fallbackY, -1_000_000, 1_000_000);
  const sourceEndpointId = safeId(raw.sourceEndpointId) ?? sourceRef?.shapeId;
  const targetEndpointId = safeId(raw.targetEndpointId) ?? targetRef?.shapeId;
  const sourceParticipantId = safeId(raw.sourceParticipantId);
  const targetParticipantId = safeId(raw.targetParticipantId);
  const rawKind = typeof raw.kind === 'string' && MESSAGE_KINDS.has(raw.kind as SequenceMessageKind)
    ? raw.kind as SequenceMessageKind : defaultKind;
  const sameParticipant = Boolean(sourceParticipantId && sourceParticipantId === targetParticipantId)
    || Boolean(sourceRef && targetRef && sourceRef.shapeId === targetRef.shapeId);
  const selfCall = raw.selfCall === true || rawKind === 'self-call' || sameParticipant;
  const kind = defaultKind === 'synchronous' && selfCall ? 'self-call' : defaultKind;
  const targetVisualY = selfCall ? safeNumber(raw.targetVisualY, finite(targetY) ? targetY : visualY + 24, -1_000_000, 1_000_000) : visualY;
  const eventId = safeId(raw.eventId) ?? legacySequenceEventId(messageId);
  const sourceOccurrenceId = safeId(raw.sourceOccurrenceId) ?? `${eventId}:source`;
  const targetOccurrenceId = safeId(raw.targetOccurrenceId) ?? `${eventId}:target`;
  return {
    version: 1,
    eventId,
    messageId: safeId(raw.messageId) ?? messageId,
    order: safeNumber(raw.order, finite(sequenceTime) ? sequenceTime : visualY),
    visualY: Math.round(visualY * 1000) / 1000,
    ...(Math.abs(targetVisualY - visualY) > 0.001 ? { targetVisualY: Math.round(targetVisualY * 1000) / 1000 } : {}),
    kind,
    ...(selfCall ? { selfCall: true } : {}),
    sourceOccurrenceId,
    targetOccurrenceId,
    ...(sourceEndpointId ? { sourceEndpointId } : {}),
    ...(targetEndpointId ? { targetEndpointId } : {}),
    ...(sourceParticipantId ? { sourceParticipantId } : {}),
    ...(targetParticipantId ? { targetParticipantId } : {}),
    ...(safeId(raw.returnForMessageId) ? { returnForMessageId: safeId(raw.returnForMessageId)! } : {}),
    ...(safeId(raw.timelineId) ? { timelineId: safeId(raw.timelineId)! } : {}),
    ...(safeId(raw.fragmentId) ? { fragmentId: safeId(raw.fragmentId)! } : {}),
    ...(safeId(raw.operandId) ? { operandId: safeId(raw.operandId)! } : {}),
  };
}

export function createSequenceMessageEvent(
  messageId: string,
  eventId: string,
  occurrenceId: string,
  kind: SequenceMessageKind,
  order: number,
  visualY: number,
): SequenceMessageEventData {
  return {
    version: 1, eventId, messageId, order, visualY, kind,
    sourceOccurrenceId: `${occurrenceId}:source`, targetOccurrenceId: `${occurrenceId}:target`,
  };
}

export function normalizeSequenceParticipantData(value: unknown, participantId: string): SequenceParticipantData {
  const raw = isRecord(value) ? value : {};
  return {
    version: 1,
    participantId,
    ...(safeId(raw.createdByMessageId) ? { createdByMessageId: safeId(raw.createdByMessageId)! } : {}),
    ...(finite(raw.createdAtOrder) ? { createdAtOrder: safeNumber(raw.createdAtOrder, 0) } : {}),
    ...(safeId(raw.destroyedByEventId) ? { destroyedByEventId: safeId(raw.destroyedByEventId)! } : {}),
    ...(finite(raw.destroyedAtOrder) ? { destroyedAtOrder: safeNumber(raw.destroyedAtOrder, 0) } : {}),
  };
}

export function normalizeSequenceActivationData(
  value: unknown,
  activationId: string,
  participantId: string | undefined,
  fallbackDuration: number,
): SequenceActivationData {
  const raw = isRecord(value) ? value : {};
  return {
    version: 1,
    activationId,
    ...(participantId ? { participantId } : {}),
    duration: Math.max(1, safeNumber(raw.duration, fallbackDuration, 1, 1_000_000)),
    ...(safeId(raw.startOccurrenceId) ? { startOccurrenceId: safeId(raw.startOccurrenceId)! } : {}),
    ...(safeId(raw.endOccurrenceId) ? { endOccurrenceId: safeId(raw.endOccurrenceId)! } : {}),
    ...(finite(raw.startOrder) ? { startOrder: safeNumber(raw.startOrder, 0) } : {}),
    ...(finite(raw.endOrder) ? { endOrder: safeNumber(raw.endOrder, 0) } : {}),
  };
}

export function normalizeSequenceLifecycleData(
  value: unknown,
  lifecycleId: string,
  participantId: string | undefined,
  fallbackY: number,
): SequenceLifecycleData {
  const raw = isRecord(value) ? value : {};
  return {
    version: 1, lifecycleId, kind: 'destroy',
    ...(participantId ? { participantId } : {}),
    visualY: Math.round(safeNumber(raw.visualY, fallbackY, -1_000_000, 1_000_000) * 1000) / 1000,
    ...(finite(raw.order) ? { order: safeNumber(raw.order, 0) } : {}),
  };
}

function newOperand(id: string, order: number): SequenceFragmentOperand {
  return { id, order, guard: '' };
}

export function normalizeSequenceFragmentData(value: unknown, frameId: string): SequenceFragmentData | undefined {
  if (!isRecord(value) || typeof value.operator !== 'string' || !FRAGMENT_OPERATORS.has(value.operator as SequenceFragmentOperator)) return undefined;
  const operator = value.operator as SequenceFragmentOperator;
  const isMulti = isMultiOperandOperator(operator);
  const minimum = isMulti ? 2 : 1;
  const maximum = 16;
  const source = Array.isArray(value.operands) ? value.operands.slice(0, maximum) : [];
  const used = new Set<string>();
  const operands = source.flatMap((candidate, index) => {
    if (!isRecord(candidate)) return [];
    let id = safeId(candidate.id) ?? `operand:${frameId}:${index + 1}`;
    if (used.has(id)) id = `operand:${frameId}:${index + 1}`;
    if (used.has(id)) return [];
    used.add(id);
    return [{ id, order: Math.max(0, Math.floor(safeNumber(candidate.order, index, 0, 1000))),
      guard: typeof candidate.guard === 'string' ? candidate.guard.slice(0, 500) : '' }];
  }).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  while (operands.length < minimum) {
    const index = operands.length + 1;
    let id = `operand:${frameId}:${index}`;
    while (used.has(id)) id = `${id}:next`;
    used.add(id);
    operands.push(newOperand(id, operands.length));
  }
  operands.forEach((operand, index) => { operand.order = index; });
  return { version: 1, operator, operands };
}

/** Add only semantics carried by currently supported Sequence participants, controls, and frames. */
export function normalizeSequenceDiagramData(
  value: Record<string, unknown>,
  shapeId: string,
  id: string,
  containerId: string | undefined,
  height: number,
  fallbackY: number,
): DiagramData {
  const data = { ...value } as DiagramData;
  if (['uml.lifeline', 'uml.sequence-actor', 'uml.boundary', 'uml.control', 'uml.entity'].includes(shapeId)) {
    data.sequenceParticipant = normalizeSequenceParticipantData(data.sequenceParticipant, id);
  } else delete data.sequenceParticipant;
  if (shapeId === 'uml.activation') {
    const current: Record<string, unknown> = isRecord(data.sequenceActivation) ? data.sequenceActivation : {};
    const participantId = containerId ?? safeId(current.participantId);
    data.sequenceActivation = normalizeSequenceActivationData(current, id, participantId, height);
  } else delete data.sequenceActivation;
  if (shapeId === 'uml.destroy') {
    const current: Record<string, unknown> = isRecord(data.sequenceLifecycle) ? data.sequenceLifecycle : {};
    const participantId = containerId ?? safeId(current.participantId);
    data.sequenceLifecycle = normalizeSequenceLifecycleData(current, id, participantId, fallbackY);
  } else delete data.sequenceLifecycle;
  if (shapeId === 'uml.frame') {
    // The currently exposed Sequence frame supports only the four concrete combined-fragment operators.
    const fragment = normalizeSequenceFragmentData(data.sequenceFragment ?? { operator: 'alt', operands: [] }, id);
    if (fragment) data.sequenceFragment = fragment;
    else delete data.sequenceFragment;
  } else delete data.sequenceFragment;
  return data;
}

export function isSequenceMessageShape(shapeId: string): boolean {
  return Boolean(MESSAGE_KIND_BY_SHAPE[shapeId]);
}

export function isSequenceParticipantShape(shapeId: string): boolean {
  return ['uml.lifeline', 'uml.sequence-actor', 'uml.boundary', 'uml.control', 'uml.entity'].includes(shapeId);
}

export function isSequenceFragmentOperator(value: unknown): value is SequenceFragmentOperator {
  return typeof value === 'string' && FRAGMENT_OPERATORS.has(value as SequenceFragmentOperator);
}

export function compareSequenceEvents(left: SequenceMessageEventData, right: SequenceMessageEventData): number {
  return left.order - right.order || left.eventId.localeCompare(right.eventId);
}
