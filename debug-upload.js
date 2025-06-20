// Debug script for upload issues
// Run this in browser console on the dev site

console.log('=== Upload Debug Script ===');

// 1. Check authentication
const token = localStorage.getItem('auth_token');
console.log('Auth token present:', !!token);
console.log('Token length:', token ? token.length : 0);

// 2. Test API connectivity
async function testApiConnectivity() {
  try {
    const response = await fetch('/api/health');
    console.log('API Health check:', response.status, response.ok);
  } catch (error) {
    console.error('API Health check failed:', error);
  }
}

// 3. Test authenticated endpoint
async function testAuthenticatedEndpoint() {
  try {
    const response = await fetch('/api/cards', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Cards API (authenticated):', response.status, response.ok);
    if (!response.ok) {
      const text = await response.text();
      console.error('Cards API error:', text);
    }
  } catch (error) {
    console.error('Cards API failed:', error);
  }
}

// 4. Test upload form accessibility
function testUploadFormAccess() {
  // Check if upload button exists
  const uploadButton = document.querySelector('button:has(svg)');
  console.log('Upload button found:', !!uploadButton);
  
  // Check if user has admin/editor permissions
  const adminBar = document.querySelector('[class*="AdminBar"], [class*="admin"]');
  console.log('Admin bar found:', !!adminBar);
}

// 5. Test upload endpoint directly
async function testUploadEndpoint() {
  try {
    // Create a minimal FormData for testing
    const formData = new FormData();
    formData.append('type', 'image');
    formData.append('description', 'Test upload');
    formData.append('tags', 'test');
    
    // Create a small test file
    const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    formData.append('preview', testFile);
    formData.append('download', testFile);
    
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    console.log('Upload test response:', response.status, response.ok);
    if (!response.ok) {
      const text = await response.text();
      console.error('Upload test error:', text);
    } else {
      console.log('Upload test SUCCESS - functionality is working');
    }
  } catch (error) {
    console.error('Upload test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n1. Testing API connectivity...');
  await testApiConnectivity();
  
  console.log('\n2. Testing authenticated endpoint...');
  await testAuthenticatedEndpoint();
  
  console.log('\n3. Testing upload form access...');
  testUploadFormAccess();
  
  console.log('\n4. Testing upload endpoint...');
  await testUploadEndpoint();
  
  console.log('\n=== Debug Complete ===');
  console.log('If upload test succeeded, the backend is working.');
  console.log('If it failed, check the error messages above.');
}

// Auto-run the tests
runAllTests();