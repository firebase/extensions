export const isImage = (contentType: string): boolean =>
  contentType.startsWith("image/");

export const isResizedImage = (fileName: string, suffix: string): boolean =>
  fileName.endsWith(suffix);
