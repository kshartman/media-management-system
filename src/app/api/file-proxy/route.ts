import { NextRequest, NextResponse } from 'next/server';
import { config } from '../route.config';

export { config };

/**
 * Proxies requests to S3 or other file storage to avoid CORS issues
 * For S3 URLs, this will get a signed URL from the backend first
 */
export async function GET(request: NextRequest) {
  // Get URL from the request
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }
  
  try {
    let finalUrl = url;
    
    // Check if this is an S3 URL that needs a signed URL
    if (url.includes('amazonaws.com') || url.includes('s3.')) {
      try {
        // Get signed URL from the backend
        const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const signedUrlResponse = await fetch(`${serverUrl}/api/files/signed-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileUrl: url }),
        });
        
        if (signedUrlResponse.ok) {
          const signedData = await signedUrlResponse.json();
          if (signedData.signedUrl) {
            finalUrl = signedData.signedUrl;
          }
        } else {
          console.warn('Could not get signed URL, trying direct access');
        }
      } catch (signedUrlError) {
        console.warn('Error getting signed URL, trying direct access:', signedUrlError instanceof Error ? signedUrlError.message : String(signedUrlError));
      }
    }
    
    // Fetch the file from the final URL
    const response = await fetch(finalUrl);
    
    if (!response.ok) {
      console.error(`File fetch failed: ${response.status} ${response.statusText} for URL: ${finalUrl}`);
      return NextResponse.json({ 
        error: 'Failed to fetch file',
        details: `${response.status} ${response.statusText}`,
        url: finalUrl 
      }, { status: 502 });
    }
    
    // Get the file type from the response headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    // Get the file data as an array buffer
    const buffer = await response.arrayBuffer();
    
    // Create a new response with the file data and appropriate headers
    const newResponse = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentLength && { 'Content-Length': contentLength }),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour (shorter for signed URLs)
      }
    });
    
    return newResponse;
  } catch (error) {
    console.error('Error proxying file:', error);
    return NextResponse.json({ 
      error: 'Failed to proxy file',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}