import { highlightCSharp } from './csharp.js';

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
    textarea.addEventListener('input', paint);
    textarea.addEventListener('scroll', sync);
    const resize = new ResizeObserver(sync);
    resize.observe(textarea);
    paint();
    return () => {
        resize.disconnect();
        textarea.removeEventListener('input', paint);
        textarea.removeEventListener('scroll', sync);
    };
}
