import type { KeyboardEvent } from "react";

export function insertTextareaTab(event: KeyboardEvent<HTMLTextAreaElement>, onChange: (value: string) => void) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  event.preventDefault();
  const textarea = event.currentTarget;
  const { selectionEnd, selectionStart, value } = textarea;
  const nextValue = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
  const nextCursor = selectionStart + 2;

  onChange(nextValue);
  requestAnimationFrame(() => {
    textarea.selectionStart = nextCursor;
    textarea.selectionEnd = nextCursor;
  });
}
