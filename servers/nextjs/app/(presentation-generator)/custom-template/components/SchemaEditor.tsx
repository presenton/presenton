'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X, ChevronDown, ChevronRight, Type, Hash, List, Box, AlertCircle, Wand2, Loader2, ArrowRightLeft, MousePointer2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessedSlide } from "../types";
import { CompiledLayout } from "@/app/hooks/compileLayout";
import { toast } from "sonner";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { useSchemaHighlight } from "./SchemaHighlightContext";
import { getApiUrl } from "@/utils/api";


interface SchemaEditorProps {
    slide: ProcessedSlide;
    compiledLayout: CompiledLayout | null;
    isOpen: boolean;
    onSave: (updatedReact: string) => void;
    onCancel: () => void;
    onFillContent?: (content: Record<string, any>) => void;
}

interface SchemaField {
    path: string;       // Full path like "brandName" or "items"
    name: string;       // Display name
    type: 'string' | 'number' | 'array' | 'object' | 'boolean';
    originalType: 'string' | 'number' | 'array' | 'object' | 'boolean'; // Track original type
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    minimum?: number;
    maximum?: number;
    default?: any;
    description?: string;
}

interface FieldChange {
    path: string;
    field: 'minLength' | 'maxLength' | 'minItems' | 'maxItems' | 'minimum' | 'maximum';
    oldValue?: number;
    newValue?: number;
}

interface TypeChange {
    path: string;
    oldType: 'string' | 'number';
    newType: 'string' | 'number';
}

// Fields to skip (icon and image related)
function shouldSkipField(fieldName: string): boolean {
    // Skip all fields that start with double underscore or contain image/icon patterns
    const skipPatterns = [
        '__icon', '__image', '__icon_url__', '__image_url__',
        'icon_url', 'icon_query', 'image_url', 'image_prompt',
        '_icon', '_image'
    ];
    const lowerName = fieldName.toLowerCase();
    return fieldName.startsWith('__') ||
        fieldName.startsWith('_') ||
        skipPatterns.some(pattern => lowerName.includes(pattern));
}

// Extract fields from JSON Schema
// defaultValues: for nested array items, pass the first item's values as example defaults
function extractFieldsFromSchema(schemaJSON: any, parentPath: string = '', defaultValues?: Record<string, any>): SchemaField[] {
    console.log('extractFieldsFromSchema', schemaJSON);
    const fields: SchemaField[] = [];

    if (!schemaJSON || schemaJSON.type !== 'object' || !schemaJSON.properties) {
        return fields;
    }

    for (const [key, prop] of Object.entries(schemaJSON.properties) as [string, any][]) {
        if (shouldSkipField(key)) continue;

        const path = parentPath ? `${parentPath}.${key}` : key;

        // Get default value: prefer prop.default, fall back to passed defaultValues
        const fieldDefault = prop.default !== undefined ? prop.default : defaultValues?.[key];

        if (prop.type === 'string') {
            fields.push({
                path,
                name: key,
                type: 'string',
                originalType: 'string',
                minLength: prop.minLength,
                maxLength: prop.maxLength,
                default: fieldDefault,
                description: prop.description,
            });
        } else if (prop.type === 'number' || prop.type === 'integer') {
            fields.push({
                path,
                name: key,
                type: 'number',
                originalType: 'number',
                minimum: prop.minimum,
                maximum: prop.maximum,
                default: fieldDefault,
                description: prop.description,
            });
        } else if (prop.type === 'array') {
            // Get the first item from array's default as example values for nested fields
            const arrayDefault = prop.default;
            const firstItemDefault = Array.isArray(arrayDefault) && arrayDefault.length > 0 ? arrayDefault[0] : undefined;

            fields.push({
                path,
                name: key,
                type: 'array',
                originalType: 'array',
                minItems: prop.minItems,
                maxItems: prop.maxItems,
                description: prop.description,
                default: arrayDefault,
            });
            // Also extract nested fields from array items if it's an object
            if (prop.items?.type === 'object') {
                // Pass the first item's values as defaults for nested fields
                const nestedFields = extractFieldsFromSchema(prop.items, `${path}[]`, firstItemDefault);
                fields.push(...nestedFields);
            }
        } else if (prop.type === 'object' && prop.properties) {
            // Add the object itself as a field (for hierarchy display)
            fields.push({
                path,
                name: key,
                type: 'object',
                originalType: 'object',
                description: prop.description,
                default: fieldDefault,
            });
            // Nested object - extract its fields with any default values
            const objectDefault = typeof fieldDefault === 'object' ? fieldDefault : undefined;
            const nestedFields = extractFieldsFromSchema(prop, path, objectDefault);
            fields.push(...nestedFields);
        }
    }

    return fields;
}

