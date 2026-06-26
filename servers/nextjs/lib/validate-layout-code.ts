import { parse } from "@babel/parser";
import * as t from "@babel/types";

import {
  compileTemplateSchema,
  type CompiledTemplateSchema,
} from "@/lib/compile-template-schema";

export type LayoutCodeValidationOptions = {
  requireDynamicSlideLayout?: boolean;
  requireMetadata?: boolean;
};

export type ValidatedLayoutCode = CompiledTemplateSchema & {
  layout_code: string;
};

export class LayoutCodeValidationError extends Error {
  line?: number;
  column?: number;

  constructor(message: string, location?: { line?: number; column?: number }) {
    super(message);
    this.name = "LayoutCodeValidationError";
    this.line = location?.line;
    this.column = location?.column;
  }
}

const REQUIRED_METADATA = [
  "layoutId",
  "layoutName",
  "layoutDescription",
] as const;

function stripCodeFences(value: string): string {
  return value
    .replace(/^```(?:tsx|typescript|ts)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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

function parseLayoutCode(layoutCode: string) {
  try {
    return parse(layoutCode, {
      plugins: ["jsx", "typescript"],
      sourceType: "module",
    });
  } catch (error) {
    const loc = (error as { loc?: { line?: number; column?: number } }).loc;
    const message =
      error instanceof Error ? error.message : "Layout code contains invalid TSX";
    throw new LayoutCodeValidationError(message, {
      line: loc?.line,
      column: loc?.column === undefined ? undefined : loc.column + 1,
    });
  }
}

function addDeclarationName(
  declarations: Set<string>,
  staticStrings: Map<string, string | null>,
  declaration: t.Node | null | undefined
): void {
  if (!declaration) {
    return;
  }

  if (t.isVariableDeclaration(declaration)) {
    for (const declarator of declaration.declarations) {
      if (!t.isIdentifier(declarator.id)) {
        continue;
      }
      declarations.add(declarator.id.name);
      staticStrings.set(
        declarator.id.name,
        t.isExpression(declarator.init)
          ? getStaticStringValue(declarator.init)
          : null
      );
    }
    return;
  }

  if (
    (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) &&
    declaration.id
  ) {
    declarations.add(declaration.id.name);
  }
}

function getTopLevelContract(ast: ReturnType<typeof parse>) {
  const declarations = new Set<string>();
  const staticStrings = new Map<string, string | null>();

  for (const statement of ast.program.body) {
    if (t.isExportNamedDeclaration(statement)) {
      addDeclarationName(declarations, staticStrings, statement.declaration);
      continue;
    }

    if (t.isExportDefaultDeclaration(statement)) {
      const declaration = statement.declaration;
      if (
        (t.isFunctionDeclaration(declaration) ||
          t.isClassDeclaration(declaration)) &&
        declaration.id
      ) {
        declarations.add(declaration.id.name);
      }
      continue;
    }

    addDeclarationName(declarations, staticStrings, statement);
  }

  return { declarations, staticStrings };
}

export function validateLayoutCode(
  layoutCode: string,
  options: LayoutCodeValidationOptions = {}
): ValidatedLayoutCode {
  const {
    requireDynamicSlideLayout = true,
    requireMetadata = true,
  } = options;
  const normalizedCode = stripCodeFences(layoutCode);

  if (!normalizedCode) {
    throw new LayoutCodeValidationError("Layout code is required");
  }

  const ast = parseLayoutCode(normalizedCode);
  const { declarations, staticStrings } = getTopLevelContract(ast);

  if (!declarations.has("Schema")) {
    throw new LayoutCodeValidationError("Layout code must declare Schema");
  }

  if (requireDynamicSlideLayout && !declarations.has("dynamicSlideLayout")) {
    throw new LayoutCodeValidationError(
      "Layout code must declare dynamicSlideLayout"
    );
  }

  if (requireMetadata) {
    for (const name of REQUIRED_METADATA) {
      if (!declarations.has(name)) {
        throw new LayoutCodeValidationError(`Layout code must declare ${name}`);
      }

      const value = staticStrings.get(name);
      if (!value?.trim()) {
        throw new LayoutCodeValidationError(
          `Layout metadata ${name} must be a non-empty string literal`
        );
      }
    }
  }

  const compiled = compileTemplateSchema(normalizedCode);
  if (!compiled) {
    throw new LayoutCodeValidationError(
      "Layout code must contain a valid zod Schema"
    );
  }

  return {
    ...compiled,
    layout_code: normalizedCode,
  };
}
