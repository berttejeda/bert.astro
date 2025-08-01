module.exports = {
  plugins: [
    'remark-frontmatter',
    'remark-lint-heading-increment',
    'remark-preset-lint-recommended',
    'remark-lint-no-undefined-references',
    // Add individual rules here, e.g. enforce ordered list style:
    ['remark-lint-ordered-list-marker-style', '.'], // Enforce `1.` style
    ['remark-lint-final-newline', true], // Require final newline at EOF,
    // [require.resolve('./scripts/lint-rules/remark-lint-sections.js')],
    [require.resolve('./scripts/lint-rules/remark-lint-service-doc-structure.js'), { schemaPath: './scripts/lint-rules/service-doc-structure-schema.json' }],
    [require.resolve('./scripts/lint-rules/remark-lint-no-grafana-uuid-links.js')],
  ],
};
