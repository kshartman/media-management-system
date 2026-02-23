/**
 * Utility for creating downloadable zip archives containing all files for a card
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { getFileUrl, getSignedFileUrl, getFilenameFromUrl } = require('./s3Storage');
const { v4: uuidv4 } = require('uuid');
const { htmlToText } = require('html-to-text');
const puppeteer = require('puppeteer');
const logger = require('./logger');
const { getUploadPath } = require('./uploadPath');

const zipFiles = logger.child({ component: 'zipFiles' });

/**
 * Get the original filename from card metadata, or use a placeholder name
 * @param {Object} cardMetadata - Card metadata object
 * @param {string} fieldName - Field name (e.g., 'preview', 'download', etc.)
 * @param {string} filePath - File path/URL 
 * @returns {string} - Original filename or generated name
 */
function getOriginalFilename(cardMetadata, fieldName, filePath) {
  const metadataField = `${fieldName}OriginalFileName`;
  
  // Use the original filename from metadata if available
  if (cardMetadata && cardMetadata[metadataField]) {
    const metadataFilename = cardMetadata[metadataField];
    
    // Special case: if it's an auto-generated preview without extension, add one
    if (fieldName === 'preview' && 
        cardMetadata.previewSource === 'auto-generated' && 
        metadataFilename === 'Auto-generated from video frame' &&
        !path.extname(metadataFilename)) {
      const extension = path.extname(filePath) || '.jpg';
      return `${metadataFilename}${extension}`;
    }
    
    return metadataFilename;
  }
  
  // Special handling for preview files
  if (fieldName === 'preview' && cardMetadata?.previewSource === 'auto-generated') {
    // Extract extension from the path
    const extension = path.extname(filePath) || '.jpg'; // Default to jpg if no extension
    return `Auto-generated from video frame${extension}`;
  }
  
  // Otherwise extract from the path or use a placeholder
  const extension = path.extname(filePath);
  return `${fieldName}${extension}`;
}

/**
 * Convert HTML content to plain text
 * @param {string} htmlContent - HTML content to convert
 * @returns {string} - Plain text content
 */
