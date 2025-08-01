// remark-lint-prerequisites.js
export default function remarkLintPrerequisites() {
  return (tree, file) => {
    let hasPrerequisites = false;

    // Visit headings in the Markdown AST
    for (const node of tree.children) {
      if (node.type === 'heading' && node.depth === 1) {
        const text = node.children
          .filter((child) => child.type === 'text')
          .map((child) => child.value)
          .join('')
          .trim();

        if (text.toLowerCase() === 'prerequisites') {
          hasPrerequisites = true;
          break;
        }
      }
    }

    if (!hasPrerequisites) {
      file.message('Document must contain a `# Prerequisites` section.');
    }
  };
}
