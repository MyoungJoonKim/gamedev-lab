// Display-only C# lexer. The original source stays in the textarea for editing/execution.
const keywords = new Set(('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while add alias and ascending async await by descending dynamic equals file from get global group init into join let managed nameof not notnull on or orderby partial record remove required scoped select set unmanaged value var when where with yield').split(' '));
const flow = new Set('await break case catch continue default do else finally for foreach goto if in lock return switch throw try when while yield'.split(' '));
const types = new Set(('Action ArgumentException Array CancellationToken CancellationTokenSource Collider Color Console Coroutine Debug Dictionary Enum Exception Func GameObject HashSet IDisposable IEnumerable IEnumerator IList IReadOnlyList Input InputSystem LayerMask List Mathf Math MonoBehaviour NetworkBehaviour NetworkList NetworkObject NetworkVariable Object ObjectPool Physics Quaternion Random Ray RaycastHit RectTransform Rigidbody ScriptableObject SerializeField Serializable ServerRpc ServerRpcParams ClientRpc Rpc Space String StringBuilder Task Time Transform Vector2 Vector3 Vector4 WaitForSeconds Header Tooltip Range Min RequireComponent CreateAssetMenu UnityEngine System').split(' '));
const identifier = /^@?[\p{L}_][\p{L}\p{N}\p{Mn}\p{Mc}\p{Pc}]*/u;
const number = /^(?:0[xX][\da-fA-F_]+(?:[uUlL]{0,2})|0[bB][01_]+(?:[uUlL]{0,2})|(?:\d[\d_]*(?:\.(?!\.)[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?[fFdDmMuUlL]{0,2})/;
function quotedEnd(source, start, quote, verbatim) {
    for (let i = start; i < source.length; i++) {
        if (!verbatim && source[i] === '\\') { i++; continue; }
        if (source[i] === quote) {
            if (verbatim && source[i + 1] === quote) { i++; continue; }
            return i + 1;
        }
    }
    return source.length;
}
function expressionEnd(source, start) {
    let depth = 1;
    for (let i = start; i < source.length; i++) {
        if (source.startsWith('//', i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue; }
        if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 1; continue; }
        if (source[i] === '"' || source[i] === "'") { i = quotedEnd(source, i + 1, source[i], source[i - 1] === '@') - 1; continue; }
        if (source[i] === '{') depth++;
        if (source[i] === '}' && --depth === 0) return i;
    }
    return source.length;
}
export function tokenizeCSharp(source) {
    const tokens = [];
    const add = (text, kind = '') => { if (text) tokens.push({ text, kind }); };
    for (let i = 0; i < source.length;) {
        const rest = source.slice(i);
        const whitespace = /^\s+/.exec(rest);
        if (whitespace) { add(whitespace[0]); i += whitespace[0].length; continue; }
        if (rest.startsWith('//')) { const end = source.indexOf('\n', i); const stop = end < 0 ? source.length : end; add(source.slice(i, stop), 'comment'); i = stop; continue; }
        if (rest.startsWith('/*')) { const end = source.indexOf('*/', i + 2); const stop = end < 0 ? source.length : end + 2; add(source.slice(i, stop), 'comment'); i = stop; continue; }
        if (source[i] === '#' && /^\s*$/.test(source.slice(source.lastIndexOf('\n', i - 1) + 1, i))) {
            const end = source.indexOf('\n', i); const stop = end < 0 ? source.length : end; add(source.slice(i, stop), 'directive'); i = stop; continue;
        }
        const stringStart = /^(\$+@?|@\$?)?("+)/.exec(rest);
        if (stringStart) {
            const prefix = stringStart[1] || '', quotes = stringStart[2].length;
            if (quotes >= 3) {
                const close = source.indexOf('"'.repeat(quotes), i + stringStart[0].length);
                const end = close < 0 ? source.length : close + quotes;
                add(source.slice(i, end), 'string'); i = end; continue;
            }
            // Two quotes are an empty ordinary string, not a raw-string delimiter.
            const opening = i + prefix.length + 1;
            const verbatim = prefix.includes('@'), interpolated = prefix.includes('$');
            if (!interpolated) { const end = quotedEnd(source, opening, '"', verbatim); add(source.slice(i, end), 'string'); i = end; continue; }
            let segment = i, cursor = opening, done = false;
            while (cursor < source.length) {
                if (!verbatim && source[cursor] === '\\') { cursor += 2; continue; }
                if (source[cursor] === '"') {
                    if (verbatim && source[cursor + 1] === '"') { cursor += 2; continue; }
                    cursor++; add(source.slice(segment, cursor), 'string'); i = cursor; done = true; break;
                }
                if (source.startsWith('{{', cursor) || source.startsWith('}}', cursor)) { cursor += 2; continue; }
                if (source[cursor] === '{') {
                    add(source.slice(segment, cursor), 'string'); add('{', 'punctuation');
                    const end = expressionEnd(source, cursor + 1);
                    tokens.push(...tokenizeCSharp(source.slice(cursor + 1, end)));
                    if (end < source.length) add('}', 'punctuation');
                    cursor = end < source.length ? end + 1 : end; segment = cursor; continue;
                }
                cursor++;
            }
            if (!done) { add(source.slice(segment), 'string'); i = source.length; }
            continue;
        }
        if (source[i] === "'") { const end = quotedEnd(source, i + 1, "'", false); add(source.slice(i, end), 'string'); i = end; continue; }
        const numeric = number.exec(rest);
        if (numeric) { add(numeric[0], 'number'); i += numeric[0].length; continue; }
        const name = identifier.exec(rest);
        if (name) {
            const word = name[0];
            add(word, word.startsWith('@') ? 'identifier' : keywords.has(word) ? (flow.has(word) ? 'flow' : 'keyword') : 'identifier');
            i += word.length; continue;
        }
        add(source[i], 'punctuation'); i++;
    }
    return classify(tokens);
}
function classify(tokens) {
    const significant = tokens.filter(t => t.kind && t.kind !== 'comment' && t.kind !== 'directive');
    const knownTypes = new Set(types), methods = new Set(), constants = new Set();
    for (let i = 0; i < significant.length; i++) {
        const current = significant[i], previous = significant[i - 1], next = significant[i + 1];
        if (current.kind === 'identifier' && ['class', 'struct', 'interface', 'enum', 'record', 'new', 'as', 'is'].includes(previous?.text)) knownTypes.add(current.text);
        if (current.kind === 'identifier') {
            let call = next?.text === '(';
            if (next?.text === '<') {
                let depth = 0;
                for (let j = i + 1; j < significant.length; j++) {
                    if (significant[j].text === '<') depth++;
                    if (significant[j].text === '>' && --depth === 0) { call = significant[j + 1]?.text === '('; break; }
                    if ([';', '{', '}'].includes(significant[j].text)) break;
                }
            }
            if (next?.kind === 'identifier') knownTypes.add(current.text);
            if (call && !knownTypes.has(current.text)) methods.add(current.text);
        }
        if (current.text === 'const') {
            for (let j = i + 1; j < significant.length && ![';', '{', '}'].includes(significant[j].text); j++) {
                if (significant[j].kind === 'identifier' && significant[j + 1]?.text === '=') { constants.add(significant[j].text); break; }
            }
        }
    }
    for (let i = 0; i < significant.length; i++) {
        const current = significant[i], next = significant[i + 1];
        if (current.kind !== 'identifier') continue;
        if (constants.has(current.text)) current.kind = 'constant';
        else if (knownTypes.has(current.text)) current.kind = 'type';
        else if (methods.has(current.text)) current.kind = 'function';
        else if (/^[A-Z]/.test(current.text) && next?.text === '<') current.kind = 'type';
        else current.kind = 'variable';
    }
    return tokens;
}
function escapeHTML(value) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function highlightCSharp(source) {
    return tokenizeCSharp(source).map(t => t.kind ? `<span class="cs-${t.kind}">${escapeHTML(t.text)}</span>` : escapeHTML(t.text)).join('');
}
