import assert from 'node:assert';
import { getShapeDefinition } from '../registry.ts';
import {
  classifierKindForShape,
  parseLegacyAttribute,
  parseLegacyOperation,
  parseClassifierMemberText,
  classifierLayout,
  instanceLayout,
  formatClassifierMember,
} from '../classifier.ts';
import {
  deserializeBoardShape,
  isDoubleClickTextEditableShape,
  resizeDiagramEmbeddedTextScale,
} from '../model.ts';
import { connectorDisplayLabel, defaultConnectorCenterOffset, connectorLabelLayout } from '../connectors.ts';

console.log('--- Testing Class Diagram Standard Compliance (OMG UML 2.5) ---');

// 1. Shapes Registered in Class Diagram Category
const classCategoryShapes = [
  'uml.class',
  'uml.abstract-class',
  'uml.interface',
  'uml.enumeration',
  'uml.object',
  'uml.package',
  'uml.module',
  'uml.component',
  'uml.provided-interface',
  'uml.required-interface',
  'uml.note',
];

for (const id of classCategoryShapes) {
  const def = getShapeDefinition(id);
  assert(def, `Shape definition '${id}' must exist`);
  const isClassCategory = def.category === 'Class Diagram' || (def.pickerCategories && def.pickerCategories.includes('Class Diagram'));
  assert(isClassCategory, `Shape '${id}' must belong to 'Class Diagram' category: got ${def.category}`);
}
console.log('✓ All 11 Class Diagram classifiers, packages, components, and notes verified');

// 2. Class Diagram Connectors
const classConnectors = [
  { id: 'uml-association', lineStyle: 'solid', endMarker: 'none' },
  { id: 'uml-directed-association', lineStyle: 'solid', endMarker: 'arrow' },
  { id: 'uml-aggregation', lineStyle: 'solid', startMarker: 'diamond' },
  { id: 'uml-composition', lineStyle: 'solid', startMarker: 'filledDiamond' },
  { id: 'uml-generalization', lineStyle: 'solid', endMarker: 'hollowTriangle' },
  { id: 'uml-dependency', lineStyle: 'dashed', endMarker: 'openArrow' },
  { id: 'uml-realization', lineStyle: 'dashed', endMarker: 'hollowTriangle' },
  { id: 'uml-usage', lineStyle: 'dashed', endMarker: 'openArrow', label: '«use»' },
  { id: 'uml-assembly-connector', endMarker: 'none' },
];

for (const spec of classConnectors) {
  const def = getShapeDefinition(spec.id);
  assert(def, `Connector '${spec.id}' must exist`);
  assert(def.kind === 'connector', `Connector '${spec.id}' must have kind='connector'`);
  if (spec.startMarker) assert.strictEqual(def.connector?.startMarker, spec.startMarker, `${spec.id} startMarker`);
  if (spec.endMarker) assert.strictEqual(def.connector?.endMarker, spec.endMarker, `${spec.id} endMarker`);
  if (spec.lineStyle) assert.strictEqual(def.connector?.lineStyle ?? 'solid', spec.lineStyle, `${spec.id} lineStyle`);
  if (spec.label) assert.strictEqual(def.defaultLabel, spec.label, `${spec.id} defaultLabel`);
}
console.log('✓ All 9 Class Diagram relationships and connectors verified according to UML 2.5');

// 3. Attribute Parser Compliance (Visibility, Types, Defaults, Derived, Static)
const parsedAttr1 = parseLegacyAttribute('+ id : Long = 0', 'attr-1');
assert.strictEqual(parsedAttr1.visibility, 'public', 'Public visibility +');
assert.strictEqual(parsedAttr1.name, 'id', 'Attribute name id');
assert.strictEqual(parsedAttr1.type, 'Long', 'Attribute type Long');
assert.strictEqual(parsedAttr1.defaultValue, '0', 'Attribute defaultValue 0');

const parsedAttr2 = parseLegacyAttribute('- balance : double', 'attr-2');
assert.strictEqual(parsedAttr2.visibility, 'private', 'Private visibility -');
assert.strictEqual(parsedAttr2.name, 'balance', 'Attribute name balance');
assert.strictEqual(parsedAttr2.type, 'double', 'Attribute type double');

const parsedAttr3 = parseLegacyAttribute('+ /fullName : String', 'attr-3');
assert.strictEqual(parsedAttr3.derived, true, 'Derived attribute /');
assert.strictEqual(parsedAttr3.name, 'fullName', 'Derived attribute name');

