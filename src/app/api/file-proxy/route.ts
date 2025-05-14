import { NextRequest, NextResponse } from 'next/server';
import { config } from '../route.config';

export { config };

/**
 * Proxies requests to S3 or other file storage to avoid CORS issues
 */
export async function GET(request: NextRequest) {
  // Get URL from the request
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }
  
  try {
    // Fetch the file from the original source
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: 502 });
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
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      }
    });
    
    return newResponse;
  } catch (error) {
    console.error('Error proxying file:', error);
    return NextResponse.json({ error: 'Failed to proxy file' }, { status: 500 });
  }
}