function convertHtmlToText(htmlContent) {
  if (!htmlContent) return '';
  
  return htmlToText(htmlContent, {
    wordwrap: 130,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
}

/**
 * Convert HTML content to RTF format (simplified version)
 * @param {string} htmlContent - HTML content to convert
 * @returns {string} - RTF content
 */
function convertHtmlToRtf(htmlContent) {
  if (!htmlContent) return '';
  
  // Simple HTML to RTF conversion
  // Remove HTML tags and add basic RTF formatting
  const text = htmlToText(htmlContent, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
  
  // Basic RTF header and footer
  const rtfHeader = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
  const rtfFooter = '}';
  
  // Escape special RTF characters
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par ');
  
  return `${rtfHeader}\\f0\\fs24 ${escapedText}${rtfFooter}`;
}

/**
 * Convert HTML content to PDF using Puppeteer
 * @param {string} htmlContent - HTML content to convert
 * @returns {Promise<Buffer>} - PDF content as buffer
 */
async function convertHtmlToPdf(htmlContent) {
  if (!htmlContent) return Buffer.from('');
  
  let browser;
  try {
    zipFiles.debug('Attempting to launch Puppeteer...');
    
    // Use Puppeteer's bundled Chromium with Docker-optimized flags
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--disable-gl-drawing-for-tests',
        '--single-process',
        '--no-zygote',
        '--use-gl=swiftshader',
        '--disable-blink-features=AutomationControlled'
      ]
      // No executablePath - let Puppeteer use its bundled Chromium
    });
    
    zipFiles.debug('Puppeteer launched successfully, creating new page...');
    
    const page = await browser.newPage();
    zipFiles.debug('Page created, setting content...');
    
    // Wrap HTML in basic styling
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px;
            line-height: 1.6;
          }
          p { margin-bottom: 10px; }
          h1, h2, h3 { color: #333; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
    
    await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
    zipFiles.debug('Content set, generating PDF...');
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      },
      printBackground: true
    });
    
    zipFiles.debug(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    zipFiles.error('Error generating PDF with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


/**
 * Add HTML content to ZIP in text and PDF formats only
 * @param {JSZip} zip - JSZip instance
 * @param {string} html - HTML content
 * @param {string} baseName - Base filename (without extension)
 * @returns {Promise<void>}
 */
async function addHtmlContentToZip(zip, html, baseName) {
  if (!html || !zip || !baseName) {
    zipFiles.debug(`Skipping ${baseName} - missing html (${!!html}), zip (${!!zip}), or baseName (${!!baseName})`);
    return;
  }
  
  zipFiles.debug(`Processing HTML content for ${baseName}:`, html.substring(0, 100) + '...');
  
  try {
    // Convert to plain text
    const textContent = convertHtmlToText(html);
    zip.file(`${baseName}.txt`, textContent);
    zipFiles.info(`✓ Added ${baseName}.txt to ZIP`);
    
    // Convert to PDF
    try {
      zipFiles.debug(`Starting PDF generation for ${baseName}`);
      const pdfBuffer = await convertHtmlToPdf(html);
      if (pdfBuffer && pdfBuffer.length > 0) {
        zip.file(`${baseName}.pdf`, pdfBuffer);
        zipFiles.info(`✓ Added ${baseName}.pdf to ZIP (${pdfBuffer.length} bytes)`);
      } else {
        zipFiles.error(`PDF buffer empty for ${baseName}`);
      }
    } catch (pdfError) {
      zipFiles.error(`PDF generation failed for ${baseName}:`, pdfError);
      // Don't add fallback files - just continue with text only
    }
  } catch (error) {
    zipFiles.error(`✗ Error adding HTML content to ZIP: ${baseName}`, error);
    // Continue with other files
  }
}

/**
 * Add a file to the zip archive
 * @param {JSZip} zip - JSZip instance
 * @param {string} filePath - Path or URL to the file
 * @param {string} filename - Name to use for the file in the archive
 * @returns {Promise<void>}
 */
async function addFileToZip(zip, filePath, filename) {
  if (!filePath) return;
  
  try {
    // Check if this is an S3 URL or a local path
    if (filePath.startsWith('http')) {
      // Get a signed URL if needed
      const fileUrl = await getSignedFileUrl(filePath);
      
      // Download the file to a buffer
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} downloading ${filename}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      // Add the buffer to the zip with the original filename
      zip.file(filename, buffer);
      zipFiles.info(`Added file from S3 to ZIP: ${filename}`);
    } else {
      // It's a local file path
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        const fileData = fs.readFileSync(fullPath);
        zip.file(filename, fileData);
        zipFiles.info(`Added local file to ZIP: ${filename}`);
      } else {
        zipFiles.warn(`File not found, skipping: ${fullPath}`);
      }
    }
  } catch (error) {
    zipFiles.error(`Error adding file to ZIP: ${filename}`, error);
    // Continue with other files
  }
}

/**
 * Create a ZIP file containing all files for a card
 * @param {Object} card - Card object from the database
 * @returns {Promise<string>} - Path to the created ZIP file
 */
