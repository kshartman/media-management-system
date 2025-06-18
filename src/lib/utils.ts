/**
 * Processes URLs for direct access to S3 media files
 * S3 bucket configured with proper CORS headers for Safari video streaming compatibility
 */
export function getProxiedImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  // Return URL as-is for direct S3 access
  // URLs are stored in regional format and S3 bucket has proper CORS configuration
  return url;
}