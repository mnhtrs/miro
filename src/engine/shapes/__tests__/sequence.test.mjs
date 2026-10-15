import { getShapeDefinition } from '../registry.ts';
import {
  isMultiOperandOperator, isSequenceFragmentOperator,
  normalizeSequenceFragmentData, normalizeSequenceMessageEvent, sequenceMessageKindForShape,
} from '../sequence.ts';
import { connectorMarkerOccupancy } from '../connectors.ts';
import { normalizeDragBox } from '../model.ts';

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

console.log('--- Testing UML Sequence Diagram Standard Compliance ---');

// 1. All Registered Sequence Diagram Shapes and Connectors
const sequenceShapes = [
  'uml.lifeline',
  'uml.sequence-actor',
  'uml.sequence-message',
  'uml.async-message',
  'uml.create-message',
  'uml.return-message',
  'uml.self-call-message',
  'uml.lost-message',
  'uml.found-message',
  'uml.activation',
  'uml.boundary',
  'uml.control',
  'uml.entity',
  'uml.destroy',
  'uml.frame',
];

for (const id of sequenceShapes) {
  const def = getShapeDefinition(id);
  assert(Boolean(def), `Shape ${id} must be registered in the shape registry`);
  assert(def.category === 'Sequence Diagram', `Shape ${id} must be in Sequence Diagram category`);
}
console.log('✓ All 15 Sequence Diagram shapes and connectors registered in Registry');

// 2. Sequence Message Kinds and Endpoint Markers
assert(sequenceMessageKindForShape('uml.sequence-message') === 'synchronous', 'Sync message kind');
assert(sequenceMessageKindForShape('uml.async-message') === 'asynchronous', 'Async message kind');
assert(sequenceMessageKindForShape('uml.return-message') === 'return', 'Return message kind');
assert(sequenceMessageKindForShape('uml.create-message') === 'create', 'Create message kind');
assert(sequenceMessageKindForShape('uml.self-call-message') === 'self-call', 'Self-call message kind');
assert(sequenceMessageKindForShape('uml.lost-message') === 'lost', 'Lost message kind');
assert(sequenceMessageKindForShape('uml.found-message') === 'found', 'Found message kind');

const syncDef = getShapeDefinition('uml.sequence-message');
const asyncDef = getShapeDefinition('uml.async-message');
const returnDef = getShapeDefinition('uml.return-message');
const lostDef = getShapeDefinition('uml.lost-message');
const foundDef = getShapeDefinition('uml.found-message');
const selfCallDef = getShapeDefinition('uml.self-call-message');

assert(syncDef.connector?.endMarker === 'arrow', 'Sync message has filled arrow endpoint');
assert(asyncDef.connector?.endMarker === 'openArrow', 'Async message has open stick arrow endpoint');
assert(returnDef.connector?.lineStyle === 'dashed' && returnDef.connector?.endMarker === 'openArrow', 'Return message is dashed with open arrow');
assert(lostDef.connector?.endMarker === 'filledCircle', 'Lost message has filledCircle end marker per OMG UML 2.5');
assert(foundDef.connector?.startMarker === 'filledCircle' && foundDef.connector?.endMarker === 'arrow', 'Found message has filledCircle start marker per OMG UML 2.5');
assert(selfCallDef.kind === 'connector' && selfCallDef.connector?.endMarker === 'arrow', 'Self call message is a connector with arrow');
console.log('✓ All 7 message kinds and endpoint markers verified');

// 3. Filled Circle Marker Support
const circleOccupancy = connectorMarkerOccupancy('filledCircle', undefined, 2);
assert(circleOccupancy > 0, 'filledCircle has valid marker occupancy');
console.log('✓ filledCircle endpoint marker verified');

// 4. Combined Fragment Operators (OMG UML 2.5: Section 17.6.3)
const all12Operators = [
  'alt', 'opt', 'loop', 'par', 'critical', 'break', 'seq', 'strict', 'neg', 'assert', 'ignore', 'consider',
];

for (const op of all12Operators) {
  assert(isSequenceFragmentOperator(op) === true, `Operator ${op} must be recognized as valid`);
}
assert(isSequenceFragmentOperator('invalid_op') === false, 'Invalid operator is rejected');

// Multi-operand operators require at least 2 operands
assert(isMultiOperandOperator('alt') === true, 'alt is multi-operand');
assert(isMultiOperandOperator('par') === true, 'par is multi-operand');
assert(isMultiOperandOperator('seq') === true, 'seq is multi-operand');
assert(isMultiOperandOperator('strict') === true, 'strict is multi-operand');
assert(isMultiOperandOperator('opt') === false, 'opt is single-operand');
assert(isMultiOperandOperator('loop') === false, 'loop is single-operand');
assert(isMultiOperandOperator('critical') === false, 'critical is single-operand');

// Normalization: alt requires at least 2 operands
const normalizedAlt = normalizeSequenceFragmentData({ operator: 'alt', operands: [] }, 'frame_1');
assert(normalizedAlt?.operands.length === 2, 'alt fragment normalized with 2 operands');

