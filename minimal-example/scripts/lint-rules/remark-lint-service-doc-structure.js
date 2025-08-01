import { visit } from 'unist-util-visit';
import fs from 'fs';
import debugLib from 'debug';
import YAML from 'yaml';

const debug = debugLib('remark:lint-structure');

/**
 * Extract heading text from a heading node.
 */
function getHeadingText(node) {
  return node.children
    .filter((child) => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim();
}

/**
 * Extract visible text from any node (paragraphs, code, list items, etc.).
 */
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

/**
 * Build hierarchical tree of headings and associate meaningful content.
 */
function buildHeadingTree(tree) {
  const headings = [];
  const stack = [];

  visit(tree, (node, index, parent) => {
    if (node.type === 'yaml') return; // Ignore frontmatter

    if (node.type === 'heading') {
      const text = getHeadingText(node);
      const newHeading = {
        title: text,
        depth: node.depth,
        children: [],
        content: []
      };

      // Pop higher/equal depth headings from stack
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
      // Skip children of heading nodes (like text nodes inside headings)
      if (parent && parent.type === 'heading') return;

      // Attach content to current heading (if any)
      if (stack.length > 0) {
        stack[stack.length - 1].content.push(node);
      }
    }
  });

  return headings;
}

/**
 * Determine if heading matches schema (title or regex pattern).
 */
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

/**
 * Validate sections recursively against schema.
 */
function validateSections(
  file,
  sections,
  schemaSections,
  path = '',
  enforceOrder = false,
  globalAllowChildren = false,
  contentNodeTypes = new Set(['paragraph', 'list', 'code', 'blockquote', 'table']),
  ruleId
) {
  let i = 0;
  let j = 0;

  while (j < schemaSections.length) {
    const schemaSection = schemaSections[j];
    const current = sections[i];
    const expectedName = schemaSection.title || schemaSection.titlePattern;

    if (current && matchesHeading(current, schemaSection)) {
      // Determine allowChildrenToSatisfyNonEmpty (section overrides global)
      const allowChildren =
        schemaSection.allowChildrenToSatisfyNonEmpty ?? globalAllowChildren;

      // Debug: log content nodes
      debug(`Checking section "${path}${expectedName}"`);
      current.content.forEach((node, index) => {
        debug(`  [${index}] type = ${node.type}, text = "${getNodeText(node)}"`);
      });

      // Check nonEmpty rule
      if (schemaSection.nonEmpty) {
        const hasValidContent = current.content.some((node) =>
          contentNodeTypes.has(node.type)
        );
        const hasChildren = current.children.length > 0;

        const satisfiesNonEmpty =
          hasValidContent || (allowChildren && hasChildren);

        if (!satisfiesNonEmpty) {
          file.message(`Section "${path}${expectedName}" must not be empty.`, null, ruleId);
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
      if (schemaSection.required) {
        file.message(`Missing required section: ${path}${expectedName}: ${schemaSection.description ? ` - ${schemaSection.description}` : ''}`, null, ruleId);
      }
      if (enforceOrder && current && !matchesHeading(current, schemaSection)) {
        file.message(
          `Section "${current.title}" is out of order. Expected "${expectedName}" at ${
            path || 'root level'
          }.`, null, ruleId
        );
      }
      j++;
    }
  }
}

/**
 * Remark-lint plugin entrypoint.
 */
export default function remarkLintStructure(options = {}) {
  const schemaPath = options.schemaPath || './doc-structure-schema.json';
  const ruleId = options.ruleId || 'n/a';

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  // Remove BOM if present
  if (schemaContent.charCodeAt(0) === 0xfeff) {
    schemaContent = schemaContent.slice(1);
  }

  let schema;

  if (schemaPath.endsWith('.yaml') || schemaPath.endsWith('.yml')) {
    schema = YAML.parse(schemaContent);
  } else {
    schema = JSON.parse(schemaContent);
  }  

  if (!schema.sections || !Array.isArray(schema.sections)) {
    throw new Error('Invalid schema: Must define "sections" array');
  }

  const globalAllowChildren =
    schema.allowChildrenToSatisfyNonEmpty ?? false;

  // Allow schema to define content node types, fallback to default
  const contentNodeTypes = new Set(
    schema.contentNodeTypes || ['paragraph', 'list', 'code', 'blockquote', 'table']
  );

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
