import assert from 'node:assert/strict';
import {
  hitTestClassifier,
  classifierLayout,
  hitTestInstance,
  instanceLayout,
  parseLegacyAttribute,
  parseLegacyOperation,
  parseInstanceValueText,
  updateInstanceValueInModel,
  addInstanceValueToModel,
  removeInstanceValueFromModel,
} from '../classifier.ts';
import { getShapeDefinition } from '../registry.ts';

console.log('--- Testing Sub-element Text Editing & Hit-testing for Class & Object ---');

// 1. Classifier Layout & Hit Test
const attr1 = parseLegacyAttribute('+ id: String', 'attr-1');
const attr2 = parseLegacyAttribute('+ name: String', 'attr-2');
const op1 = parseLegacyOperation('+ getProfile(): Profile', 'op-1');

const dummyClassifier = {
  version: 2,
  kind: 'class',
  compartments: [
    {
      id: 'c-attr',
      kind: 'attributes',
      label: 'Attributes',
      items: [attr1, attr2],
    },
    {
      id: 'c-ops',
      kind: 'operations',
      label: 'Operations',
      items: [op1],
    },
  ],
};

const cLayout = classifierLayout(dummyClassifier, 'Customer', '', 14, 12, s => s.length * 8);
assert.ok(cLayout.headerHeight > 0);

// Hit Header
const hitHeader = hitTestClassifier(cLayout, 50, 15, 240, 180, 'Customer', 14, 12);
assert.equal(hitHeader.target, 'header');
assert.equal(hitHeader.initialText, 'Customer');
assert.equal(hitHeader.textAlign, 'center');
console.log('✓ Classifier header hit-test verified');

// Hit Attribute Row 1
const hitAttr1 = hitTestClassifier(cLayout, 50, cLayout.rows[0].y, 240, 180, 'Customer', 14, 12);
assert.equal(hitAttr1.target, 'member');
assert.equal(hitAttr1.memberId, 'attr-1');
assert.equal(hitAttr1.initialText, '+ id: String');
assert.equal(hitAttr1.textAlign, 'left');
assert.ok(hitAttr1.rowBounds.h < 30, 'Row height must be line-sized');
console.log('✓ Classifier attribute row hit-test verified:', hitAttr1.initialText, hitAttr1.rowBounds);

// 2. UML Object (InstanceSpecification) Hit Test
const val1 = parseInstanceValueText('total = 99.99', 'val-1');
const val2 = parseInstanceValueText('status = PAID', 'val-2');

const dummyInstance = {
  version: 2,
  classifierName: 'Order',
  values: [val1, val2],
};

const iLayout = instanceLayout(dummyInstance, 'order1: Order', 14, 12, s => s.length * 8);
assert.ok(iLayout.headerHeight > 0);
assert.equal(iLayout.rows.length, 2);

// Hit Instance Header
const hitInstHeader = hitTestInstance(iLayout, 50, 15, 200, 140, 'order1: Order', 14, 12);
assert.equal(hitInstHeader.target, 'header');
assert.equal(hitInstHeader.initialText, 'order1: Order');
console.log('✓ UML Object header hit-test verified');

// Hit Instance Slot 1
const hitInstVal1 = hitTestInstance(iLayout, 50, iLayout.rows[0].y, 200, 140, 'order1: Order', 14, 12);
assert.equal(hitInstVal1.target, 'member');
assert.equal(hitInstVal1.memberId, 'val-1');
assert.equal(hitInstVal1.initialText, 'total = 99.99');
assert.ok(hitInstVal1.rowBounds.h < 30);
console.log('✓ UML Object slot value hit-test verified:', hitInstVal1.initialText, hitInstVal1.rowBounds);

// 3. UML Instance mutations (Add, Update, Remove)
const updatedInst = updateInstanceValueInModel(dummyInstance, 'val-1', parseInstanceValueText('total = 149.50', 'val-1'));
assert.equal(updatedInst.values[0].value, '149.50');
assert.equal(updatedInst.values[1].value, 'PAID', 'Other values preserved');
console.log('✓ UML Object slot value update verified');

const addedInst = addInstanceValueToModel(updatedInst, parseInstanceValueText('discount = 10', 'val-3'), 'val-1');
assert.equal(addedInst.values.length, 3);
assert.equal(addedInst.values[1].id, 'val-3');
console.log('✓ UML Object slot value addition verified');

const removedInst = removeInstanceValueFromModel(addedInst, 'val-3');
assert.equal(removedInst.values.length, 2);
console.log('✓ UML Object slot value removal verified');

// 4. Registry Category verification
const classDef = getShapeDefinition('uml.class');
assert.equal(classDef?.category, 'Class Diagram');
const usecaseDef = getShapeDefinition('uml.use-case');
assert.equal(usecaseDef?.category, 'Use Case Diagram');
console.log('✓ Categories properly assigned in registry');

console.log('--- ALL HIT-TESTING AND EDITING TESTS PASSED! ---');
