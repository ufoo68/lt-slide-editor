export const allowedStillMediaTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
export const allowedVideoTypes = new Set(["video/mp4", "video/ogg", "video/quicktime", "video/webm"]);
export const maxStillMediaSize = 5 * 1024 * 1024;
export const maxVideoSize = 100 * 1024 * 1024;

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function mediaMarkdown(media: { contentType: string; filename: string; id: string }) {
  const src = `/api/media/${media.id}/file`;
  const style = "position:absolute;left:29%;top:33%;width:42%;height:34%;object-fit:contain;";
  if (media.contentType.startsWith("video/")) {
    return `<video controls src="${src}" title="${escapeAttribute(media.filename)}" style="${style}"></video>`;
  }
  return `<img src="${src}" alt="${escapeAttribute(media.filename)}" style="${style}">`;
}

export function serializeMedia<T extends { contentType: string; filename: string; id: string }>(media: T) {
  return { ...media, markdown: mediaMarkdown(media), url: `/api/media/${media.id}/file` };
}

export function validateMediaFile(file: File) {
  if (!allowedStillMediaTypes.has(file.type) && !allowedVideoTypes.has(file.type)) return "unsupported media type";
  const maxSize = file.type.startsWith("video/") ? maxVideoSize : maxStillMediaSize;
  return file.size > maxSize ? "media is too large" : null;
}
