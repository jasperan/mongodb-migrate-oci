// Turns a user-typed search term into a literal pattern. Search boxes feed the
// value straight into a RegExp, so an unbalanced ( or * would otherwise throw.
exports.escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
