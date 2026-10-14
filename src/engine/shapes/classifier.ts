import type {
  ShapeDefinition,
  UMLClassifierAttribute,
  UMLClassifierCompartment,
  UMLClassifierCompartmentKind,
  UMLClassifierData,
  UMLClassifierKind,
  UMLClassifierLiteral,
  UMLClassifierMember,
  UMLClassifierOperation,
  UMLClassifierParameter,
  UMLInstanceData,
  UMLInstanceValue,
  UMLVisibility,
} from './types';
export type { UMLClassifierCompartmentKind } from './types';

type RecordValue = Record<string, unknown>;
export type TextMeasure = (value: string) => number;

const isRecord = (value: unknown): value is RecordValue => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const VISIBILITIES = new Set<UMLVisibility>(['public', 'protected', 'package', 'private']);
const visibilityFromToken: Record<string, UMLVisibility> = { '+': 'public', '#': 'protected', '~': 'package', '-': 'private' };
const visibilityToToken: Record<UMLVisibility, string> = { public: '+', protected: '#', package: '~', private: '-' };
let idCounter = 0;

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function newClassifierMemberId(prefix = 'member'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stableLegacyId(compartmentId: string, index: number, source: string): string {
  return `legacy-${compartmentId}-${index}-${hashText(source)}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function uniqueId(candidate: unknown, fallback: string, used: Set<string>): string {
  const base = typeof candidate === 'string' && candidate.trim() ? candidate.trim().slice(0, 100) : fallback;
  if (!used.has(base)) { used.add(base); return base; }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const unique = `${base}-${suffix}`;
  used.add(unique);
  return unique;
}

export function classifierKindForShape(shapeId: string): UMLClassifierKind | undefined {
  if (shapeId === 'uml.class') return 'class';
  if (shapeId === 'uml.abstract-class') return 'abstract-class';
  if (shapeId === 'uml.interface') return 'interface';
  if (shapeId === 'uml.enumeration') return 'enumeration';
  if (shapeId === 'uml.object') return 'object';
  return undefined;
}

function compartmentKind(value: unknown, id: unknown, label: unknown, index: number, classifierKind: UMLClassifierKind): UMLClassifierCompartmentKind {
  const token = `${String(value ?? '')} ${String(id ?? '')} ${String(label ?? '')}`.toLowerCase();
  if (token.includes('operation') || token.includes('method')) return 'operations';
  if (token.includes('literal') || token.includes('enum') || (classifierKind === 'enumeration' && index === 0)) return 'literals';
  if (token.includes('value') || token.includes('instance')) return classifierKind === 'object' ? 'values' : 'attributes';
  return 'attributes';
}

function normalizeVisibility(value: unknown): UMLVisibility | undefined {
  return typeof value === 'string' && VISIBILITIES.has(value as UMLVisibility) ? value as UMLVisibility : undefined;
}

function parseVisibility(source: string): { visibility?: UMLVisibility; rest: string } {
  const match = source.match(/^\s*([+#~-])\s*/);
  return match ? { visibility: visibilityFromToken[match[1]], rest: source.slice(match[0].length) } : { rest: source.trimStart() };
}

function parseParameter(source: string, id: string): UMLClassifierParameter {
  const raw = source.trim();
  const equals = raw.indexOf('=');
  const left = equals >= 0 ? raw.slice(0, equals).trim() : raw;
  const defaultValue = equals >= 0 ? raw.slice(equals + 1).trim() : undefined;
  const colon = left.indexOf(':');
  const name = (colon >= 0 ? left.slice(0, colon) : left).trim() || 'parameter';
  const type = colon >= 0 ? left.slice(colon + 1).trim() : '';
  return { id, name, ...(type ? { type } : {}), ...(defaultValue ? { defaultValue } : {}) };
}

function splitParameters(value: string): string[] {
  const items: string[] = [];
  let current = '', angleDepth = 0, roundDepth = 0, squareDepth = 0;
  for (const character of value) {
    if (character === '<') angleDepth++;
    else if (character === '>') angleDepth = Math.max(0, angleDepth - 1);
    else if (character === '(') roundDepth++;
    else if (character === ')') roundDepth = Math.max(0, roundDepth - 1);
    else if (character === '[') squareDepth++;
    else if (character === ']') squareDepth = Math.max(0, squareDepth - 1);
    if (character === ',' && angleDepth === 0 && roundDepth === 0 && squareDepth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

export function formatOperationParameters(parameters: readonly UMLClassifierParameter[] = []): string {
  return parameters.map(parameter => `${parameter.name}${parameter.type ? `: ${parameter.type}` : ''}${parameter.defaultValue ? ` = ${parameter.defaultValue}` : ''}`).join(', ');
}

export function parseOperationParameters(value: string, previous: readonly UMLClassifierParameter[] = []): UMLClassifierParameter[] {
  const oldByName = new Map(previous.map(parameter => [parameter.name, parameter]));
  return splitParameters(value).map((source, index) => {
    const parsed = parseParameter(source, `parameter-${index + 1}`);
    const old = oldByName.get(parsed.name) ?? previous[index];
    return { ...parsed, id: old?.id ?? newClassifierMemberId('parameter') };
  });
}

export function parseLegacyAttribute(source: string, id: string): UMLClassifierAttribute {
  const visibility = parseVisibility(source);
  let rest = visibility.rest;
  const derived = rest.startsWith('/');
  if (derived) rest = rest.slice(1).trimStart();
  let isStatic = false;
  if (/^static\s+/i.test(rest)) {
    isStatic = true;
    rest = rest.replace(/^static\s+/i, '').trimStart();
  }
  const isReadOnly = /\{readOnly\}/i.test(rest);
  if (isReadOnly) rest = rest.replace(/\{readOnly\}/i, '').trim();
  const equals = rest.indexOf('=');
  const declaration = equals >= 0 ? rest.slice(0, equals).trim() : rest.trim();
  const defaultValue = equals >= 0 ? rest.slice(equals + 1).trim() : '';
  const colon = declaration.indexOf(':');
  const name = (colon >= 0 ? declaration.slice(0, colon) : declaration).trim() || source.trim() || 'attribute';
  const type = colon >= 0 ? declaration.slice(colon + 1).trim() : '';
  return { id, kind: 'attribute', name, ...(visibility.visibility ? { visibility: visibility.visibility } : {}),
    ...(type ? { type } : {}), ...(equals >= 0 ? { defaultValue } : {}), ...(derived ? { derived: true } : {}),
    ...(isStatic ? { static: true } : {}), sourceText: source };
}

export function parseLegacyOperation(source: string, id: string): UMLClassifierOperation {
  const visibility = parseVisibility(source);
  let rest = visibility.rest;
  let isStatic = false, isAbstract = false;
  const leadingFlags = rest.match(/^(?:(?:static|abstract)\s+)+/i)?.[0];
  if (leadingFlags) {
    isStatic = /static/i.test(leadingFlags);
    isAbstract = /abstract/i.test(leadingFlags);
    rest = rest.slice(leadingFlags.length);
  }
  const open = rest.indexOf('('), close = open >= 0 ? rest.lastIndexOf(')') : -1;
  const name = (open >= 0 ? rest.slice(0, open) : rest).trim() || source.trim() || 'operation';
  const parameterText = open >= 0 && close > open ? rest.slice(open + 1, close) : '';
  const suffix = close > open ? rest.slice(close + 1).trim() : '';
  const returnType = suffix.startsWith(':') ? suffix.slice(1).trim() : '';
  return { id, kind: 'operation', name, parameters: splitParameters(parameterText).map((parameter, index) =>
    parseParameter(parameter, stableLegacyId(id, index, parameter))), ...(visibility.visibility ? { visibility: visibility.visibility } : {}),
    ...(returnType ? { returnType } : {}), ...(isAbstract ? { abstract: true } : {}), ...(isStatic ? { static: true } : {}), sourceText: source };
}

export function parseClassifierMemberText(
  source: string,
  kind: UMLClassifierCompartmentKind,
  id = newClassifierMemberId(kind),
): UMLClassifierMember | UMLInstanceValue {
  if (kind === 'operations') return parseLegacyOperation(source, id);
  if (kind === 'literals') return { id, kind: 'literal', name: source.trim(), sourceText: source };
  if (kind === 'values') return normalizeInstanceValue(source, id, 0);
  return parseLegacyAttribute(source, id);
}

function normalizeAttribute(value: unknown, id: string, index: number): UMLClassifierAttribute {
  if (typeof value === 'string') return parseLegacyAttribute(value, id);
  const raw = isRecord(value) ? value : {};
  return { ...raw, id, kind: 'attribute', name: stringValue(raw.name, `attribute${index + 1}`),
    ...(normalizeVisibility(raw.visibility) ? { visibility: normalizeVisibility(raw.visibility) } : { visibility: undefined }),
    ...(typeof raw.type === 'string' ? { type: raw.type } : { type: undefined }),
    ...(typeof raw.defaultValue === 'string' ? { defaultValue: raw.defaultValue } : { defaultValue: undefined }),
    ...(raw.derived === true ? { derived: true } : { derived: false }),
    ...(raw.static === true ? { static: true } : { static: false }),
    ...(typeof raw.sourceText === 'string' ? { sourceText: raw.sourceText } : {}) } as UMLClassifierAttribute;
}

function normalizeOperation(value: unknown, id: string, index: number): UMLClassifierOperation {
  if (typeof value === 'string') return parseLegacyOperation(value, id);
  const raw = isRecord(value) ? value : {};
  const rawParameters = Array.isArray(raw.parameters) ? raw.parameters : [];
  const usedParameters = new Set<string>();
  const parameters = rawParameters.map((parameter, parameterIndex) => {
    const parameterRecord = isRecord(parameter) ? parameter : {};
    const source = typeof parameter === 'string' ? parameter : '';
    const parameterId = uniqueId(parameterRecord.id, stableLegacyId(id, parameterIndex, source || JSON.stringify(parameter) || String(parameter)), usedParameters);
    if (typeof parameter === 'string') return parseParameter(parameter, parameterId);
    return { ...parameterRecord, id: parameterId, name: stringValue(parameterRecord.name, `parameter${parameterIndex + 1}`),
      ...(typeof parameterRecord.type === 'string' ? { type: parameterRecord.type } : {}),
      ...(typeof parameterRecord.defaultValue === 'string' ? { defaultValue: parameterRecord.defaultValue } : {}) } as UMLClassifierParameter;
  });
  const visibility = normalizeVisibility(raw.visibility);
  return { ...raw, id, kind: 'operation', name: stringValue(raw.name, `operation${index + 1}`), parameters,
    ...(visibility ? { visibility } : { visibility: undefined }),
    ...(typeof raw.returnType === 'string' ? { returnType: raw.returnType } : { returnType: undefined }),
    ...(raw.abstract === true ? { abstract: true } : { abstract: false }),
    ...(raw.static === true ? { static: true } : { static: false }),
    ...(typeof raw.sourceText === 'string' ? { sourceText: raw.sourceText } : {}) } as UMLClassifierOperation;
}

function normalizeLiteral(value: unknown, id: string, index: number): UMLClassifierLiteral {
  if (typeof value === 'string') return { id, kind: 'literal', name: value, sourceText: value };
  const raw = isRecord(value) ? value : {};
  return { ...raw, id, kind: 'literal', name: stringValue(raw.name, `LITERAL_${index + 1}`),
    ...(typeof raw.sourceText === 'string' ? { sourceText: raw.sourceText } : {}) } as UMLClassifierLiteral;
}

function normalizeInstanceValue(value: unknown, id: string, index: number): UMLInstanceValue {
  if (typeof value === 'string') {
    const equals = value.indexOf('=');
    const declaration = equals >= 0 ? value.slice(0, equals).trim() : value.trim();
    const colon = declaration.indexOf(':');
    const name = (colon >= 0 ? declaration.slice(0, colon) : declaration).trim() || `attribute${index + 1}`;
    const type = colon >= 0 ? declaration.slice(colon + 1).trim() : '';
    return { id, kind: 'value', name, ...(equals >= 0 ? { value: value.slice(equals + 1).trim() } : {}), ...(type ? { type } : {}), sourceText: value };
  }
  const raw = isRecord(value) ? value : {};
  return { ...raw, id, kind: 'value', name: stringValue(raw.name, `attribute${index + 1}`),
    ...(typeof raw.value === 'string' ? { value: raw.value } : { value: undefined }),
    ...(typeof raw.type === 'string' ? { type: raw.type } : { type: undefined }),
    ...(typeof raw.sourceText === 'string' ? { sourceText: raw.sourceText } : {}) } as UMLInstanceValue;
}

function normalizeCompartment(rawValue: unknown, index: number, kind: UMLClassifierKind): UMLClassifierCompartment {
  const raw = isRecord(rawValue) ? rawValue : {};
  const sourceItems = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.members) ? raw.members : [];
  const rawId = stringValue(raw.id, `compartment-${index + 1}`);
  const kindValue = compartmentKind(raw.kind, raw.id, raw.label, index, kind);
  const used = new Set<string>();
  const items = sourceItems.map((value, rowIndex) => {
    const rawRow = isRecord(value) ? value : null;
    const legacyString = typeof value === 'string' ? value : '';
    const rowId = uniqueId(rawRow?.id, stableLegacyId(rawId, rowIndex, legacyString || JSON.stringify(value) || String(value)), used);
    if (kindValue === 'operations') return normalizeOperation(value, rowId, rowIndex);
    if (kindValue === 'literals') return normalizeLiteral(value, rowId, rowIndex);
    return normalizeAttribute(value, rowId, rowIndex);
  });
  const defaultLabel = kindValue === 'attributes' ? 'Attributes' : kindValue === 'operations' ? 'Operations'
    : kindValue === 'literals' ? 'Literals' : 'Values';
  return { ...raw, id: rawId, kind: kindValue, label: stringValue(raw.label, defaultLabel), items } as UMLClassifierCompartment;
}

function defaultCompartments(definition: ShapeDefinition): unknown[] {
  const classifier = definition.defaultData?.classifier;
  return isRecord(classifier) && Array.isArray(classifier.compartments) ? classifier.compartments : [];
}

function compartmentsFromLegacyClassifier(value: unknown): unknown[] {
  return isRecord(value) && Array.isArray(value.compartments) ? value.compartments : [];
}

function instanceValuesFromLegacyClassifier(value: unknown): unknown[] {
  return compartmentsFromLegacyClassifier(value).flatMap((compartment, index) => {
    const record = isRecord(compartment) ? compartment : {};
    const entries = Array.isArray(record.items) ? record.items : [];
    return entries.map((entry, rowIndex) => {
      if (typeof entry !== 'string') return entry;
      const id = stringValue(record.id, `legacy-values-${index}`);
      return normalizeInstanceValue(entry, stableLegacyId(id, rowIndex, entry), rowIndex);
    });
  });
}

export function normalizeUmlStructuredData(
  definition: ShapeDefinition,
  mergedData: Record<string, unknown>,
  rawData: Record<string, unknown> = mergedData,
): Record<string, unknown> {
  const kind = classifierKindForShape(definition.id);
  if (!kind) return mergedData;
  if (kind === 'object') {
    const legacyClassifier = rawData.classifier;
    const rawInstance = isRecord(rawData.instance) ? rawData.instance : isRecord(mergedData.instance) ? mergedData.instance : {};
    const defaultInstance = isRecord(definition.defaultData?.instance) ? definition.defaultData!.instance as RecordValue : {};
    const explicitInstance = isRecord(rawData.instance) && Array.isArray(rawData.instance.values);
    const valuesSource = explicitInstance && Array.isArray(rawInstance.values) ? rawInstance.values
      : legacyClassifier ? instanceValuesFromLegacyClassifier(legacyClassifier)
        : Array.isArray(rawInstance.values) ? rawInstance.values
          : Array.isArray(defaultInstance.values) ? defaultInstance.values : [];
    const used = new Set<string>();
    const values = valuesSource.map((value, index) => {
      const record = isRecord(value) ? value : null;
      const text = typeof value === 'string' ? value : '';
      const id = uniqueId(record?.id, stableLegacyId('instance-values', index, text || JSON.stringify(value)), used);
      return normalizeInstanceValue(value, id, index);
    });
    const instance = { ...defaultInstance, ...rawInstance, version: 2, kind: 'object', values } as UMLInstanceData;
    return { ...mergedData, instance };
  }

  const rawClassifier = isRecord(rawData.classifier) ? rawData.classifier
    : isRecord(mergedData.classifier) ? mergedData.classifier : {};
  const fallback = defaultCompartments(definition);
  const rawCompartments = Array.isArray(rawClassifier.compartments) ? rawClassifier.compartments : fallback;
  const compartments = rawCompartments.map((compartment, index) => normalizeCompartment(compartment, index, kind));
  const classifier = { ...rawClassifier, version: 2, kind, compartments } as UMLClassifierData;
  return { ...mergedData, classifier };
}

export function createClassifierMember(kind: UMLClassifierCompartmentKind, index = 0): UMLClassifierMember | UMLInstanceValue {
  const id = newClassifierMemberId(kind);
  if (kind === 'operations') return { id, kind: 'operation', name: `operation${index + 1}`, visibility: 'public', parameters: [] };
  if (kind === 'literals') return { id, kind: 'literal', name: `VALUE_${index + 1}` };
  if (kind === 'values') return { id, kind: 'value', name: `attribute${index + 1}`, value: '' };
  return { id, kind: 'attribute', name: `attribute${index + 1}`, visibility: 'public', type: 'String' };
}

export function classifierVisibilityToken(visibility?: UMLVisibility): string {
  return visibility ? visibilityToToken[visibility] : '';
}

export function formatClassifierMember(member: UMLClassifierMember): string {
  if (member.sourceText !== undefined) return member.sourceText;
  if (member.kind === 'literal') return member.name;
  const visibility = classifierVisibilityToken(member.visibility);
  if (member.kind === 'attribute') return `${visibility}${member.derived ? '/' : ''}${member.name}${member.type ? ` : ${member.type}` : ''}${member.defaultValue ? ` = ${member.defaultValue}` : ''}`;
  return `${visibility}${member.name}(${formatOperationParameters(member.parameters)})${member.returnType ? `: ${member.returnType}` : ''}`;
}

export function formatInstanceValue(member: UMLInstanceValue): string {
  if (member.sourceText !== undefined) return member.sourceText;
  return `${member.name}${member.type ? ` : ${member.type}` : ''}${member.value !== undefined && member.value !== '' ? ` = ${member.value}` : ''}`;
}

export interface ClassifierTextRow {
  compartmentId: string;
  compartmentKind: UMLClassifierCompartmentKind;
  member: UMLClassifierMember;
  text: string;
  y: number;
}

export interface ClassifierCompartmentBound {
  id: string;
  kind: UMLClassifierCompartmentKind;
  label: string;
  top: number;
  bottom: number;
  itemsCount: number;
}

export interface ClassifierLayout {
  minWidth: number;
  minHeight: number;
  headerHeight: number;
  rowHeight: number;
  dividers: number[];
  rows: ClassifierTextRow[];
  paddingX: number;
  compartmentBounds: ClassifierCompartmentBound[];
}

export function classifierLayout(
  model: UMLClassifierData,
  name: string,
  stereotype: string,
  titleFontSize: number,
  bodyFontSize: number,
  measure: TextMeasure,
): ClassifierLayout {
  const paddingX = Math.max(12, bodyFontSize * 0.9);
  const titleLine = Math.max(18, titleFontSize * 1.35);
  const stereotypeLine = stereotype ? Math.max(16, bodyFontSize * 1.2) : 0;
  const headerHeight = Math.max(38, 16 + titleLine + stereotypeLine);
  const rowHeight = Math.max(18, bodyFontSize * 1.42);
  const dividers = [headerHeight];
  const rows: ClassifierTextRow[] = [];
  const compartmentBounds: ClassifierCompartmentBound[] = [];
  let y = headerHeight;
  let maxTextWidth = Math.max(measure(name), stereotype ? measure(stereotype) : 0);
  for (let cIdx = 0; cIdx < model.compartments.length; cIdx++) {
    const compartment = model.compartments[cIdx];
    const compTop = y;
    if (compartment.items.length === 0) {
      y += Math.max(18, rowHeight);
    } else {
      for (const member of compartment.items) {
        const text = formatClassifierMember(member);
        maxTextWidth = Math.max(maxTextWidth, measure(text) + (member.kind === 'attribute' && member.static ? 2 : 0));
        rows.push({ compartmentId: compartment.id, compartmentKind: compartment.kind, member, text, y: y + rowHeight / 2 });
        y += rowHeight;
      }
    }
    compartmentBounds.push({
      id: compartment.id,
      kind: compartment.kind,
      label: compartment.label,
      top: compTop,
      bottom: y,
      itemsCount: compartment.items.length,
    });
    // OMG UML 2.5 & Draw.io/Lucidchart/StarUML rule:
    // Dividers are strictly drawn BETWEEN compartments. Never after the last compartment!
    if (cIdx < model.compartments.length - 1) {
      dividers.push(y);
    }
  }
  const bottomPadding = Math.max(10, bodyFontSize * 0.75);
  return { minWidth: Math.max(150, maxTextWidth + paddingX * 2), minHeight: Math.max(70, y + bottomPadding),
    headerHeight, rowHeight, dividers, rows, paddingX, compartmentBounds };
}

export interface ClassifierHitResult {
  target: 'header' | 'member' | 'empty-compartment';
  compartmentId?: string;
  compartmentKind?: UMLClassifierCompartmentKind;
  memberId?: string;
  memberIndex?: number;
  initialText: string;
  rowBounds: { x: number; y: number; w: number; h: number };
  fontSize: number;
  textAlign: 'left' | 'center';
}

export function hitTestClassifier(
  layout: ClassifierLayout,
  _localX: number,
  localY: number,
  shapeWidth: number,
  shapeHeight: number,
  currentName: string,
  titleFontSize: number,
  bodyFontSize: number,
): ClassifierHitResult {
  const padX = layout.paddingX;
  const contentWidth = Math.max(40, shapeWidth - padX * 2);

  // 1. Header hit
  if (localY <= layout.headerHeight) {
    return {
      target: 'header',
      initialText: currentName,
      rowBounds: { x: padX, y: 0, w: contentWidth, h: layout.headerHeight },
      fontSize: titleFontSize,
      textAlign: 'center',
    };
  }

  // 2. Existing row hit
  for (let i = 0; i < layout.rows.length; i++) {
    const row = layout.rows[i];
    const rowTop = row.y - layout.rowHeight / 2;
    const rowBottom = row.y + layout.rowHeight / 2;
    if (localY >= rowTop && localY < rowBottom) {
      return {
        target: 'member',
        compartmentId: row.compartmentId,
        compartmentKind: row.compartmentKind,
        memberId: row.member.id,
        memberIndex: i,
        initialText: row.text,
        rowBounds: { x: padX, y: rowTop, w: contentWidth, h: layout.rowHeight },
        fontSize: bodyFontSize,
        textAlign: 'left',
      };
    }
  }

  // 3. Fallback: hit in a compartment area (empty space in compartment)
  for (const comp of layout.compartmentBounds) {
    if (localY >= comp.top && localY <= Math.max(comp.bottom, comp.top + layout.rowHeight)) {
      return {
        target: 'empty-compartment',
        compartmentId: comp.id,
        compartmentKind: comp.kind,
        initialText: comp.kind === 'operations' ? '+ method()' : '+ attribute : String',
        rowBounds: { x: padX, y: comp.bottom - layout.rowHeight, w: contentWidth, h: layout.rowHeight },
        fontSize: bodyFontSize,
        textAlign: 'left',
      };
    }
  }

  // 4. Hit below all compartments (extra stretched space at bottom): assign to last compartment (Operations)
  const lastComp = layout.compartmentBounds[layout.compartmentBounds.length - 1];
  if (lastComp) {
    return {
      target: 'empty-compartment',
      compartmentId: lastComp.id,
      compartmentKind: lastComp.kind,
      initialText: lastComp.kind === 'operations' ? '+ method()' : '+ attribute : String',
      rowBounds: { x: padX, y: Math.min(shapeHeight - layout.rowHeight, lastComp.bottom), w: contentWidth, h: layout.rowHeight },
      fontSize: bodyFontSize,
      textAlign: 'left',
    };
  }

  return {
    target: 'header',
    initialText: currentName,
    rowBounds: { x: padX, y: 0, w: contentWidth, h: layout.headerHeight },
    fontSize: titleFontSize,
    textAlign: 'center',
  };
}

export function updateClassifierMemberInModel(
  model: UMLClassifierData,
  memberId: string,
  updatedMember: UMLClassifierMember,
): UMLClassifierData {
  return {
    ...model,
    compartments: model.compartments.map(comp => ({
      ...comp,
      items: comp.items.map(item => item.id === memberId ? updatedMember : item),
    })),
  };
}

export function addClassifierMemberToModel(
  model: UMLClassifierData,
  compartmentKind: UMLClassifierCompartmentKind,
  newMember: UMLClassifierMember,
  afterMemberId?: string,
): UMLClassifierData {
  return {
    ...model,
    compartments: model.compartments.map(comp => {
      if (comp.kind !== compartmentKind) return comp;
      const items = [...comp.items];
      if (afterMemberId) {
        const idx = items.findIndex(item => item.id === afterMemberId);
        if (idx >= 0) {
          items.splice(idx + 1, 0, newMember);
          return { ...comp, items };
        }
      }
      items.push(newMember);
      return { ...comp, items };
    }),
  };
}

export function removeClassifierMemberFromModel(
  model: UMLClassifierData,
  memberId: string,
): UMLClassifierData {
  return {
    ...model,
    compartments: model.compartments.map(comp => ({
      ...comp,
      items: comp.items.filter(item => item.id !== memberId),
    })),
  };
}

export interface InstanceLayout {
  minWidth: number;
  minHeight: number;
  headerHeight: number;
  rowHeight: number;
  dividers: number[];
  rows: Array<{ member: UMLInstanceValue; text: string; y: number }>;
  paddingX: number;
}

export function instanceLayout(
  model: UMLInstanceData,
  name: string,
  titleFontSize: number,
  bodyFontSize: number,
  measure: TextMeasure,
): InstanceLayout {
  const paddingX = Math.max(12, bodyFontSize * 0.9);
  const headerHeight = Math.max(38, titleFontSize * 1.8 + 14);
  const rowHeight = Math.max(18, bodyFontSize * 1.42);
  const rows = model.values.map((member, index) => ({ member, text: formatInstanceValue(member), y: headerHeight + rowHeight * (index + 0.5) }));
  const maxTextWidth = Math.max(measure(name), ...rows.map(row => measure(row.text)));
  const minHeight = headerHeight + model.values.length * rowHeight + Math.max(10, bodyFontSize * 0.75);
  return { minWidth: Math.max(150, maxTextWidth + paddingX * 2), minHeight: Math.max(60, minHeight),
    headerHeight, rowHeight, dividers: [headerHeight], rows, paddingX };
}

export function hitTestInstance(
  layout: InstanceLayout,
  _localX: number,
  localY: number,
  shapeWidth: number,
  shapeHeight: number,
  currentName: string,
  titleFontSize: number,
  bodyFontSize: number,
): ClassifierHitResult {
  const padX = layout.paddingX;
  const contentWidth = Math.max(40, shapeWidth - padX * 2);

  // 1. Header hit
  if (localY <= layout.headerHeight) {
    return {
      target: 'header',
      initialText: currentName,
      rowBounds: { x: padX, y: 0, w: contentWidth, h: layout.headerHeight },
      fontSize: titleFontSize,
      textAlign: 'center',
    };
  }

  // 2. Existing row hit
  for (let i = 0; i < layout.rows.length; i++) {
    const row = layout.rows[i];
    const rowTop = row.y - layout.rowHeight / 2;
    const rowBottom = row.y + layout.rowHeight / 2;
    if (localY >= rowTop && localY < rowBottom) {
      return {
        target: 'member',
        compartmentKind: 'values',
        memberId: row.member.id,
        memberIndex: i,
        initialText: row.text,
        rowBounds: { x: padX, y: rowTop, w: contentWidth, h: layout.rowHeight },
        fontSize: bodyFontSize,
        textAlign: 'left',
      };
    }
  }

  // 3. Fallback: empty space below existing values
  const lastRowBottom = layout.headerHeight + layout.rows.length * layout.rowHeight;
  return {
    target: 'empty-compartment',
    compartmentKind: 'values',
    initialText: 'attribute = value',
    rowBounds: { x: padX, y: Math.min(shapeHeight - layout.rowHeight, lastRowBottom), w: contentWidth, h: layout.rowHeight },
    fontSize: bodyFontSize,
    textAlign: 'left',
  };
}

export function parseInstanceValueText(text: string, id?: string): UMLInstanceValue {
  const trimmed = text.trim();
  const eqIdx = trimmed.indexOf('=');
  const namePart = eqIdx >= 0 ? trimmed.slice(0, eqIdx).trim() : trimmed;
  const valPart = eqIdx >= 0 ? trimmed.slice(eqIdx + 1).trim() : '';
  const colonIdx = namePart.indexOf(':');
  let name = namePart;
  let type: string | undefined;
  if (colonIdx >= 0) {
    name = namePart.slice(0, colonIdx).trim();
    type = namePart.slice(colonIdx + 1).trim() || undefined;
  }
  return {
    id: id ?? newClassifierMemberId('values'),
    kind: 'value',
    name: name || 'attribute',
    type,
    value: valPart,
    sourceText: trimmed,
  };
}

export function updateInstanceValueInModel(
  model: UMLInstanceData,
  memberId: string,
  updatedValue: UMLInstanceValue,
): UMLInstanceData {
  return {
    ...model,
    values: model.values.map(val => val.id === memberId ? updatedValue : val),
  };
}

export function addInstanceValueToModel(
  model: UMLInstanceData,
  newValue: UMLInstanceValue,
  afterMemberId?: string,
): UMLInstanceData {
  const values = [...model.values];
  if (afterMemberId) {
    const idx = values.findIndex(v => v.id === afterMemberId);
    if (idx >= 0) {
      values.splice(idx + 1, 0, newValue);
      return { ...model, values };
    }
  }
  values.push(newValue);
  return { ...model, values };
}

export function removeInstanceValueFromModel(
  model: UMLInstanceData,
  memberId: string,
): UMLInstanceData {
  return {
    ...model,
    values: model.values.filter(val => val.id !== memberId),
  };
}


