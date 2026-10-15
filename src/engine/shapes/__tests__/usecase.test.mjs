import { getShapeDefinition } from '../registry.ts';
import { normalizeUseCaseDiagramData } from '../usecaseData.ts';
import { connectorDisplayLabel } from '../connectors.ts';
import { connectionPointsForBox, deserializeBoardShape } from '../model.ts';
import { CONNECTOR_ENDPOINT_RULES } from '../semantics.ts';

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

console.log('--- Testing Use Case Diagram Standard Compliance ---');

// 1. Shape Definitions Exist in Registry
const actorDef = getShapeDefinition('uml.actor');
const usecaseDef = getShapeDefinition('uml.use-case');
const boundaryDef = getShapeDefinition('uml.system-boundary');
const packageDef = getShapeDefinition('uml.package');
const noteDef = getShapeDefinition('uml.note');

const usecaseExtDef = getShapeDefinition('uml.use-case-ext');

assert(actorDef && actorDef.category === 'Use Case Diagram', 'Actor is in Use Case Diagram');
assert(actorDef.defaultFill === '#ffffff' && actorDef.defaultStroke === '#0f172a', 'Actor has professional default fill and stroke');
assert(usecaseDef && usecaseDef.category === 'Use Case Diagram', 'Use Case is in Use Case Diagram');
assert(usecaseDef.defaultFill === '#ffffff' && usecaseDef.defaultStroke === '#0f172a', 'Use Case has professional default fill and stroke');
assert(usecaseExtDef && usecaseExtDef.category === 'Use Case Diagram', 'Use Case with Extension Points is in Use Case Diagram');
assert(usecaseExtDef.defaultData?.usecase?.extensionPoints?.length === 1, 'Use Case with Extension Points has preconfigured extension point');
assert(boundaryDef && boundaryDef.category === 'Use Case Diagram', 'System Boundary is in Use Case Diagram');
assert(boundaryDef.defaultFill === '#ffffff', 'System Boundary has white default fill');
assert(packageDef && packageDef.pickerCategories?.includes('Use Case Diagram'), 'Package is available in Use Case Diagram');
assert(noteDef && noteDef.pickerCategories?.includes('Use Case Diagram'), 'Note is available in Use Case Diagram');
console.log('✓ Shapes and shared classifiers verified in Use Case Diagram category');

// 2. Connectors Exist
const extendDef = getShapeDefinition('uml.extend');
const includeDef = getShapeDefinition('uml.include');
const genDef = getShapeDefinition('uml-generalization');
const assocDef = getShapeDefinition('uml-association');
const depDef = getShapeDefinition('uml-dependency');

assert(extendDef && extendDef.category === 'Use Case Diagram', 'Extend connector registered');
assert(includeDef && includeDef.category === 'Use Case Diagram', 'Include connector registered');
assert(genDef && genDef.pickerCategories?.includes('Use Case Diagram'), 'Generalization connector available in Use Case Diagram');
assert(assocDef && assocDef.category === 'Use Case Diagram', 'Association connector registered');
assert(depDef && depDef.pickerCategories?.includes('Use Case Diagram'), 'Dependency connector available in Use Case Diagram');
console.log('✓ All 5 Use Case connectors verified in Use Case Diagram category');

// 3. Normalization of Extension Points
const rawUCData = {
  usecase: {
    stereotype: '«business use case»',
    extensionPoints: [
      { id: 'ep1', name: 'VIP Checkout', explanation: 'when cart > $100' },
      { id: 'ep2', name: 'Gift Wrapping' }
    ]
  }
};
const normalizedUC = normalizeUseCaseDiagramData(usecaseDef, rawUCData, 'use-case');
assert(normalizedUC.usecase.extensionPoints.length === 2, '2 extension points normalized');
assert(normalizedUC.usecase.isBusinessUseCase === true, 'Business use case detected');
console.log('✓ Use Case data normalization and Business Use Case detection verified');

// 4. Extend Connector Label Formatting
const rawExtendConnector = {
  id: 'c1',
  type: 'connector',
  shapeId: 'uml.extend',
  startShapeId: 'uc1',
  endShapeId: 'uc2',
  usecaseExtend: {
    version: 1,
    condition: 'cart total > $100',
    extensionPoint: 'VIP Checkout'
  }
};
const label = connectorDisplayLabel(rawExtendConnector);
assert(label.includes('«extend»'), 'Extend label contains «extend»');
assert(label.includes('condition: [cart total > $100]'), 'Extend label contains condition');
assert(label.includes('extension point: VIP Checkout'), 'Extend label contains extension point');
console.log('✓ Extend relationship multiline label formatted according to UML 2.5');

