export const pageImageUrl = (pageId: number) =>
  `/api/notebooks/pages/${pageId}/image`;

export async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    return ((await response.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export const notebookPdfUrl = (notebookId: number) =>
  `/api/notebooks/${notebookId}/pdf`;