// Helper to build full path from AST traversal context
function buildPathFromAncestors(path: any): string {
    const parts: string[] = [];
    let current = path;

    while (current) {
        if (current.node && t.isObjectProperty(current.node)) {
            const key = current.node.key;
            let keyName: string | null = null;

            if (t.isIdentifier(key)) {
                keyName = key.name;
            } else if (t.isStringLiteral(key)) {
                keyName = key.value;
            }

            if (keyName) {
                // Check if the parent is inside a z.object() call (nested object)
                // or z.array() items (array items)
                const parentPath = current.parentPath;
                if (parentPath && t.isObjectExpression(parentPath.node)) {
                    const grandParent = parentPath.parentPath;
                    if (grandParent && t.isCallExpression(grandParent.node)) {
                        const callee = grandParent.node.callee;
                        // Check if this is z.object({...}) or z.array(z.object({...}))
                        if (t.isMemberExpression(callee)) {
                            if (t.isIdentifier(callee.object, { name: 'z' }) &&
                                t.isIdentifier(callee.property, { name: 'object' })) {
                                // This is inside z.object(), check for array context
                                const greatGrandParent = grandParent.parentPath;
                                if (greatGrandParent && t.isCallExpression(greatGrandParent.node)) {
                                    const ggCallee = greatGrandParent.node.callee;
                                    if (t.isMemberExpression(ggCallee) &&
                                        t.isIdentifier(ggCallee.object, { name: 'z' }) &&
                                        t.isIdentifier(ggCallee.property, { name: 'array' })) {
                                        // This is z.array(z.object({...})), mark as array item
                                        parts.unshift(keyName);
                                        parts.unshift('[]');
                                    } else {
                                        parts.unshift(keyName);
                                    }
                                } else {
                                    parts.unshift(keyName);
                                }
                            }
                        }
                    }
                } else {
                    parts.unshift(keyName);
                }
            }
        }
        current = current.parentPath;
    }

    // Filter out duplicate [] markers and clean up path
    const cleanParts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '[]') {
            if (cleanParts.length > 0 && !cleanParts[cleanParts.length - 1].endsWith('[]')) {
                cleanParts[cleanParts.length - 1] += '[]';
            }
        } else {
            cleanParts.push(parts[i]);
        }
    }

    return cleanParts.join('.');
}

