import { parse } from "@babel/parser";
import * as t from "@babel/types";
import * as z from "zod";

import {
  IconSchema as BuiltinIconSchema,
  ImageSchema as BuiltinImageSchema,
} from "@/app/presentation-templates/defaultSchemes";

export type CompiledTemplateSchema = {
  layoutDescription: string;
  layoutId: string;
  layoutName: string;
  schemaJSON: unknown;
};

type LayoutIntelligence = {
  avoidFor: string[];
  bestFor: string[];
  cropRisk: "low" | "medium" | "high";
  imageFieldNames: string[];
  imageSlotSummary: string;
  mediaBehavior: string[];
};

type ExtractedDeclaration = {
  init: t.Expression;
  initSource: string;
  name: string;
  order: number;
};

/** Imported from `defaultSchemes`; not always present as `const` in layout source. */
const BUILTIN_SHARED_SCHEMA_IDENTIFIERS = new Set(["ImageSchema", "IconSchema"]);

const DANGEROUS_MEMBER_NAMES = new Set([
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "__proto__",
  "apply",
  "bind",
  "call",
  "constructor",
  "eval",
  "prototype",
]);

function normalizeHardcodedBackendUrlsInCode(layoutCode: string): string {
  return layoutCode.replace(
    /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0):(?:8000|5000|5001)(?=\/(?:app_data|static)\/)/g,
    ""
  );
}

function unwrapExpression(node: t.Expression): t.Expression {
  if (
    t.isParenthesizedExpression(node) ||
    t.isTSAsExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isTSNonNullExpression(node)
  ) {
    return unwrapExpression(node.expression as t.Expression);
  }

  return node;
}

function getRootIdentifier(node: t.Expression): string | null {
  const expression = unwrapExpression(node);

  if (t.isIdentifier(expression)) {
    return expression.name;
  }

  if (t.isMemberExpression(expression)) {
    return getRootIdentifier(expression.object as t.Expression);
  }

  if (t.isCallExpression(expression)) {
    return getRootIdentifier(expression.callee as t.Expression);
  }

  return null;
}

function getStaticStringValue(node: t.Expression | null | undefined): string | null {
  if (!node) {
    return null;
  }

  const expression = unwrapExpression(node);

  if (t.isStringLiteral(expression)) {
    return expression.value;
  }

  if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
    return expression.quasis
      .map((quasi) => quasi.value.cooked ?? quasi.value.raw ?? "")
      .join("");
  }

  return null;
}

function extractTopLevelDeclarations(source: string): Map<string, ExtractedDeclaration> {
  const program = parse(source, {
    plugins: ["jsx", "typescript"],
    sourceType: "module",
  }).program;

  const declarations = new Map<string, ExtractedDeclaration>();
  let order = 0;

  for (const statement of program.body) {
    const declaration = t.isExportNamedDeclaration(statement)
      ? statement.declaration
      : statement;

    if (!declaration || !t.isVariableDeclaration(declaration)) {
      continue;
    }

    for (const declarator of declaration.declarations) {
      if (!t.isIdentifier(declarator.id) || !declarator.init) {
        continue;
      }

      declarations.set(declarator.id.name, {
        init: unwrapExpression(declarator.init as t.Expression),
        initSource: source.slice(declarator.init.start ?? 0, declarator.init.end ?? 0),
        name: declarator.id.name,
        order: order++,
      });
    }
  }

  return declarations;
}

function readStringDeclaration(
  declarations: Map<string, ExtractedDeclaration>,
  name: string
): string | null {
  return getStaticStringValue(declarations.get(name)?.init);
}

