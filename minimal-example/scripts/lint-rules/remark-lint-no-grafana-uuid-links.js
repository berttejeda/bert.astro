import { visit } from 'unist-util-visit';

export default function remarkLintNoGrafanaLinks() {
  const forbiddenPattern = /(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\/d\/[a-zA-Z0-9]+\//;

  return (tree, file) => {
    visit(tree, 'link', (node) => {
      if (typeof node.url === 'string' && forbiddenPattern.test(node.url)) {
        file.message(
          `Forbidden link pattern detected: "${node.url}" (matches grafana/d/[a-zA-Z0-9]+/)`,
          node
        );
      }
    });
  };
}
