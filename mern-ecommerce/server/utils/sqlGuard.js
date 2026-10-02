/**
 * Guard for the SQL that Select AI generates for POST /api/ai/ask, which the
 * server then runs as the schema owner. Only one plain read-only query passes;
 * anything else is reported to the admin instead of executed.
 *
 * Keywords are looked for in a copy of the statement whose literals and quoted
 * identifiers have been blanked. The blanking is a real left-to-right scan, not
 * a regex: Oracle q-quoted literals (q'[it's]') and "quoted identifiers" may hold
 * a lone apostrophe, which desynchronises any pattern that only knows '...' and
 * hides the text between two such apostrophes from the keyword scan.
 */
const NOT_READ_ONLY =
  /\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|rename|comment|lock|call|begin|declare|execute|exec|pragma|commit|rollback|savepoint|into)\b/i;

// Packages that reach outside the query (HTTP, files, jobs, cloud) wherever they
// appear, plus the data dictionary and fixed views, which expose other schemas'
// metadata. `\bsys\s*\.` also covers `sys . obj`.
const PACKAGE_CALL = /(dbms|utl|owa|apex)_/i;
const DICTIONARY = /\b(sys|system)\s*\.|\b(dba|cdb)_\w|\bg?v\$|\bx\$/i;
// A quoted identifier is blanked too, so its name is judged separately.
const DICTIONARY_NAME = /^\s*(sys|system)\s*$|\b(dba|cdb)_\w|\bg?v\$|\bx\$|(dbms|utl|owa|apex)_/i;

const WITH_ROUTINE = /\bwith\s+(function|procedure)\b/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const CLOSER = { '[': ']', '{': '}', '(': ')', '<': '>' };
const IDENT_CHAR = /[\w$#]/;

// Length of the q / nq prefix just before the quote at `index`, 0 if it is a
// plain string. Oracle lexes identifiers greedily, so `faq'x'` is not q-quoted.
const qPrefixLength = (sql, index) => {
  const isBoundary = position => position < 0 || !IDENT_CHAR.test(sql[position]);
  if (/q/i.test(sql[index - 1] || '')) {
    if (isBoundary(index - 2)) return 1;
    if (/n/i.test(sql[index - 2]) && isBoundary(index - 3)) return 2;
  }
  return 0;
};

/**
 * Returns { scan, names } with every literal replaced by '' and every quoted
 * identifier by "", or { error } when the text cannot be tokenised safely
 * (unterminated literal or identifier, comment, odd q-quote delimiter).
 */
const blank = sql => {
  const names = [];
  let scan = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    if (ch === "'") {
      const prefix = qPrefixLength(sql, i);
      if (prefix > 0) {
        const open = sql[i + 1];
        if (open === undefined || /\s|'/.test(open)) return { error: 'ambiguous q-quote' };
        const close = `${CLOSER[open] || open}'`;
        const end = sql.indexOf(close, i + 2);
        if (end === -1) return { error: 'unterminated q-quote' };
        scan = `${scan.slice(0, scan.length - prefix)}''`;
        i = end + 2;
        continue;
      }

      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] !== "'") j += 1;
        else if (sql[j + 1] === "'") j += 2;
        else break;
      }
      if (j >= sql.length) return { error: 'unterminated string' };
      scan += "''";
      i = j + 1;
      continue;
    }

    if (ch === '"') {
      const end = sql.indexOf('"', i + 1);
      if (end === -1) return { error: 'unterminated identifier' };
      names.push(sql.slice(i + 1, end));
      scan += '""';
      i = end + 1;
      continue;
    }

    // A comment can hide text from this scan but not from the database.
    if ((ch === '-' && sql[i + 1] === '-') || (ch === '/' && sql[i + 1] === '*')) {
      return { error: 'comment' };
    }

    scan += ch;
    i += 1;
  }

  return { scan, names };
};

/** Returns { sql } for a runnable statement or { skipped } with the reason. */
const checkGeneratedSql = generated => {
  const sql = String(generated || '').trim().replace(/;\s*$/, '').trim();
  if (!sql) return { skipped: 'Select AI did not return any SQL for this question.' };

  if (CONTROL_CHARS.test(sql)) return { skipped: 'The generated SQL contains control characters, so it was not run.' };

  const { scan, names, error } = blank(sql);
  if (error === 'comment') return { skipped: 'The generated SQL contains comments, so it was not run.' };
  if (error) return { skipped: 'The generated SQL could not be checked safely, so it was not run.' };

  if (!/^(select|with)\b/i.test(scan)) return { skipped: 'Only SELECT statements are run; this one was not.' };
  if (scan.includes(';')) return { skipped: 'The generated text holds more than one statement, so it was not run.' };
  if (scan.includes('@')) return { skipped: 'The generated SQL uses a database link, so it was not run.' };
  if (WITH_ROUTINE.test(scan)) return { skipped: 'The generated SQL declares a function or procedure, so it was not run.' };

  if (
    NOT_READ_ONLY.test(scan) ||
    PACKAGE_CALL.test(scan) ||
    DICTIONARY.test(scan) ||
    names.some(name => DICTIONARY_NAME.test(name))
  ) {
    return { skipped: 'The generated SQL is not a plain read-only query, so it was not run.' };
  }

  return { sql };
};

module.exports = { checkGeneratedSql };
