// Turns a user-typed search term into a literal pattern. Search boxes feed the
// value straight into a RegExp, so an unbalanced ( or * would otherwise throw.
// NUL bytes are dropped: the driver refuses a regex that contains one (HTTP 500).
exports.escapeRegex = value =>
  String(value).replace(/\0/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Pragmatic address check (one @, a dot in the domain, no whitespace); the
// mail provider remains the authority on deliverability.
exports.isEmail = value =>
  typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

exports.normalizeEmail = value => String(value).trim().toLowerCase();
