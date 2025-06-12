/**
 * Processes image URLs to use the file proxy for S3 URLs
 * This helps avoid CORS issues and handles signed URLs
 */
export function getProxiedImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  // If it's already a relative URL or data URL, return as-is
  if (url.startsWith('/') || url.startsWith('data:')) {
    return url;
  }
  
  // If it's an S3 URL or external URL, proxy it
  if (url.includes('amazonaws.com') || url.includes('s3.') || url.startsWith('http')) {
    return `/api/file-proxy?url=${encodeURIComponent(url)}`;
  }
  
  // Otherwise return as-is
  return url;
}