// Update constraints in code using AST manipulation (reliable approach)
function updateConstraintsInCode(code: string, changes: FieldChange[]): string {
    if (changes.length === 0) return code;

    try {
        // Parse the code into an AST
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });

        // Create a map of changes by FULL path for precise matching
        const changeMap = new Map<string, FieldChange[]>();
        for (const change of changes) {
            if (!changeMap.has(change.path)) {
                changeMap.set(change.path, []);
            }
            changeMap.get(change.path)!.push(change);
        }

        // Also create a map by field name for fallback matching (simpler schemas)
        const changeByNameMap = new Map<string, FieldChange[]>();
        for (const change of changes) {
            const fieldName = change.path.split('.').pop()?.replace('[]', '') || change.path;
            if (!changeByNameMap.has(fieldName)) {
                changeByNameMap.set(fieldName, []);
            }
            changeByNameMap.get(fieldName)!.push(change);
        }

        // Track which changes we've applied
        const appliedChanges = new Set<string>();

        // Traverse the AST
        traverse(ast, {
            ObjectProperty(path) {
                const key = path.node.key;
                let fieldName: string | null = null;

                if (t.isIdentifier(key)) {
                    fieldName = key.name;
                } else if (t.isStringLiteral(key)) {
                    fieldName = key.value;
                }

                if (!fieldName) return;

                // Build the full path from context
                const fullPath = buildPathFromAncestors(path);

                // Try to find changes by full path first, then by field name
                let fieldChanges: FieldChange[] | undefined;

                if (changeMap.has(fullPath)) {
                    fieldChanges = changeMap.get(fullPath);
                } else if (changeByNameMap.has(fieldName)) {
                    // Only use name-based matching if there's exactly one change for this name
                    // and we haven't already applied it
                    const nameChanges = changeByNameMap.get(fieldName)!;
                    const unappliedChanges = nameChanges.filter(c => !appliedChanges.has(c.path));
                    if (unappliedChanges.length === 1) {
                        fieldChanges = unappliedChanges;
                    }
                }

                if (!fieldChanges || fieldChanges.length === 0) return;

                // Process each change for this field
                for (const change of fieldChanges) {
                    // Skip if already applied
                    const changeKey = `${change.path}-${change.field}`;
                    if (appliedChanges.has(changeKey)) continue;

                    const methodName = change.field === 'minLength' || change.field === 'minimum' || change.field === 'minItems'
                        ? 'min'
                        : 'max';

                    // Find and update existing method call, or find where to insert new one
                    let found = false;
                    let baseTypeCall: t.CallExpression | null = null;
                    let baseTypeParent: t.CallExpression | null = null;

                    // Walk the chain to find existing .min() or .max() calls and the base type call
                    const walkChain = (node: t.Node, parent: t.CallExpression | null): void => {
                        if (t.isCallExpression(node)) {
                            if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
                                const propName = node.callee.property.name;

                                if (propName === methodName) {
                                    if (change.newValue !== undefined) {
                                        node.arguments[0] = t.numericLiteral(change.newValue);
                                    }
                                    found = true;
                                }

                                if (t.isCallExpression(node.callee.object)) {
                                    walkChain(node.callee.object, node);
                                }
                            }

                            if (t.isMemberExpression(node.callee) &&
                                t.isIdentifier(node.callee.object, { name: 'z' }) &&
                                t.isIdentifier(node.callee.property)) {
                                baseTypeCall = node;
                                baseTypeParent = parent;
                            }
                        }
                    };

                    walkChain(path.node.value as t.Node, null);

                    if (!found && change.newValue !== undefined && baseTypeCall) {
                        const newMethodCall = t.callExpression(
                            t.memberExpression(
                                t.cloneNode(baseTypeCall) as t.Expression,
                                t.identifier(methodName)
                            ),
                            [t.numericLiteral(change.newValue)]
                        );

                        if (baseTypeParent !== null) {
                            const parentCallee = (baseTypeParent as t.CallExpression).callee;
                            if (t.isMemberExpression(parentCallee)) {
                                (parentCallee as t.MemberExpression).object = newMethodCall;
                            }
                        } else {
                            path.node.value = newMethodCall;
                        }
                    }

                    appliedChanges.add(changeKey);
                }
            },
        });

        // Generate code from the modified AST
        const output = generate(ast, {
            retainLines: true,
            retainFunctionParens: true,
        }, code);

        return output.code;
    } catch (error) {
        console.error('AST parsing/transformation failed:', error);
        return code;
    }
}