async function createCardZip(card) {
  if (!card) {
    throw new Error('No card provided for ZIP archive');
  }
  
  // Log the card type for debugging
  zipFiles.debug(`Creating ZIP archive for card type: ${card.type}`);
  zipFiles.debug(`Card has the following properties: ${Object.keys(card).join(', ')}`);

  // Create a sanitized name for the ZIP file based on card type and content
  let zipBaseName = '';
  if (card.type === 'image') {
    // For image cards, use the original filename of the download file
    zipBaseName = card.fileMetadata?.downloadOriginalFileName || 'image';
    zipBaseName = path.parse(zipBaseName).name; // Remove extension
  } else if (card.type === 'reel') {
    // For reel cards, use the original filename of the movie file
    zipBaseName = card.fileMetadata?.movieOriginalFileName || 'video';
    zipBaseName = path.parse(zipBaseName).name; // Remove extension
  } else if (card.type === 'social') {
    // For social cards, use a sanitized version of the description
    zipBaseName = card.description
      ? card.description.substring(0, 240).replace(/[^a-z0-9]/gi, '-').toLowerCase()
      : 'social-post';
  }

  // Add timestamp and unique ID to ensure uniqueness
  const timestamp = Date.now();
  const zipFilename = `${timestamp}-${zipBaseName}-${uuidv4().substring(0, 8)}.zip`;
  const zipPath = path.join(getUploadPath(), zipFilename);
  
  zipFiles.info(`Creating ZIP archive for ${card.type} card: ${zipPath}`);

  // Create a new JSZip instance
  const zip = new JSZip();
  
  try {
    // Add files based on card type
    if (card.type === 'image') {
      // For image cards: download file and optional preview
      if (card.download) {
        const filename = getOriginalFilename(card.fileMetadata, 'download', card.download);
        await addFileToZip(zip, card.download, filename);
      }
      
      if (card.preview) {
        const filename = getOriginalFilename(card.fileMetadata, 'preview', card.preview);
        await addFileToZip(zip, card.preview, filename);
      }
    } else if (card.type === 'reel') {
      // For reel cards: movie file, optional preview and transcript
      if (card.movie) {
        const filename = getOriginalFilename(card.fileMetadata, 'movie', card.movie);
        await addFileToZip(zip, card.movie, filename);
      }
      
      if (card.preview) {
        const filename = getOriginalFilename(card.fileMetadata, 'preview', card.preview);
        await addFileToZip(zip, card.preview, filename);
      }
      
      if (card.transcript) {
        const filename = getOriginalFilename(card.fileMetadata, 'transcript', card.transcript);
        await addFileToZip(zip, card.transcript, filename);
      }
      
      // Add Instagram copy in multiple formats
      if (card.instagramCopy) {
        await addHtmlContentToZip(zip, card.instagramCopy, 'instagram_copy');
      }
      
      // Add Facebook copy in multiple formats
      if (card.facebookCopy) {
        await addHtmlContentToZip(zip, card.facebookCopy, 'facebook_copy');
      }
    } else if (card.type === 'social') {
      // For social cards: image sequence, optional preview and transcript
      if (card.preview) {
        const filename = getOriginalFilename(card.fileMetadata, 'preview', card.preview);
        await addFileToZip(zip, card.preview, filename);
      }
      
      // Add all images in the sequence - ONLY for social cards
      if (card.imageSequence && Array.isArray(card.imageSequence)) {
        zipFiles.debug(`Processing image sequence with ${card.imageSequence.length} images`);
        const originalFilenames = card.fileMetadata?.imageSequenceOriginalFileNames || [];
        
        for (let i = 0; i < card.imageSequence.length; i++) {
          const imagePath = card.imageSequence[i];
          if (!imagePath) continue; // Skip if image path is undefined
          
          // Use the original filename if available, otherwise use a generated name
          const filename = originalFilenames[i] 
            ? originalFilenames[i] 
            : `image-${i + 1}${path.extname(imagePath)}`;
            
          await addFileToZip(zip, imagePath, filename);
        }
      } else {
        zipFiles.debug('No image sequence found for social card or not an array');
      }
      
      // Add transcript (which replaced documentCopy)
      if (card.transcript) {
        const filename = getOriginalFilename(card.fileMetadata, 'transcript', card.transcript);
        await addFileToZip(zip, card.transcript, filename);
      }
      
      // Add Instagram copy in multiple formats
      if (card.instagramCopy) {
        await addHtmlContentToZip(zip, card.instagramCopy, 'instagram_copy');
      }
      
      // Add Facebook copy in multiple formats
      if (card.facebookCopy) {
        await addHtmlContentToZip(zip, card.facebookCopy, 'facebook_copy');
      }
    }
  } catch (error) {
    zipFiles.error('Error processing card files for ZIP:', error);
    // Continue with creating the ZIP even if some files couldn't be added
  }

  // Generate the ZIP file
  return new Promise((resolve, reject) => {
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(fs.createWriteStream(zipPath))
      .on('finish', () => {
        zipFiles.info(`ZIP archive created: ${zipPath}`);
        resolve(`/uploads/${zipFilename}`);
      })
      .on('error', (err) => {
        zipFiles.error('Error generating ZIP file:', err);
        reject(err);
      });
  });
}

module.exports = { 
  createCardZip,
  convertHtmlToText,
  convertHtmlToRtf,
  convertHtmlToPdf,
  addHtmlContentToZip
};