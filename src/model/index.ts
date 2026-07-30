/**
 * Public surface of the LoreFountain model layer.
 *
 * Re-exports the entity/glossary schemas, their parse/serialize functions, the
 * frontmatter primitives, slug derivation, and shared error/result types. This
 * layer has no `vscode` dependency and is pure-unit-testable.
 */

export * from './errors';
export * from './slug';
export * from './frontmatter';
export * from './entity';
export * from './glossary';
export * from './timeline';