// 5. Actor Anchors
const actorAnchors = connectionPointsForBox({ shapeId: 'uml.actor', x: 100, y: 100, w: 80, h: 120 });
assert(actorAnchors.some(a => a.id === 'torso'), 'Actor has torso connection point');
assert(actorAnchors.some(a => a.id === 'hand:left'), 'Actor has left hand connection point');
assert(actorAnchors.some(a => a.id === 'hand:right'), 'Actor has right hand connection point');
console.log('✓ Actor connection points include stick-figure torso and hands');

// 6. Endpoint Connection Rules
const assocRule = CONNECTOR_ENDPOINT_RULES['uml-association'];
assert(assocRule && assocRule.pairs.some(p => p.source.includes('uml.usecase.actor') && p.target.includes('uml.usecase.use-case')),
  'Association permits Actor -> Use Case');
const extendRule = CONNECTOR_ENDPOINT_RULES['uml-usecase-dependency'];
assert(extendRule && extendRule.pairs.some(p => p.source.includes('uml.usecase.use-case') && p.target.includes('uml.usecase.use-case')),
  'Extend connects Use Case -> Use Case');
console.log('✓ Connector semantic endpoint rules verified');

// 7. Deserialization of Board Shapes
const rawBoardShape = {
  id: 's1',
  type: 'diagram',
  shapeId: 'uml.use-case',
  x: 10, y: 20, w: 180, h: 90,
  data: rawUCData
};
const deserialized = deserializeBoardShape('s1', rawBoardShape);
assert(deserialized && deserialized.data?.usecase?.extensionPoints?.length === 2, 'Use Case deserialized with extension points');
console.log('✓ Deserialization preserves extension points and diagram data');

// 8. Dynamic Font & Component Scaling on Resize
const { resizeDiagramEmbeddedTextScale } = await import('../model.ts');
const initialUC = { w: 160, h: 85, embeddedTextScale: 1 };
const scaledScale = resizeDiagramEmbeddedTextScale(initialUC, 320, 170);
assert(Math.abs(scaledScale - 2.0) < 0.05, `Embedded text scale doubles when shape dimensions double: got ${scaledScale}`);
console.log('✓ Embedded text scale correctly doubles when Use Case size doubles (proportional scaling)');

// 9. Double-Click In-Place Inline Text Editable Check
const { isDoubleClickTextEditableShape } = await import('../model.ts');
assert(isDoubleClickTextEditableShape({ type: 'diagram', shapeId: 'uml.use-case', x: 0, y: 0, w: 160, h: 85 }) === true,
  'Use Case is double-click text editable inline');
assert(isDoubleClickTextEditableShape({ type: 'diagram', shapeId: 'uml.use-case-ext', x: 0, y: 0, w: 175, h: 95 }) === true,
  'Use Case (Ext) is double-click text editable inline');
assert(isDoubleClickTextEditableShape({ type: 'diagram', shapeId: 'uml.actor', x: 0, y: 0, w: 75, h: 115 }) === true,
  'Actor is double-click text editable inline');
assert(isDoubleClickTextEditableShape({ type: 'diagram', shapeId: 'uml.system-boundary', x: 0, y: 0, w: 340, h: 240 }) === true,
  'System boundary is double-click text editable inline');
// 10. Non-colliding Transparent Connector Label Clearance Layout
const { defaultConnectorCenterOffset, connectorLabelLayout } = await import('../connectors.ts');
// Horizontal connector from (0, 100) to (200, 100)
const hRoute = [[0, 100], [200, 100]];
const hLayout = connectorLabelLayout(hRoute, { labelWidth: 80, labelHeight: 20, strokeWidth: 2 });
// For left-to-right horizontal line, normal is [0, 1]. Negative offset shifts upwards in screen Y (y < 100).
assert(hLayout.y < 100, `Horizontal connector label must be placed above the line (y < 100): got ${hLayout.y}`);
assert(100 - (hLayout.y + 10) >= 4, `Label must have a clean transparent gap >= 4px above the line stroke`);

// Vertical connector from (100, 0) to (100, 200)
const vRoute = [[100, 0], [100, 200]];
const vLayout = connectorLabelLayout(vRoute, { labelWidth: 80, labelHeight: 20, strokeWidth: 2 });
// For top-to-bottom vertical line, label must be placed to the right (x > 100)
assert(vLayout.x > 100, `Vertical connector label must be placed to the right of the line (x > 100): got ${vLayout.x}`);
assert((vLayout.x - 40) - 100 >= 4, `Label must have a clean transparent gap >= 4px to the right of line stroke`);

console.log('✓ Connector labels automatically calculate non-colliding clearance offset without intersecting arrow lines');

console.log('--- ALL USE CASE TESTS PASSED SUCCESSFULLY! ---');