// Update type changes in code using AST manipulation
function updateTypeInCode(code: string, typeChanges: TypeChange[]): string {
    if (typeChanges.length === 0) return code;

    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });

        // Create a map of type changes by FULL path
        const typeChangeMap = new Map<string, TypeChange>();
        for (const change of typeChanges) {
            typeChangeMap.set(change.path, change);
        }

        // Also create a map by field name for fallback
        const typeByNameMap = new Map<string, TypeChange[]>();
        for (const change of typeChanges) {
            const fieldName = change.path.split('.').pop()?.replace('[]', '') || change.path;
            if (!typeByNameMap.has(fieldName)) {
                typeByNameMap.set(fieldName, []);
            }
            typeByNameMap.get(fieldName)!.push(change);
        }

        const appliedChanges = new Set<string>();

        traverse(ast, {
            ObjectProperty(path) {
                const key = path.node.key;
                let fieldName: string | null = null;

                if (t.isIdentifier(key)) {
                    fieldName = key.name;
                } else if (t.isStringLiteral(key)) {
                    fieldName = key.value;
                }

                if (!fieldName) return;

                // Build full path from context
                const fullPath = buildPathFromAncestors(path);

                // Try to find change by full path first, then by field name
                let change: TypeChange | undefined;

                if (typeChangeMap.has(fullPath)) {
                    change = typeChangeMap.get(fullPath);
                } else if (typeByNameMap.has(fieldName)) {
                    const nameChanges = typeByNameMap.get(fieldName)!;
                    const unapplied = nameChanges.filter(c => !appliedChanges.has(c.path));
                    if (unapplied.length === 1) {
                        change = unapplied[0];
                    }
                }

                if (!change || appliedChanges.has(change.path)) return;

                // Find and replace z.string() or z.number() in the chain
                const replaceZodType = (node: t.Node): t.Expression | null => {
                    if (t.isCallExpression(node)) {
                        if (t.isMemberExpression(node.callee)) {
                            if (t.isIdentifier(node.callee.object, { name: 'z' }) &&
                                t.isIdentifier(node.callee.property)) {
                                const currentType = node.callee.property.name;
                                if (currentType === change!.oldType) {
                                    return t.callExpression(
                                        t.memberExpression(
                                            t.identifier('z'),
                                            t.identifier(change!.newType)
                                        ),
                                        []
                                    );
                                }
                            }

                            if (t.isCallExpression(node.callee.object)) {
                                const innerReplacement = replaceZodType(node.callee.object);
                                if (innerReplacement) {
                                    const methodName = (node.callee.property as t.Identifier).name;
                                    return t.callExpression(
                                        t.memberExpression(
                                            innerReplacement,
                                            t.identifier(methodName)
                                        ),
                                        node.arguments
                                    );
                                }
                            }
                        }
                    }
                    return null;
                };

                const replacement = replaceZodType(path.node.value as t.Node);
                if (replacement) {
                    path.node.value = replacement;
                    appliedChanges.add(change.path);
                }
            },
        });

        const output = generate(ast, {
            retainLines: true,
            retainFunctionParens: true,
        }, code);

        return output.code;
    } catch (error) {
        console.error('Type change AST transformation failed:', error);
        return code;
    }
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
    slide,
    compiledLayout,
    isOpen,
    onSave,
    onCancel,
    onFillContent,
}) => {
    const [fields, setFields] = useState<SchemaField[]>([]);
    const [originalFields, setOriginalFields] = useState<SchemaField[]>([]);
    const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
    const [parseError, setParseError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingMode, setGeneratingMode] = useState<'min' | 'normal' | 'max' | null>(null);

    // Schema-Element highlighting integration
    const {
        setHighlightedSchemaPath,
        highlightedElementPath,
        setHighlightedElementPath,

    } = useSchemaHighlight();
    const fieldRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Register scroll-to function with context
    const scrollToField = useCallback((path: string) => {
        // Expand the field if collapsed
        setExpandedFields(prev => {
            const next = new Set(prev);
            next.add(path);
            // Also expand parent if it's a nested field
            const parentPath = path.includes('.') ? path.split('.').slice(0, -1).join('.') : null;
            if (parentPath) next.add(parentPath.replace('[]', ''));
            return next;
        });

        // Scroll to the field
        setTimeout(() => {
            const fieldEl = fieldRefs.current.get(path);
            if (fieldEl) {
                // fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add highlight animation
                fieldEl.classList.add('ring-2', 'ring-violet-500', 'ring-offset-2');
                setTimeout(() => {
                    fieldEl.classList.remove('ring-2', 'ring-violet-500', 'ring-offset-2');
                }, 2000);
            }
        }, 100);
    }, []);



    // Clear element highlight when user interacts with schema editor
    useEffect(() => {
        if (highlightedElementPath) {
            // Auto-scroll to the highlighted field
            scrollToField(highlightedElementPath);
            // Clear the highlight after scrolling
            setTimeout(() => setHighlightedElementPath(null), 2500);
        }
    }, [highlightedElementPath, scrollToField, setHighlightedElementPath]);

    // Extract schema from compiled layout when it changes
    useEffect(() => {
        if (!isOpen) return;

        if (!compiledLayout?.schemaJSON) {
            setParseError("Could not parse schema from slide code");
            setFields([]);
            return;
        }

        try {
            const extractedFields = extractFieldsFromSchema(compiledLayout.schemaJSON);
            setFields(extractedFields);
            setOriginalFields(JSON.parse(JSON.stringify(extractedFields))); // Deep copy
            setExpandedFields(new Set()); // Collapse all by default for cleaner initial view
            setParseError(null);
        } catch (error) {
            console.error("Error parsing schema:", error);
            setParseError("Failed to parse schema");
            setFields([]);
        }
    }, [compiledLayout, isOpen]);

    const handleFieldChange = (
        path: string,
        field: 'minLength' | 'maxLength' | 'minItems' | 'maxItems' | 'minimum' | 'maximum',
        value: number | undefined
    ) => {
        setFields(prev => prev.map(f => {
            if (f.path !== path) return f;
            return { ...f, [field]: value };
        }));
    };

    const handleTypeChange = (path: string, newType: 'string' | 'number') => {
        setFields(prev => prev.map(f => {
            if (f.path !== path) return f;

            // Convert constraints when changing type
            if (f.type === 'string' && newType === 'number') {
                // String to number: minLength → minimum, maxLength → maximum
                return {
                    ...f,
                    type: newType,
                    minimum: f.minLength,
                    maximum: f.maxLength,
                    minLength: undefined,
                    maxLength: undefined,
                };
            } else if (f.type === 'number' && newType === 'string') {
                // Number to string: minimum → minLength, maximum → maxLength
                return {
                    ...f,
                    type: newType,
                    minLength: f.minimum,
                    maxLength: f.maximum,
                    minimum: undefined,
                    maximum: undefined,
                };
            }
            return { ...f, type: newType };
        }));
    };

    const handleSave = () => {
        // Calculate changes by comparing with original
        const changes: FieldChange[] = [];
        const typeChanges: TypeChange[] = [];

        for (const field of fields) {
            const original = originalFields.find(f => f.path === field.path);
            if (!original) continue;

            // Check for type changes first
            if (field.type !== original.type &&
                (field.type === 'string' || field.type === 'number') &&
                (original.type === 'string' || original.type === 'number')) {
                typeChanges.push({
                    path: field.path,
                    oldType: original.type as 'string' | 'number',
                    newType: field.type as 'string' | 'number',
                });
            }

            // Then check constraint changes (after type conversion)
            if (field.type === 'string') {
                if (field.minLength !== original.minLength) {
                    changes.push({ path: field.path, field: 'minLength', oldValue: original.minLength, newValue: field.minLength });
                }
                if (field.maxLength !== original.maxLength) {
                    changes.push({ path: field.path, field: 'maxLength', oldValue: original.maxLength, newValue: field.maxLength });
                }
            } else if (field.type === 'number') {
                if (field.minimum !== original.minimum) {
                    changes.push({ path: field.path, field: 'minimum', oldValue: original.minimum, newValue: field.minimum });
                }
                if (field.maximum !== original.maximum) {
                    changes.push({ path: field.path, field: 'maximum', oldValue: original.maximum, newValue: field.maximum });
                }
            } else if (field.type === 'array') {
                if (field.minItems !== original.minItems) {
                    changes.push({ path: field.path, field: 'minItems', oldValue: original.minItems, newValue: field.minItems });
                }
                if (field.maxItems !== original.maxItems) {
                    changes.push({ path: field.path, field: 'maxItems', oldValue: original.maxItems, newValue: field.maxItems });
                }
            }
        }

        // Apply type changes first, then constraint changes
        let updatedCode = slide.react || '';
        updatedCode = updateTypeInCode(updatedCode, typeChanges);
        updatedCode = updateConstraintsInCode(updatedCode, changes);
        onSave(updatedCode);
    };

    const handleCancel = () => {
        setFields(JSON.parse(JSON.stringify(originalFields)));
        onCancel();
    };

    const toggleFieldExpanded = (path: string) => {
        setExpandedFields(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };



    const formatFieldName = (name: string) => {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/\[\]$/, ' (items)')
            .trim();
    };

    const getConstraintSummary = (field: SchemaField): string | null => {
        if (field.type === 'string') {
            if (field.minLength !== undefined || field.maxLength !== undefined) {
                return `${field.minLength ?? '∞'}-${field.maxLength ?? '∞'} chars`;
            }
        } else if (field.type === 'number') {
            if (field.minimum !== undefined || field.maximum !== undefined) {
                return `${field.minimum ?? '∞'}-${field.maximum ?? '∞'}`;
            }
        } else if (field.type === 'array') {
            if (field.minItems !== undefined || field.maxItems !== undefined) {
                return `${field.minItems ?? '∞'}-${field.maxItems ?? '∞'} items`;
            }
        }
        return null;
    };

    // Check if field has been modified
    const isFieldModified = (field: SchemaField): boolean => {
        const original = originalFields.find(f => f.path === field.path);
        if (!original) return false;

        // Check for type change
        if (field.type !== original.type) return true;

        if (field.type === 'string') {
            return field.minLength !== original.minLength || field.maxLength !== original.maxLength;
        } else if (field.type === 'number') {
            return field.minimum !== original.minimum || field.maximum !== original.maximum;
        } else if (field.type === 'array') {
            return field.minItems !== original.minItems || field.maxItems !== original.maxItems;
        }
        return false;
    };

    // Check if field type has been changed
    const isTypeChanged = (field: SchemaField): boolean => {
        const original = originalFields.find(f => f.path === field.path);
        return original ? field.type !== original.type : false;
    };

    const hasChanges = useMemo(() => fields.some(isFieldModified), [fields, originalFields]);

    // Build hierarchical structure from flat fields
    const hierarchicalFields = useMemo(() => {
        const result: { field: SchemaField; children: SchemaField[]; depth: number; parentType?: 'array' | 'object' }[] = [];
        const processedPaths = new Set<string>();

        // Helper to check if a path is a direct child of another path
        const isDirectChild = (childPath: string, parentPath: string, isArrayParent: boolean): boolean => {
            const prefix = isArrayParent ? `${parentPath}[].` : `${parentPath}.`;
            if (!childPath.startsWith(prefix)) return false;
            const remainingPath = childPath.slice(prefix.length);
            // Direct child has no further dots (except for array notation)
            return !remainingPath.includes('.') && !remainingPath.includes('[]');
        };

        // Helper to check if a field is nested (has a parent)
        const getParentPath = (path: string): { parentPath: string; isArrayParent: boolean } | null => {
            // Check for array parent first (path contains [])
            const arrayMatch = path.match(/^(.+)\[\]\.([^.]+)$/);
            if (arrayMatch) {
                return { parentPath: arrayMatch[1], isArrayParent: true };
            }
            // Check for object parent
            const lastDot = path.lastIndexOf('.');
            if (lastDot > 0) {
                return { parentPath: path.slice(0, lastDot), isArrayParent: false };
            }
            return null;
        };

        for (const field of fields) {
            if (processedPaths.has(field.path)) continue;

            // Check if this field has a parent
            const parentInfo = getParentPath(field.path);
            if (parentInfo) {
                // This is a child field, skip it - it will be added to its parent
                continue;
            }

            // Find children for array and object fields
            const children: SchemaField[] = [];

            if (field.type === 'array') {
                // Find array item children
                for (const potentialChild of fields) {
                    if (isDirectChild(potentialChild.path, field.path, true)) {
                        children.push(potentialChild);
                        processedPaths.add(potentialChild.path);
                    }
                }
            } else if (field.type === 'object') {
                // Find object property children
                for (const potentialChild of fields) {
                    if (isDirectChild(potentialChild.path, field.path, false)) {
                        children.push(potentialChild);
                        processedPaths.add(potentialChild.path);
                    }
                }
            }

            result.push({
                field,
                children,
                depth: 0,
                parentType: field.type === 'array' ? 'array' : field.type === 'object' ? 'object' : undefined
            });
            processedPaths.add(field.path);
        }

        return result;
    }, [fields]);

    // Generate content with AI - supports different fill modes
    const handleFillContent = async (mode: 'min' | 'normal' | 'max') => {
        if (!compiledLayout?.schemaJSON || !onFillContent) return;

        setIsGenerating(true);
        setGeneratingMode(mode);
        try {
            const response = await fetch(getApiUrl(`/api/v3/schema/content/generate`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schema: compiledLayout.schemaJSON,
                    mode: mode,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate content');
            }

            const { content } = await response.json();
            onFillContent(content);

            const modeLabels = {
                min: 'Low',
                normal: 'Medium',
                max: 'Text Heavy',
            };
            toast.success(`${modeLabels[mode]} content generated!`);
            handleCancel();
        } catch (error) {
            console.error('Error generating content:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to generate content');
        } finally {
            setIsGenerating(false);
            setGeneratingMode(null);
        }
    };

    if (!isOpen) return null;

    // Collapse all fields by default for cleaner initial view
    const areAllCollapsed = expandedFields.size === 0;

    return (
        <div className="w-full relative  pb-2     bg-white overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-800 text-base font-semibold">

                        Schema Editor
                    </div>
                    <div className="flex items-center gap-2">
                        {hasChanges && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-600 rounded border border-amber-200">
                                Unsaved
                            </span>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            size="sm"
                            className="h-7 px-3 text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Save className="w-3 h-3 mr-1" />
                            Save
                        </Button>
                        <button
                            onClick={handleCancel}
                            className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 px-2  ">


                {/* Fields Section */}
                <div className="px-4 py-3 h-[calc(100vh-350px)] overflow-y-auto custom_scrollbar pb-10">
                    {/* Section Header */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-medium text-[#111827]">
                                    Character Limits
                                </span>
                                <span className="text-sm px-1.5 py-0.5 bg-gray-50 text-gray-700 rounded">
                                    {fields.length}
                                </span>
                            </div>
                            {fields.length > 0 && (
                                <button
                                    onClick={() => {
                                        if (areAllCollapsed) {
                                            setExpandedFields(new Set(fields.map(f => f.path)));
                                        } else {
                                            setExpandedFields(new Set());
                                        }
                                    }}
                                    className="text-[10px] font-medium text-gray-400 hover:text-violet-600 transition-colors"
                                >
                                    {areAllCollapsed ? 'Expand all' : 'Collapse all'}
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 py-1">
                            Set min/max character limits for each field. This controls how much text AI generates for your slide.
                        </p>
                    </div>

                    {parseError ? (
                        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-md text-red-600">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <p className="text-[11px]">{parseError}</p>
                        </div>
                    ) : fields.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Box className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs">No editable fields</p>
                        </div>
                    ) : (
                        <div className="space-y-1 px-2 ">
                            {hierarchicalFields.map(({ field, children }) => {

                                const hasChildren = children.length > 0;

                                // Render a single field item
                                const renderFieldItem = (f: SchemaField, isChild: boolean = false) => {
                                    const fExpanded = expandedFields.has(f.path);
                                    const fModified = isFieldModified(f);
                                    const isHighlighted = highlightedElementPath === f.path;

                                    return (
                                        <div
                                            key={f.path}
                                            ref={(el) => {
                                                if (el) fieldRefs.current.set(f.path, el);
                                            }}
                                            onMouseEnter={() => setHighlightedSchemaPath(f.path)}
                                            onMouseLeave={() => setHighlightedSchemaPath(null)}
                                            className={`rounded-md border transition-all my-3 ${isHighlighted
                                                ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-300'
                                                : fModified
                                                    ? 'border-amber-200 bg-amber-50/40'
                                                    : isChild
                                                        ? 'border-gray-200 bg-gray-50/50 hover:border-gray-400'
                                                        : 'border-gray-300 hover:border-gray-600'
                                                }`}
                                        >
                                            <button
                                                onClick={() => toggleFieldExpanded(f.path)}
                                                className="w-full flex items-center justify-between px-2.5 py-2 text-left "
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {f.type === 'string' && <Type className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                                                    {f.type === 'number' && <Hash className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                                                    {f.type === 'array' && <List className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                                                    {f.type === 'object' && <Box className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                                                    <span className={`text-sm font-medium truncate ${isChild ? 'text-gray-600' : 'text-gray-700'}`}>
                                                        {formatFieldName(f.name)}
                                                    </span>
                                                    {getConstraintSummary(f) && (
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${fModified
                                                            ? 'bg-amber-100 text-amber-600'
                                                            : 'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {getConstraintSummary(f)}
                                                        </span>
                                                    )}
                                                    {/* Highlight indicator */}
                                                    {isHighlighted && (
                                                        <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded">
                                                            <MousePointer2 className="w-2.5 h-2.5" />
                                                            clicked
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${fExpanded ? 'rotate-90' : ''}`} />
                                            </button>

                                            {fExpanded && (
                                                <div className="px-2.5 pb-2.5 pt-1.5 border-t border-gray-50">
                                                    {f.description && (
                                                        <p className="text-xs text-gray-600 mb-2 italic">
                                                            {f.description}
                                                        </p>
                                                    )}

                                                    {/* Type Selector - only show if type can change */}
                                                    {(f.originalType === 'string' || f.originalType === 'number') && (
                                                        <div className="mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-xs text-gray-600">Type:</Label>
                                                                <Select
                                                                    value={f.type}
                                                                    onValueChange={(value) => handleTypeChange(f.path, value as 'string' | 'number')}
                                                                >
                                                                    <SelectTrigger className="h-7 w-24 text-[11px] bg-gray-50 border-gray-200">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="string">String</SelectItem>
                                                                        <SelectItem value="number">Number</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                {isTypeChanged(f) && (
                                                                    <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-500 rounded">changed</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Constraints */}
                                                    {f.type === 'string' && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <Label className="text-xs text-gray-600 mb-1 block">Min chars</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={f.minLength ?? ''}
                                                                    onChange={(e) => handleFieldChange(f.path, 'minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                                                                    placeholder="—"
                                                                    className="h-7 text-[11px] bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs text-gray-600 mb-1 block">Max chars</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={f.maxLength ?? ''}
                                                                    onChange={(e) => handleFieldChange(f.path, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                                                                    placeholder="—"
                                                                    className="h-7 text-[11px] bg-gray-50"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {f.type === 'number' && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <Label className="text-xs text-gray-600 mb-1 block">Min value</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={f.minimum ?? ''}
                                                                    onChange={(e) => handleFieldChange(f.path, 'minimum', e.target.value ? parseInt(e.target.value) : undefined)}
                                                                    placeholder="—"
                                                                    className="h-7 text-[11px] bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs text-gray-600 mb-1 block">Max value</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={f.maximum ?? ''}
                                                                    onChange={(e) => handleFieldChange(f.path, 'maximum', e.target.value ? parseInt(e.target.value) : undefined)}
                                                                    placeholder="—"
                                                                    className="h-7 text-[11px] bg-gray-50"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {f.type === 'array' && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <Label className="text-xs text-gray-600 mb-1 block">Min items</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={f.minItems ?? ''}
                                                                    onChange={(e) => handleFieldChange(f.path, 'minItems', e.target.value ? parseInt(e.target.value) : undefined)}
                                                                    placeholder="—"
                                                                    className="h-7 text-[11px] bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs text-gray-600 mb-1 block">Max items</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={f.maxItems ?? ''}
                                                                    onChange={(e) => handleFieldChange(f.path, 'maxItems', e.target.value ? parseInt(e.target.value) : undefined)}
                                                                    placeholder="—"
                                                                    className="h-7 text-[11px] bg-gray-50"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {f.default !== undefined && typeof f.default !== 'object' && (
                                                        <div className="mt-3">
                                                            <Label className="text-xs text-gray-600 mb-1 block">Current value</Label>
                                                            <div className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate font-mono">
                                                                {String(f.default)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                };

                                // Determine styles based on parent type (arrays = purple, objects = blue)
                                const isArrayParent = field.type === 'array';
                                const borderColor = isArrayParent ? 'border-purple-200' : 'border-blue-200';
                                const lineColor = isArrayParent ? 'bg-purple-200' : 'bg-blue-200';
                                const textColor = isArrayParent ? 'text-purple-500' : 'text-blue-500';
                                const bgColor = isArrayParent ? 'bg-purple-50' : 'bg-blue-50';
                                const badgeTextColor = isArrayParent ? 'text-purple-400' : 'text-blue-400';
                                const headerLabel = isArrayParent ? 'Item Fields' : `${formatFieldName(field.name)} Properties`;

                                return (
                                    <div key={field.path} className="space-y-1">
                                        {/* Parent field */}
                                        {renderFieldItem(field)}

                                        {/* Child fields with visual hierarchy */}
                                        {hasChildren && (
                                            <div className={`relative ml-3 pl-3 border-l-2 ${borderColor} space-y-1`}>
                                                {/* Header for nested fields */}
                                                <div className="flex items-center gap-1.5 py-1">
                                                    <div className={`w-2 h-0.5 ${lineColor}`} />
                                                    <span className={`text-[10px] font-medium ${textColor} uppercase tracking-wide`}>
                                                        {headerLabel}
                                                    </span>
                                                    <span className={`text-[9px] px-1 py-0.5 ${bgColor} ${badgeTextColor} rounded`}>
                                                        {children.length}
                                                    </span>
                                                </div>
                                                {/* Render child fields */}
                                                {children.map((child) => (
                                                    <div key={child.path} className="relative">
                                                        {/* Connector line */}
                                                        <div className={`absolute -left-3 top-1/2 w-2 h-0.5 ${lineColor}`} />
                                                        {renderFieldItem(child, true)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            {/* <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
                <div className="flex items-center justify-end w-full gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        className="h-7 px-3 text-[11px] text-gray-500 hover:text-gray-700"
                    >
                        Cancel
                    </Button>
                    
                </div>
            </div> */}
        </div>
    );
};