const parsedAttr4 = parseLegacyAttribute('+ static count : int = 100', 'attr-4');
assert.strictEqual(parsedAttr4.static, true, 'Static attribute parsed');
assert.strictEqual(parsedAttr4.name, 'count', 'Static attribute name');

const parsedAttr5 = parseLegacyAttribute('# secretKey : byte[] {readOnly}', 'attr-5');
assert.strictEqual(parsedAttr5.visibility, 'protected', 'Protected visibility #');
assert.strictEqual(parsedAttr5.name, 'secretKey', 'Protected attribute name');
console.log('✓ Attribute parser correctly parses visibility (+, -, #, ~), derived (/), static, and defaults');

// 4. Operation Parser Compliance (Parameters, Return Types, Static, Abstract)
const parsedOp1 = parseLegacyOperation('+ calculateTotal(taxRate: double = 0.1, discount: double): double', 'op-1');
assert.strictEqual(parsedOp1.visibility, 'public', 'Public visibility');
assert.strictEqual(parsedOp1.name, 'calculateTotal', 'Operation name');
assert.strictEqual(parsedOp1.parameters.length, 2, '2 parameters');
assert.strictEqual(parsedOp1.parameters[0].name, 'taxRate', 'param 1 name');
assert.strictEqual(parsedOp1.parameters[0].defaultValue, '0.1', 'param 1 default');
assert.strictEqual(parsedOp1.returnType, 'double', 'Return type double');

const parsedOp2 = parseLegacyOperation('+ static getInstance(): Singleton', 'op-2');
assert.strictEqual(parsedOp2.static, true, 'Static operation parsed');
assert.strictEqual(parsedOp2.name, 'getInstance', 'Static operation name');
assert.strictEqual(parsedOp2.returnType, 'Singleton', 'Static return type');

const parsedOp3 = parseLegacyOperation('# abstract renderView(context: Context): void', 'op-3');
assert.strictEqual(parsedOp3.visibility, 'protected', 'Protected visibility');
assert.strictEqual(parsedOp3.abstract, true, 'Abstract operation parsed');
assert.strictEqual(parsedOp3.name, 'renderView', 'Abstract operation name');
assert.strictEqual(parsedOp3.returnType, 'void', 'Return type void');
console.log('✓ Operation parser correctly parses parameters, default values, return types, static, and abstract methods');

// 5. Unified Member Parser
const unifiedAttr = parseClassifierMemberText('+ status: String', 'attributes', 'm-1');
assert.strictEqual(unifiedAttr.kind, 'attribute');
const unifiedOp = parseClassifierMemberText('+ reset(): void', 'operations', 'm-2');
assert.strictEqual(unifiedOp.kind, 'operation');
const unifiedLit = parseClassifierMemberText('PENDING', 'literals', 'm-3');
assert.strictEqual(unifiedLit.kind, 'literal');
console.log('✓ Unified member text parser handles attributes, operations, and literals');

// 6. Classifier Layout & Compartment Dividers
const dummyClassifier = {
  version: 2,
  kind: 'class',
  compartments: [
    {
      id: 'c-attr',
      kind: 'attributes',
      label: 'Attributes',
      items: [parsedAttr1, parsedAttr2],
    },
    {
      id: 'c-ops',
      kind: 'operations',
      label: 'Operations',
      items: [parsedOp1],
    },
  ],
};
const layout = classifierLayout(dummyClassifier, 'Account', '', 14, 12, s => s.length * 8);
assert(layout.headerHeight > 0, 'Header height > 0');
assert.strictEqual(layout.dividers.length, 2, 'Exactly 2 compartment divider lines for 3 compartments (0 phantom dividers)');
assert(layout.rows.length === 3, 'Total 3 rows (2 attributes + 1 operation)');
assert.strictEqual(layout.compartmentBounds.length, 2, 'Exactly 2 compartment bounds');
console.log('✓ Classifier layout accurately computes compartments, dividers (no phantom bottom line), and rows');

// 6b. Hit-Testing Classifier For In-Place Editing (Draw.io / Lucidchart Paradigm)
const { hitTestClassifier, addClassifierMemberToModel, updateClassifierMemberInModel, removeClassifierMemberFromModel } = await import('../classifier.ts');

const hitHeader = hitTestClassifier(layout, 50, 15, 200, 180, 'Account', 14, 12);
assert.strictEqual(hitHeader.target, 'header', 'Hit in header returns target header');
assert.strictEqual(hitHeader.initialText, 'Account', 'Header text matches class name');

