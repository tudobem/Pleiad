import type { SaveResult } from '../../core/device.ts';

/**
 * Hand a text file to the user: the share sheet where it accepts files (iOS:
 * Save to Files), otherwise a normal download.
 */
export async function saveFile(
  name: string,
  text: string,
  type = 'application/json',
): Promise<SaveResult> {
  const file = new File([text], name, { type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Fall through to a download if sharing failed for another reason.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
