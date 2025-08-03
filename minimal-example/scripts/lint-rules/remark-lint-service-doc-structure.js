import { visit } from 'unist-util-visit';
import fs from 'fs';
import YAML from 'yaml';
import debugLib from 'debug';

const debug = debugLib('remark:lint-structure');

function getHeadingText(node) {
  return node.children
    .filter((child) => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim();
}

function getNodeText(node) {
  if (node.children) {
    return node.children
      .filter((child) => child.type === 'text')
      .map((child) => child.value)
      .join(' ')
      .trim();
  }
  if (node.value) {
    return node.value.trim();
  }
  return '';
}

function buildHeadingTree(tree) {
  const headings = [];
  const stack = [];

  visit(tree, (node, index, parent) => {
    if (node.type === 'yaml') return;

    if (node.type === 'heading') {
      const text = getHeadingText(node);
      const newHeading = {
        title: text,
        depth: node.depth,
        children: [],
        content: [],
        // Normalize position to { line, column }
        position: node.position?.start
          ? { line: node.position.start.line, column: node.position.start.column }
          : null
      };

      while (stack.length && stack[stack.length - 1].depth >= node.depth) {
        stack.pop();
      }

      if (stack.length === 0) {
        headings.push(newHeading);
        stack.push(newHeading);
      } else {
        const parentHeading = stack[stack.length - 1];
        parentHeading.children.push(newHeading);
        stack.push(newHeading);
      }
    } else {
      if (parent && parent.type === 'heading') return;
      if (stack.length > 0) {
        stack[stack.length - 1].content.push(node);
      }
    }
  });

  return headings;
}

function matchesHeading(heading, schemaSection) {
  if (schemaSection.titlePattern) {
    const regex = new RegExp(schemaSection.titlePattern, 'i');
    return regex.test(heading.title);
  }
  if (schemaSection.title) {
    return heading.title === schemaSection.title;
  }
  return false;
}

function validateSections(
  file,
  sections,
  schemaSections,
  path = '',
  enforceOrder = false,
  globalAllowChildren = false,
  contentNodeTypes = new Set(['paragraph', 'list', 'code', 'blockquote', 'table']),
  ruleId = 'remark-lint-structure'
) {
  let i = 0;
  let j = 0;

  while (j < schemaSections.length) {
    const schemaSection = schemaSections[j];
    const current = sections[i];
    const expectedName = schemaSection.title || schemaSection.titlePattern;

    if (current && matchesHeading(current, schemaSection)) {
      const allowChildren =
        schemaSection.allowChildrenToSatisfyNonEmpty ?? globalAllowChildren;

      debug(`Checking section "${path}${expectedName}"`);
      current.content.forEach((node, index) => {
        debug(`  [${index}] type = ${node.type}, text = "${getNodeText(node)}"`);
      });

      // Non-empty validation
      if (schemaSection.nonEmpty) {
        const hasValidContent = current.content.some((node) =>
          contentNodeTypes.has(node.type)
        );
        const hasChildren = current.children.length > 0;

        const satisfiesNonEmpty =
          hasValidContent || (allowChildren && hasChildren);

        if (!satisfiesNonEmpty) {
          file.message(
            `Section "${path}${expectedName}" must not be empty.${
              schemaSection.description ? ` — ${schemaSection.description}` : ''
            }`,
            current.position || null,
            ruleId
          );
        }
      }

      // Recurse into child sections
      if (schemaSection.children) {
        validateSections(
          file,
          current.children,
          schemaSection.children,
          path + expectedName + ' > ',
          schemaSection.enforceOrder ?? enforceOrder,
          globalAllowChildren,
          contentNodeTypes,
          ruleId
        );
      }

      i++;
      j++;
    } else {
      // Missing section
      if (schemaSection.required) {
        file.message(
          `Missing required section: ${path}${expectedName}${
            schemaSection.description ? ` — ${schemaSection.description}` : ''
          }`,
          null, // No position -> appears as 0,0 in CSV
          ruleId
        );
      }

      // Out-of-order section
      if (enforceOrder && current && !matchesHeading(current, schemaSection)) {
        file.message(
          `Section "${current.title}" is out of order. Expected "${expectedName}" at ${
            path || 'root level'
          }.${schemaSection.description ? ` — ${schemaSection.description}` : ''}`,
          current.position || null,
          ruleId
        );
      }

      j++;
    }
  }
}

export default function remarkLintStructure(options = {}) {
  const schemaPath = options.schemaPath || './doc-structure-schema.yaml';
  let schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  // Remove BOM if present
  if (schemaContent.charCodeAt(0) === 0xfeff) {
    schemaContent = schemaContent.slice(1);
  }

  // Parse YAML or JSON
  let schema;
  if (schemaPath.endsWith('.yaml') || schemaPath.endsWith('.yml')) {
    schema = YAML.parse(schemaContent);
  } else {
    schema = JSON.parse(schemaContent);
  }

  // Normalize dashes in descriptions
  function normalizeDescriptions(sections) {
    if (!sections) return;
    for (const sec of sections) {
      if (sec.description) {
        sec.description = sec.description.replace(/\u2013|\u2014/g, '-').replace(/,/g, '');
      }
      if (sec.children) {
        normalizeDescriptions(sec.children);
      }
    }
  }
  normalizeDescriptions(schema.sections);

  if (!schema.sections || !Array.isArray(schema.sections)) {
    throw new Error('Invalid schema: Must define "sections" array');
  }

  const globalAllowChildren =
    schema.allowChildrenToSatisfyNonEmpty ?? false;

  const contentNodeTypes = new Set(
    schema.contentNodeTypes || ['paragraph', 'list', 'code', 'blockquote', 'table']
  );

  const ruleId = options.ruleId || 'remark-lint-structure';

  return (tree, file) => {
    const headingTree = buildHeadingTree(tree);
    validateSections(
      file,
      headingTree,
      schema.sections,
      '',
      schema.enforceOrder ?? false,
      globalAllowChildren,
      contentNodeTypes,
      ruleId
    );
  };
}