// Normalization: loop requires at least 1 operand
const normalizedLoop = normalizeSequenceFragmentData({ operator: 'loop', operands: [{ id: 'op1', guard: 'i < 10' }] }, 'frame_2');
assert(normalizedLoop?.operands.length === 1, 'loop fragment preserves 1 operand');
assert(normalizedLoop?.operands[0].guard === 'i < 10', 'loop fragment preserves guard condition');

// Normalization: critical requires 1 operand
const normalizedCritical = normalizeSequenceFragmentData({ operator: 'critical', operands: [] }, 'frame_3');
assert(normalizedCritical?.operands.length === 1, 'critical fragment normalized with 1 operand');

console.log('✓ All 12 OMG UML 2.5 Combined Fragment operators and operand normalization verified');

// 5. Normalizing Sequence Message Events
const event = normalizeSequenceMessageEvent({}, 'msg_1', 'uml.sequence-message', 150);
assert(event?.kind === 'synchronous', 'Event kind is synchronous');
assert(event?.visualY === 150, 'Event visualY set to fallback');

const lostEvent = normalizeSequenceMessageEvent({}, 'msg_lost', 'uml.lost-message', 200);
assert(lostEvent?.kind === 'lost', 'Lost message event kind is lost');

const foundEvent = normalizeSequenceMessageEvent({}, 'msg_found', 'uml.found-message', 250);
assert(foundEvent?.kind === 'found', 'Found message event kind is found');

const selfCallEvent = normalizeSequenceMessageEvent({ selfCall: true }, 'msg_self', 'uml.self-call-message', 300);
assert(selfCallEvent?.kind === 'self-call', 'Self call event kind is self-call');
assert(selfCallEvent?.selfCall === true, 'selfCall flag set');

console.log('✓ Sequence Message Event normalization verified');
// 6. Sensible Sizing and Drag Box Normalization (Actors, Lifelines, Activation, Destruction, Frame)
const actorDef = getShapeDefinition('uml.sequence-actor');
const lifelineDef = getShapeDefinition('uml.lifeline');
const actDef = getShapeDefinition('uml.activation');
const destroyDef = getShapeDefinition('uml.destroy');
const frameDef = getShapeDefinition('uml.frame');

// Actor participant: width is compact (75px matching Use Case actor), height extends with vertical drag (min 210px)
const shortDragActor = normalizeDragBox({ x: 100, y: 100 }, { x: 130, y: 120 }, { mode: 'vertical' }, actorDef);
assert(shortDragActor.w === 75, `Actor short drag width must be 75, got ${shortDragActor.w}`);
assert(shortDragActor.h === 210, `Actor short drag height must be at least 210, got ${shortDragActor.h}`);

const longDragActor = normalizeDragBox({ x: 100, y: 100 }, { x: 300, y: 550 }, { mode: 'vertical' }, actorDef);
assert(longDragActor.w === 75, `Actor long drag width must remain 75, got ${longDragActor.w}`);
assert(longDragActor.h === 450, `Actor long drag height must follow drag (450), got ${longDragActor.h}`);

// Lifeline: width is compact (118px), height extends with vertical drag (min 220px)
const shortDragLifeline = normalizeDragBox({ x: 50, y: 50 }, { x: 70, y: 80 }, { mode: 'free' }, lifelineDef);
assert(shortDragLifeline.w === 118, `Lifeline short drag width must be 118, got ${shortDragLifeline.w}`);
assert(shortDragLifeline.h === 220, `Lifeline short drag height must be at least 220, got ${shortDragLifeline.h}`);

const longDragLifeline = normalizeDragBox({ x: 50, y: 50 }, { x: 200, y: 400 }, { mode: 'free' }, lifelineDef);
assert(longDragLifeline.w === 118, `Lifeline long drag width must remain 118, got ${longDragLifeline.w}`);
assert(longDragLifeline.h === 350, `Lifeline long drag height must follow drag (350), got ${longDragLifeline.h}`);

// Activation: width locked to 24px, height min 40px
const dragAct = normalizeDragBox({ x: 100, y: 100 }, { x: 250, y: 220 }, { mode: 'vertical' }, actDef);
assert(dragAct.w === 24, `Activation width locked to 24, got ${dragAct.w}`);
assert(dragAct.h === 120, `Activation height follows drag (120), got ${dragAct.h}`);

// Destroy: always 1:1 square (26x26)
const dragDestroy = normalizeDragBox({ x: 100, y: 100 }, { x: 180, y: 140 }, { mode: 'aspect', aspectRatio: 1 }, destroyDef);
assert(dragDestroy.w === dragDestroy.h, `Destroy shape must be 1:1 square, got ${dragDestroy.w}x${dragDestroy.h}`);

// Frame: minimum 140x90
const smallFrame = normalizeDragBox({ x: 100, y: 100 }, { x: 130, y: 120 }, { mode: 'free' }, frameDef);
assert(smallFrame.w >= 140, `Frame minimum width 140, got ${smallFrame.w}`);
assert(smallFrame.h >= 90, `Frame minimum height 90, got ${smallFrame.h}`);

console.log('✓ Sequence and diagram drag-to-create sensible sizing and aspect ratio constraints verified');
console.log('--- ALL Sequence Diagram tests passed successfully! ---');