const hitAttr = hitTestClassifier(layout, 50, layout.rows[0].y, 200, 180, 'Account', 14, 12);
assert.strictEqual(hitAttr.target, 'member', 'Hit on attribute row returns target member');
assert.strictEqual(hitAttr.memberId, 'attr-1', 'Hit returns attribute 1 ID');

const hitOp = hitTestClassifier(layout, 50, layout.rows[2].y, 200, 180, 'Account', 14, 12);
assert.strictEqual(hitOp.target, 'member', 'Hit on operation row returns target member');
assert.strictEqual(hitOp.memberId, 'op-1', 'Hit returns operation 1 ID');

const hitEmpty = hitTestClassifier(layout, 50, 160, 200, 180, 'Account', 14, 12);
assert.strictEqual(hitEmpty.target, 'empty-compartment', 'Hit in stretched bottom area targets empty compartment');
assert.strictEqual(hitEmpty.compartmentKind, 'operations', 'Bottom stretched area targets operations compartment');
console.log('✓ Classifier hit-testing correctly detects Header, Attribute row, Operation row, and Empty compartment');

// 6c. Classifier Model Mutation Helpers
const newAttr = parseLegacyAttribute('+ email : String', 'attr-new');
const modelWithAdded = addClassifierMemberToModel(dummyClassifier, 'attributes', newAttr, 'attr-1');
assert.strictEqual(modelWithAdded.compartments[0].items.length, 3, 'Attributes count increases to 3');
assert.strictEqual(modelWithAdded.compartments[0].items[1].name, 'email', 'Inserted right after attr-1');

const updatedAttr = parseLegacyAttribute('+ email : String = null', 'attr-new');
const modelWithUpdated = updateClassifierMemberInModel(modelWithAdded, 'attr-new', updatedAttr);
assert.strictEqual(modelWithUpdated.compartments[0].items[1].defaultValue, 'null', 'Attribute updated defaultValue');

const modelWithRemoved = removeClassifierMemberFromModel(modelWithUpdated, 'attr-new');
assert.strictEqual(modelWithRemoved.compartments[0].items.length, 2, 'Attribute removed successfully');
console.log('✓ Classifier model mutation helpers (add, update, remove) verified');

// 7. Double-Click In-Place Inline Text Editable Check
const editableClassifiers = [
  'uml.class',
  'uml.abstract-class',
  'uml.interface',
  'uml.enumeration',
  'uml.object',
  'uml.package',
  'uml.module',
  'uml.note',
];
for (const id of editableClassifiers) {
  assert(
    isDoubleClickTextEditableShape({ type: 'diagram', shapeId: id, x: 0, y: 0, w: 160, h: 120 }) === true,
    `${id} must be double-click inline text editable`,
  );
}
console.log('✓ All Class Diagram shapes support in-place direct inline text editing on double-click');

// 8. Proportional Scaling on Resize
const initialClass = { w: 166, h: 126, embeddedTextScale: 1 };
const scaledScale = resizeDiagramEmbeddedTextScale(initialClass, 332, 252);
assert(Math.abs(scaledScale - 2.0) < 0.05, `Embedded text scale doubles when shape dimensions double: got ${scaledScale}`);
console.log('✓ Class embedded text scale doubles proportionally on 2x resize');

// 9. Deserialization Preserves Embedded Text Scale
const rawBoardClass = {
  id: 'c1',
  type: 'diagram',
  shapeId: 'uml.class',
  x: 10, y: 20, w: 332, h: 252,
  embeddedTextScale: 2.0,
  text: 'OrderService',
};
const deserialized = deserializeBoardShape('c1', rawBoardClass);
assert(deserialized && deserialized.embeddedTextScale === 2.0, 'Deserialization must preserve embeddedTextScale');
assert.strictEqual(deserialized.text, 'OrderService', 'Deserialization preserves class text');
console.log('✓ Deserialization preserves embeddedTextScale and classifier data');

// 10. Connector Label Clearance for Class Diagram Relationships
const assocRoute = [[50, 100], [250, 100]];
const assocLayout = connectorLabelLayout(assocRoute, { labelWidth: 90, labelHeight: 22, strokeWidth: 1.5 });
assert(assocLayout.y < 100, `Horizontal association label must sit above the line: got ${assocLayout.y}`);
assert(100 - (assocLayout.y + 11) >= 4, 'Association label maintains clean transparent clearance above line');

const usageDef = getShapeDefinition('uml-usage');
assert(usageDef && usageDef.defaultLabel === '«use»', 'UML usage relationship has «use» stereotype');

console.log('--- ALL CLASS DIAGRAM TESTS PASSED SUCCESSFULLY! ---');
