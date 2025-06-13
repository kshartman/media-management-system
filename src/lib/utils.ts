/**
 * Processes URLs for direct access since S3 bucket allows public read
 * Returns the URL as-is for direct access
 */
export function getProxiedImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  // Return URL as-is for direct access (S3 bucket allows public read)
  return url;
}