function readFirstStringDeclaration(
  declarations: Map<string, ExtractedDeclaration>,
  names: string[]
): string | null {
  for (const name of names) {
    const value = readStringDeclaration(declarations, name);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function isAllowedIdentifier(
  declarations: Map<string, ExtractedDeclaration>,
  name: string
): boolean {
  return (
    name === "z" ||
    name === "undefined" ||
    BUILTIN_SHARED_SCHEMA_IDENTIFIERS.has(name) ||
    declarations.has(name)
  );
}

function assertSafeMemberName(property: t.Identifier): void {
  if (DANGEROUS_MEMBER_NAMES.has(property.name)) {
    throw new Error(`Unsupported member access: ${property.name}`);
  }
}

function collectDependenciesForDeclaration(
  declarations: Map<string, ExtractedDeclaration>,
  currentDeclaration: string,
  expression: t.Expression
): Set<string> {
  const dependencies = new Set<string>();

  const addDependency = (name: string) => {
    if (
      name !== "z" &&
      name !== "undefined" &&
      !BUILTIN_SHARED_SCHEMA_IDENTIFIERS.has(name) &&
      name !== currentDeclaration
    ) {
      dependencies.add(name);
    }
  };

  const validateMemberExpression = (node: t.MemberExpression) => {
    if (node.computed || !t.isIdentifier(node.property)) {
      throw new Error("Computed member access is not supported in template schemas");
    }

    assertSafeMemberName(node.property);

    const rootIdentifier = getRootIdentifier(node);
    if (!rootIdentifier || !isAllowedIdentifier(declarations, rootIdentifier)) {
      throw new Error(`Unsupported member access root: ${rootIdentifier ?? node.type}`);
    }

    validateExpression(node.object as t.Expression);
  };

  const validateCallExpression = (node: t.CallExpression) => {
    const callee = unwrapExpression(node.callee as t.Expression);

    if (t.isIdentifier(callee)) {
      throw new Error(`Unsupported direct function call: ${callee.name}`);
    }

    if (t.isMemberExpression(callee)) {
      validateMemberExpression(callee);
    } else if (t.isCallExpression(callee)) {
      validateCallExpression(callee);
    } else {
      throw new Error(`Unsupported callee type: ${callee.type}`);
    }

    for (const argument of node.arguments) {
      if (t.isSpreadElement(argument)) {
        validateExpression(argument.argument);
        continue;
      }

      if (!t.isExpression(argument)) {
        throw new Error("Unsupported call argument");
      }

      validateExpression(argument);
    }
  };

  const validateObjectProperty = (node: t.ObjectProperty) => {
    if (node.computed) {
      if (!t.isExpression(node.key)) {
        throw new Error("Unsupported computed object key");
      }
      validateExpression(node.key);
    } else if (
      !t.isIdentifier(node.key) &&
      !t.isStringLiteral(node.key) &&
      !t.isNumericLiteral(node.key)
    ) {
      throw new Error(`Unsupported object key type: ${node.key.type}`);
    }

    if (!t.isExpression(node.value)) {
      throw new Error("Unsupported object property value");
    }

    validateExpression(node.value);
  };

  const validateExpression = (node: t.Expression) => {
    const expressionNode = unwrapExpression(node);

    if (
      t.isStringLiteral(expressionNode) ||
      t.isNumericLiteral(expressionNode) ||
      t.isBooleanLiteral(expressionNode) ||
      t.isNullLiteral(expressionNode) ||
      t.isBigIntLiteral(expressionNode) ||
      t.isRegExpLiteral(expressionNode)
    ) {
      return;
    }

    if (t.isIdentifier(expressionNode)) {
      if (!isAllowedIdentifier(declarations, expressionNode.name)) {
        throw new Error(`Unsupported identifier: ${expressionNode.name}`);
      }

      addDependency(expressionNode.name);
      return;
    }

    if (t.isTemplateLiteral(expressionNode)) {
      if (expressionNode.expressions.length > 0) {
        throw new Error("Dynamic template literals are not supported in template schemas");
      }
      return;
    }

    if (t.isArrayExpression(expressionNode)) {
      for (const element of expressionNode.elements) {
        if (!element) {
          continue;
        }

        if (t.isSpreadElement(element)) {
          validateExpression(element.argument);
          continue;
        }

        validateExpression(element);
      }
      return;
    }

    if (t.isObjectExpression(expressionNode)) {
      for (const property of expressionNode.properties) {
        if (t.isSpreadElement(property)) {
          validateExpression(property.argument);
          continue;
        }

        if (!t.isObjectProperty(property)) {
          throw new Error(`Unsupported object property type: ${property.type}`);
        }

        validateObjectProperty(property);
      }
      return;
    }

    if (t.isMemberExpression(expressionNode)) {
      validateMemberExpression(expressionNode);
      return;
    }

    if (t.isCallExpression(expressionNode)) {
      validateCallExpression(expressionNode);
      return;
    }

    if (t.isUnaryExpression(expressionNode)) {
      if (!["!", "+", "-", "void"].includes(expressionNode.operator)) {
        throw new Error(`Unsupported unary operator: ${expressionNode.operator}`);
      }

      validateExpression(expressionNode.argument);
      return;
    }

    throw new Error(`Unsupported expression type: ${expressionNode.type}`);
  };

  validateExpression(expression);
  return dependencies;
}

function buildSchemaRuntimeSource(
  declarations: Map<string, ExtractedDeclaration>
): string {
  const requiredDeclarations = new Set<string>();
  const visiting = new Set<string>();

  const visitDeclaration = (name: string) => {
    if (requiredDeclarations.has(name)) {
      return;
    }

    if (visiting.has(name)) {
      throw new Error(`Circular schema declaration detected: ${name}`);
    }

    const declaration = declarations.get(name);
    if (!declaration) {
      throw new Error(`Missing declaration: ${name}`);
    }

    visiting.add(name);
    const dependencies = collectDependenciesForDeclaration(
      declarations,
      name,
      declaration.init
    );

    for (const dependency of dependencies) {
      visitDeclaration(dependency);
    }

    visiting.delete(name);
    requiredDeclarations.add(name);
  };

  visitDeclaration("Schema");

  return Array.from(declarations.values())
    .filter((declaration) => requiredDeclarations.has(declaration.name))
    .sort((left, right) => left.order - right.order)
    .map(
      (declaration) =>
        `const ${declaration.name} = ${declaration.initSource};`
    )
    .join("\n");
}

function isZodSchema(value: unknown): value is z.ZodTypeAny {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as z.ZodTypeAny).safeParse === "function"
  );
}

