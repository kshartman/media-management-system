/**
 * Utility for creating downloadable zip archives containing all files for a card
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { getFileUrl, getSignedFileUrl, getFilenameFromUrl } = require('./s3Storage');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { htmlToText } = require('html-to-text');
const HtmlToRtf = require('html-to-rtf');
const pdf = require('html-pdf');
const { promisify } = require('util');

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
    return cardMetadata[metadataField];
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
 * Convert HTML content to RTF format
 * @param {string} htmlContent - HTML content to convert
 * @returns {string} - RTF content
 */
function convertHtmlToRtf(htmlContent) {
  if (!htmlContent) return '';
  
  return HtmlToRtf.convertHtmlToRtf(htmlContent);
}

/**
 * Convert HTML content to PDF
 * @param {string} htmlContent - HTML content to convert
 * @returns {Promise<Buffer>} - PDF content as buffer
 */
function convertHtmlToPdf(htmlContent) {
  if (!htmlContent) return Promise.resolve(Buffer.from(''));
  
  return new Promise((resolve, reject) => {
    const options = {
      format: 'A4',
      border: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    };
    
    pdf.create(htmlContent, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('Error generating PDF:', err);
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
}

/**
 * Add HTML content converted to different formats to the zip archive
 * @param {JSZip} zip - JSZip instance
 * @param {string} htmlContent - HTML content to convert
 * @param {string} baseFilename - Base name for the generated files (without extension)
 * @returns {Promise<void>}
 */
async function addHtmlContentToZip(zip, htmlContent, baseFilename) {
  if (!htmlContent) return;
  
  try {
    // Convert HTML to plain text
    const textContent = convertHtmlToText(htmlContent);
    zip.file(`${baseFilename}.txt`, textContent);
    console.log(`Added ${baseFilename}.txt to ZIP`);
    
    // Convert HTML to RTF
    const rtfContent = convertHtmlToRtf(htmlContent);
    zip.file(`${baseFilename}.rtf`, rtfContent);
    console.log(`Added ${baseFilename}.rtf to ZIP`);
    
    // Convert HTML to PDF
    const pdfBuffer = await convertHtmlToPdf(htmlContent);
    zip.file(`${baseFilename}.pdf`, pdfBuffer);
    console.log(`Added ${baseFilename}.pdf to ZIP`);
  } catch (error) {
    console.error(`Error converting HTML content for ${baseFilename}:`, error);
    // Continue with other conversions
  }
}

/**
 * Convert HTML content to plain text
 * @param {string} html - HTML content
 * @returns {string} - Plain text version
 */
function convertHtmlToText(html) {
  if (!html) return '';
  
  return htmlToText(html, {
    wordwrap: 80,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
}

/**
 * Convert HTML content to RTF format
 * @param {string} html - HTML content
 * @returns {string} - RTF content
 */
function convertHtmlToRtf(html) {
  if (!html) return '';
  
  try {
    return HtmlToRtf.convertHtmlToRtf(html);
  } catch (error) {
    console.error('Error converting HTML to RTF:', error);
    return '';
  }
}

/**
 * Convert HTML content to PDF
 * @param {string} html - HTML content
 * @returns {Promise<Buffer>} - PDF buffer
 */
function convertHtmlToPdf(html) {
  if (!html) return Promise.resolve(Buffer.from(''));
  
  return new Promise((resolve, reject) => {
    const options = {
      format: 'A4',
      border: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    };
    
    // Wrap HTML in basic styling
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          p { margin-bottom: 10px; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
    
    pdf.create(styledHtml, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('Error creating PDF:', err);
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
}

/**
 * Add HTML content to ZIP in multiple formats (TXT, RTF, PDF)
 * @param {JSZip} zip - JSZip instance
 * @param {string} html - HTML content
 * @param {string} baseName - Base filename (without extension)
 * @returns {Promise<void>}
 */
async function addHtmlContentToZip(zip, html, baseName) {
  if (!html || !zip || !baseName) return;
  
  try {
    // Convert to plain text
    const textContent = convertHtmlToText(html);
    zip.file(`${baseName}.txt`, textContent);
    
    // Convert to RTF
    const rtfContent = convertHtmlToRtf(html);
    zip.file(`${baseName}.rtf`, rtfContent);
    
    // Convert to PDF
    try {
      const pdfBuffer = await convertHtmlToPdf(html);
      zip.file(`${baseName}.pdf`, pdfBuffer);
    } catch (pdfError) {
      console.error(`Error creating PDF for ${baseName}:`, pdfError);
      // Continue without PDF
    }
    
    console.log(`Added ${baseName} content in multiple formats to ZIP`);
  } catch (error) {
    console.error(`Error adding HTML content to ZIP: ${baseName}`, error);
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
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'arraybuffer'
      });

      // Add the buffer to the zip with the original filename
      zip.file(filename, response.data);
      console.log(`Added file from S3 to ZIP: ${filename}`);
    } else {
      // It's a local file path
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        const fileData = fs.readFileSync(fullPath);
        zip.file(filename, fileData);
        console.log(`Added local file to ZIP: ${filename}`);
      } else {
        console.warn(`File not found, skipping: ${fullPath}`);
      }
    }
  } catch (error) {
    console.error(`Error adding file to ZIP: ${filename}`, error);
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
  console.log(`Creating ZIP archive for card type: ${card.type}`);
  console.log(`Card has the following properties: ${Object.keys(card).join(', ')}`);

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
  const zipPath = path.join(__dirname, '..', 'uploads', zipFilename);
  
  console.log(`Creating ZIP archive for ${card.type} card: ${zipPath}`);

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
        console.log(`Processing image sequence with ${card.imageSequence.length} images`);
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
        console.log('No image sequence found for social card or not an array');
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
    console.error('Error processing card files for ZIP:', error);
    // Continue with creating the ZIP even if some files couldn't be added
  }

  // Generate the ZIP file
  return new Promise((resolve, reject) => {
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(fs.createWriteStream(zipPath))
      .on('finish', () => {
        console.log(`ZIP archive created: ${zipPath}`);
        resolve(`/uploads/${zipFilename}`);
      })
      .on('error', (err) => {
        console.error('Error generating ZIP file:', err);
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