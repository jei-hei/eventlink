const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function clampSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (width <= maxWidth && height <= maxHeight) return { width, height };
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function optimizeImageForUpload(
  file: File,
  opts?: { maxWidth?: number; maxHeight?: number; quality?: number },
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!IMAGE_TYPES.has(file.type)) return file;

  const maxWidth = opts?.maxWidth ?? 1600;
  const maxHeight = opts?.maxHeight ?? 1600;
  const quality = opts?.quality ?? 0.84;

  const bitmap = await createImageBitmap(file);
  const target = clampSize(bitmap.width, bitmap.height, maxWidth, maxHeight);

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.\-() ]+/g, "_").trim() || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}