function countMatches(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectImageFieldsFromSchema(
  schema: unknown,
  path: string[] = []
): string[] {
  if (!isRecord(schema)) {
    return [];
  }

  const properties = schema.properties;
  if (isRecord(properties)) {
    const propertyNames = Object.keys(properties);
    const hasImageUrl = propertyNames.includes("__image_url__");
    const hasImagePrompt = propertyNames.includes("__image_prompt__");

    if (hasImageUrl || hasImagePrompt) {
      return [path.join(".") || "image"];
    }

    return propertyNames.flatMap((name) =>
      collectImageFieldsFromSchema(properties[name], [...path, name])
    );
  }

  const items = schema.items;
  if (items) {
    return collectImageFieldsFromSchema(items, [...path, "[]"]);
  }

  return [];
}

function getTopLevelImageSlotSummary(schema: unknown): string {
  const fields = collectImageFieldsFromSchema(schema);

  if (fields.length === 0) {
    return "no explicit image slots";
  }

  const hasArrayImage = fields.some((field) => field.includes("[]"));
  const slotCount =
    fields.length === 1
      ? "1 image-capable field"
      : `${fields.length} image-capable fields`;

  return hasArrayImage ? `${slotCount}, including repeatable image arrays` : slotCount;
}

function inferLayoutIntent(layoutName: string, layoutDescription: string): {
  avoidFor: string[];
  bestFor: string[];
} {
  const text = `${layoutName} ${layoutDescription}`.toLowerCase();
  const bestFor: string[] = [];
  const avoidFor: string[] = [];

  if (text.includes("gallery") || text.includes("team") || text.includes("member")) {
    bestFor.push("decorative photo sets, people cards, visual variety");
    avoidFor.push("scientific source figures, dense charts, screenshots, tables");
  }

  if (text.includes("chart") || text.includes("dashboard") || text.includes("metric")) {
    bestFor.push("summaries, KPIs, generated charts, performance snapshots");
    avoidFor.push("verbatim paper figures unless the figure is already simple and readable");
  }

  if (text.includes("table")) {
    bestFor.push("structured comparisons and compact tabular information");
  }

  if (
    text.includes("image") &&
    !text.includes("gallery") &&
    !text.includes("team")
  ) {
    bestFor.push("one supporting visual paired with explanatory text");
  }

  if (text.includes("cover") || text.includes("intro") || text.includes("hero")) {
    bestFor.push("opening slides and broad visual framing");
    avoidFor.push("evidence figures that must remain uncropped");
  }

  if (bestFor.length === 0) {
    bestFor.push("text-led explanation or structured slide content");
  }

  return {
    avoidFor: unique(avoidFor),
    bestFor: unique(bestFor),
  };
}

function buildLayoutIntelligence(
  layoutCode: string,
  layoutName: string,
  layoutDescription: string,
  schemaJSON: unknown
): LayoutIntelligence {
  const objectCoverCount = countMatches(layoutCode, /\bobject-cover\b/g);
  const objectContainCount = countMatches(layoutCode, /\bobject-contain\b/g);
  const backgroundCoverCount = countMatches(
    layoutCode,
    /backgroundSize:\s*["']cover["']|\bbg-cover\b/g
  );
  const backgroundContainCount = countMatches(
    layoutCode,
    /backgroundSize:\s*["']contain["']|\bbg-contain\b/g
  );

  const imageFieldNames = unique(collectImageFieldsFromSchema(schemaJSON));
  const imageSlotSummary = getTopLevelImageSlotSummary(schemaJSON);
  const mediaBehavior: string[] = [];

  if (objectCoverCount > 0) {
    mediaBehavior.push(
      `uses object-cover ${objectCoverCount} time(s), so provided images may be cropped to fill boxes`
    );
  }
  if (objectContainCount > 0) {
    mediaBehavior.push(
      `uses object-contain ${objectContainCount} time(s), so provided images are more likely to remain complete`
    );
  }
  if (backgroundCoverCount > 0) {
    mediaBehavior.push(
      `uses background cover ${backgroundCoverCount} time(s), high risk for cropping source images`
    );
  }
  if (backgroundContainCount > 0) {
    mediaBehavior.push(
      `uses background contain ${backgroundContainCount} time(s), safer for complete source images`
    );
  }
  if (mediaBehavior.length === 0 && imageFieldNames.length > 0) {
    mediaBehavior.push("image rendering behavior not explicit in static analysis");
  }

  let cropRisk: LayoutIntelligence["cropRisk"] = "low";
  if (backgroundCoverCount > 0 || objectCoverCount >= 2) {
    cropRisk = "high";
  } else if (objectCoverCount === 1 || imageFieldNames.length >= 3) {
    cropRisk = "medium";
  }

  const inferred = inferLayoutIntent(layoutName, layoutDescription);

  if (cropRisk === "high") {
    inferred.avoidFor.push(
      "source images where exact geometry, labels, axes, or figure boundaries matter"
    );
  }

  if (imageFieldNames.length === 1 && cropRisk === "low") {
    inferred.bestFor.push(
      "single important image when paired with concise explanation"
    );
  }

  return {
    avoidFor: unique(inferred.avoidFor),
    bestFor: unique(inferred.bestFor),
    cropRisk,
    imageFieldNames,
    imageSlotSummary,
    mediaBehavior,
  };
}

function appendLayoutIntelligenceToDescription(
  layoutDescription: string,
  intelligence: LayoutIntelligence
): string {
  const lines = [
    layoutDescription.trim(),
    "",
    "Layout intelligence for AI selection:",
    `- Image capacity: ${intelligence.imageSlotSummary}.`,
    `- Image fields: ${
      intelligence.imageFieldNames.length > 0
        ? intelligence.imageFieldNames.join(", ")
        : "none"
    }.`,
    `- Crop risk for supplied/source images: ${intelligence.cropRisk}.`,
    `- Media behavior: ${
      intelligence.mediaBehavior.length > 0
        ? intelligence.mediaBehavior.join("; ")
        : "no image-specific behavior detected"
    }.`,
    `- Best for: ${intelligence.bestFor.join("; ")}.`,
  ];

  if (intelligence.avoidFor.length > 0) {
    lines.push(`- Avoid for: ${intelligence.avoidFor.join("; ")}.`);
  }

  return lines.join("\n");
}

export function compileTemplateSchema(
  layoutCode: string
): CompiledTemplateSchema | null {
  try {
    const normalizedLayoutCode =
      normalizeHardcodedBackendUrlsInCode(layoutCode);
    const declarations = extractTopLevelDeclarations(normalizedLayoutCode);

    if (!declarations.has("Schema")) {
      return null;
    }

    const schemaRuntimeSource = buildSchemaRuntimeSource(declarations);
    const injectImage = !declarations.has("ImageSchema");
    const injectIcon = !declarations.has("IconSchema");
    const prelude = [
      `"use strict";`,
      `const z = _z;`,
      injectImage ? `const ImageSchema = _builtinImageSchema;` : "",
      injectIcon ? `const IconSchema = _builtinIconSchema;` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const factory = new Function(
      "_z",
      "_builtinImageSchema",
      "_builtinIconSchema",
      `${prelude} ${schemaRuntimeSource}\nreturn Schema;`
    );
    const schema = factory(z, BuiltinImageSchema, BuiltinIconSchema);

    if (!isZodSchema(schema)) {
      return null;
    }

    const layoutDescription =
      readFirstStringDeclaration(declarations, [
        "layoutDescription",
        "slideLayoutDescription",
      ]) ?? "";
    const layoutId =
      readFirstStringDeclaration(declarations, ["layoutId", "slideLayoutId"]) ??
      "custom-layout";
    const layoutName =
      readFirstStringDeclaration(declarations, [
        "layoutName",
        "slideLayoutName",
      ]) ?? "Custom Layout";
    const schemaJSON = z.toJSONSchema(schema);
    const layoutIntelligence = buildLayoutIntelligence(
      normalizedLayoutCode,
      layoutName,
      layoutDescription,
      schemaJSON
    );

    return {
      layoutDescription: appendLayoutIntelligenceToDescription(
        layoutDescription,
        layoutIntelligence
      ),
      layoutId,
      layoutName,
      schemaJSON,
    };
  } catch (error) {
    console.error("Failed to compile template schema", error);
    return null;
  }
}
