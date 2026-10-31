import { highlightCSharp } from './csharp.js';
import { planKeyEdit } from './editor-actions.js';

export function mountCodeEditor(textarea) {
    if (!textarea) return () => {};
    const surface = textarea.closest('.code-surface');
    const highlight = surface.querySelector('.code-highlight');
    const code = highlight.querySelector('code');
    const gutter = textarea.closest('.code-editor').querySelector('.line-numbers');
    const sync = () => {
        highlight.style.width = `${textarea.clientWidth}px`;
        highlight.style.height = `${textarea.clientHeight}px`;
        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
        gutter.style.transform = `translateY(${-textarea.scrollTop}px)`;
    };
    const paint = () => {
        // Escape source in the highlighter. Never replace the editable text or selection.
        // The zero-width end marker gives a trailing empty line the same height as textarea.
        code.innerHTML = highlightCSharp(textarea.value) + '\u200b';
        gutter.textContent = textarea.value.split('\n').map((_, i) => i + 1).join('\n');
        sync();
    };
    let applying = false, composing = false, escapeTab = false, inputSeen = false;
    const onInput = () => { inputSeen = true; paint(); };
    const apply = plan => {
        if (!plan) return false;
        if (plan.text !== undefined) {
            applying = true;
            inputSeen = false;
            const oldValue = textarea.value;
            textarea.setSelectionRange(plan.from, plan.to);
            // Native insertText keeps paired insertion/indentation as an undoable edit.
            let inserted = false;
            try { inserted = document.execCommand('insertText', false, plan.text); } catch {}
            if (!inserted && textarea.value === oldValue) {
                textarea.setRangeText(plan.text, plan.from, plan.to, 'end');
            }
            if (!inputSeen && textarea.value !== oldValue) textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: plan.text }));
            applying = false;
        }
        textarea.setSelectionRange(plan.start, plan.end, plan.direction);
        paint();
        return true;
    };
    const planFor = (key, options = {}) => planKeyEdit({ value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd, direction: textarea.selectionDirection }, key, options);
    const keydown = event => {
        if (event.defaultPrevented || event.isComposing || composing || event.keyCode === 229) return;
        if (event.key === 'Escape') { escapeTab = true; return; }
        if (event.key === 'Tab' && escapeTab) { escapeTab = false; return; }
        escapeTab = false;
        const plan = planFor(event.key, event);
        if (plan) { event.preventDefault(); apply(plan); }
    };
    const beforeInput = event => {
        if (event.defaultPrevented || applying || composing || event.isComposing || !event.cancelable) return;
        const key = event.inputType === 'insertLineBreak' ? 'Enter' : event.inputType === 'deleteContentBackward' ? 'Backspace' : event.inputType === 'insertText' && event.data?.length === 1 ? event.data : null;
        if (!key) return;
        const plan = planFor(key);
        if (plan) { event.preventDefault(); apply(plan); }
    };
    const compositionStart = () => { composing = true; };
    const compositionEnd = () => { composing = false; paint(); };
    textarea.addEventListener('keydown', keydown);
    textarea.addEventListener('beforeinput', beforeInput);
    textarea.addEventListener('compositionstart', compositionStart);
    textarea.addEventListener('compositionend', compositionEnd);
    textarea.addEventListener('input', onInput);
    textarea.addEventListener('scroll', sync);
    const resize = new ResizeObserver(sync);
    resize.observe(textarea);
    paint();
    return () => {
        resize.disconnect();
        textarea.removeEventListener('keydown', keydown);
        textarea.removeEventListener('beforeinput', beforeInput);
        textarea.removeEventListener('compositionstart', compositionStart);
        textarea.removeEventListener('compositionend', compositionEnd);
        textarea.removeEventListener('input', onInput);
        textarea.removeEventListener('scroll', sync);
    };
}
