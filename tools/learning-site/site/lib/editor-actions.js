import { tokenizeCSharp } from './csharp.js';

const unit = '    ';
const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
const closers = new Set(Object.values(pairs));
const handled = new Set([...Object.keys(pairs), ...closers, 'Enter', 'Tab', 'Backspace']);
const lineStart = (value, position) => position === 0 ? 0 : value.lastIndexOf('\n', position - 1) + 1;
const leading = value => /^[\t ]*/.exec(value)[0];
function escaped(value, position) {
    let slashes = 0;
    for (let i = position - 1; i >= 0 && value[i] === '\\'; i--) slashes++;
    return slashes % 2 === 1;
}
function closedString(text) {
    const raw = /^(?:\$+)?("{3,})/.exec(text);
    if (raw) return text.length >= raw[0].length + raw[1].length && text.endsWith(raw[1]);
    const start = /^(\$@|@\$|@|\$)?(["'])/.exec(text);
    // Interpolated strings have separate trailing string tokens after their expression.
    if (!start) return text.endsWith('"');
    const verbatim = start[1]?.includes('@'), quote = start[2];
    for (let i = start[0].length; i < text.length; i++) {
        if (!verbatim && text[i] === '\\') { i++; continue; }
        if (text[i] === quote) {
            if (verbatim && text[i + 1] === quote) { i++; continue; }
            return i === text.length - 1;
        }
    }
    return false;
}
function contextAt(tokens, position) {
    let offset = 0;
    for (const token of tokens) {
        const end = offset + token.text.length;
        if (position > offset && position < end && ['comment', 'string'].includes(token.kind)) return token.kind;
        if (position === end) {
            if (token.kind === 'comment' && !token.text.endsWith('*/')) return 'comment';
            if (token.kind === 'string' && !closedString(token.text)) return 'string';
        }
        offset = end;
    }
    return 'code';
}
function atClosingQuote(tokens, position, quote) {
    let offset = 0;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i], end = offset + token.text.length;
        if (token.kind === 'string' && position === end - 1 && token.text.endsWith(quote)) {
            return closedString(token.text) || (token.text === '"' && tokens[i - 1]?.text === '}');
        }
        offset = end;
    }
    return false;
}
function openBraceIndent(value, tokens, position) {
    const stack = [];
    let offset = 0;
    for (const token of tokens) {
        if (offset >= position) break;
        if (token.kind === 'punctuation') {
            if (token.text === '{') stack.push(offset);
            else if (token.text === '}') stack.pop();
        }
        offset += token.text.length;
    }
    if (!stack.length) return null;
    const open = stack.at(-1);
    return leading(value.slice(lineStart(value, open), open));
}
function replacement(from, to, text, start = from + text.length, end = start, direction = 'none') {
    return { from, to, text, start, end, direction };
}
function indentLines(value, start, end, outdent, direction) {
    const from = lineStart(value, start);
    const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const newline = value.indexOf('\n', last);
    const to = newline < 0 ? value.length : newline;
    const lines = value.slice(from, to).split('\n'), operations = [];
    let offset = from;
    const changed = lines.map(line => {
        const remove = outdent ? (line.startsWith('\t') ? 1 : Math.min(4, leading(line).length)) : 0;
        const insert = outdent ? '' : unit;
        operations.push({ at: offset, remove, add: insert.length });
        offset += line.length + 1;
        return insert + line.slice(remove);
    }).join('\n');
    const map = position => {
        let change = 0;
        for (const op of operations) {
            if (position < op.at) break;
            if (position < op.at + op.remove) return op.at + change;
            change += op.add - op.remove;
        }
        return position + change;
    };
    if (changed === value.slice(from, to)) return { start, end, direction };
    return replacement(from, to, changed, map(start), map(end), direction);
}

// Pure edit plans keep keyboard behavior independently testable, including caret positions.
export function planKeyEdit({ value, start, end = start, direction = 'none' }, key, options = {}) {
    if (options.isComposing || options.ctrlKey || options.metaKey || options.altKey || !handled.has(key)) return null;
    const beginning = lineStart(value, start);
    const before = value.slice(beginning, start), after = value.slice(end);
    const indent = leading(before), selected = value.slice(start, end);
    if (key === 'Tab') {
        if (start !== end || options.shiftKey) return indentLines(value, start, end, !!options.shiftKey, direction);
        let column = 0;
        for (const c of before) column += c === '\t' ? 4 - column % 4 : 1;
        return replacement(start, end, ' '.repeat(4 - column % 4));
    }
    const tokens = tokenizeCSharp(value), context = contextAt(tokens, start);
    if (key === 'Backspace') {
        if (start !== end || !start) return null;
        const previous = value[start - 1], next = value[start];
        if ((context === 'code' || (context === 'string' && ['"', "'"].includes(previous))) && Object.hasOwn(pairs, previous) && pairs[previous] === next && (!['"', "'"].includes(previous) || !escaped(value, start - 1))) {
            return replacement(start - 1, start + 1, '');
        }
        if (context === 'code' && previous === '{') {
            const empty = /^\n[\t ]*}/.exec(value.slice(start));
            if (empty) return replacement(start - 1, start + empty[0].length, '');
        }
        if (context !== 'string' && before.length && /^[\t ]+$/.test(before)) {
            const remove = before.endsWith('\t') ? 1 : Math.min(before.length, (before.length - 1) % 4 + 1);
            return replacement(start - remove, start, '');
        }
        return null;
    }
    if (key === 'Enter') {
        if (context === 'string') return null;
        if (context === 'code' && before.trimEnd().endsWith('{')) {
            // Consume an existing closing-brace line from auto-pairing instead of duplicating it.
            const closingGap = /^[\t ]*(?:\n[\t ]*)?(?=})/.exec(after);
            if (closingGap) return replacement(start, end + closingGap[0].length, '\n' + indent + unit + '\n' + indent, start + 1 + indent.length + unit.length);
            return replacement(start, end, '\n' + indent + unit);
        }
        return replacement(start, end, '\n' + indent);
    }
    const quote = key === '"' || key === "'";
    if (context === 'comment') return null;
    if (quote && escaped(value, start)) return null;
    if (quote && start === end && after.startsWith(key) && atClosingQuote(tokens, start, key)) return { start: start + 1, end: start + 1, direction: 'none' };
    if (context === 'string') return null;
    if (key === '}' && context === 'code' && start === end && /^[\t ]*$/.test(before)) {
        const base = openBraceIndent(value, tokens, start);
        if (base !== null) {
            const closingGap = /^[\t \n]*(?=})/.exec(after);
            return replacement(beginning, end + (closingGap ? closingGap[0].length + 1 : 0), base + '}');
        }
    }
    if (start === end && closers.has(key) && after.startsWith(key) && !quote) {
        // Moving over an existing closing delimiter does not modify the source or undo history.
        return { start: start + 1, end: start + 1, direction: 'none' };
    }
    if (context === 'string' || !Object.hasOwn(pairs, key)) return null;
    if (selected) return replacement(start, end, key + selected + pairs[key], start + 1, end + 1, direction);
    // Avoid adding a closing delimiter in the middle of an existing word.
    if (after && !/^[\s)\]};,:]/.test(after)) return null;
    if (key === '{' && /^[\t ]*(?:\n|$)/.test(after)) {
        return replacement(start, end, '{\n' + indent + '}', start + 1);
    }
    return replacement(start, end, key + pairs[key], start + 1);
}
