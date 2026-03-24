#!/usr/bin/env node

/**
 * Migration script to generate preview thumbnails for existing cards that lack them.
 *
 * Downloads the original image from S3, generates a resized JPEG preview using sharp,
 * uploads the preview to S3, and updates the card's preview field in MongoDB.
 *
 * Usage:
 *   node scripts/generate-missing-previews.js --dry-run    # Show what would be updated
 *   node scripts/generate-missing-previews.js --migrate    # Generate and upload previews
 *   node scripts/generate-missing-previews.js --verify     # Check results
 *
 * IMPORTANT: Back up your MongoDB database before running --migrate.
 *   mongodump --uri="$MONGODB_URI" --out=./backup-$(date +%Y%m%d)
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const mongoose = require('mongoose');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
if (fs.existsSync(path.join(__dirname, '..', '.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const { Card } = require('../models');
const { uploadLocalFileToS3, isS3Configured } = require('../utils/s3Storage');
const { IMAGE_PREVIEW_SETTINGS } = require('../utils/mediaConstants');

const TEMP_DIR = path.join(__dirname, '..', 'temp');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'media-management';
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri, { dbName });
  console.log(`Connected to MongoDB: ${dbName}`);
}

async function downloadToTemp(url, filename) {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  const destPath = path.join(TEMP_DIR, filename);
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} downloading ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

async function generatePreview(localFilePath) {
  const previewFilename = `preview-${path.basename(localFilePath, path.extname(localFilePath))}.jpg`;
  const previewPath = path.join(TEMP_DIR, previewFilename);

  await sharp(localFilePath)
    .resize(IMAGE_PREVIEW_SETTINGS.MAX_WIDTH, null, { withoutEnlargement: true })
    .jpeg({ quality: IMAGE_PREVIEW_SETTINGS.QUALITY })
    .toFile(previewPath);

  return previewPath;
}

function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ignore */ }
  }
}

async function dryRun() {
  await connectDB();
  const cards = await Card.find({
    download: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { preview: { $exists: false } },
      { preview: null },
      { preview: '' },
    ],
  }).lean();

  console.log(`\nFound ${cards.length} cards with download but no preview:\n`);
  for (const card of cards) {
    const fn = card.fileMetadata?.downloadOriginalFileName || '?';
    console.log(`  [${card.type}] ${card._id} — ${fn}`);
  }
  console.log(`\n--migrate would generate ${cards.length} preview thumbnails.`);
  await mongoose.disconnect();
}

async function migrate() {
  await connectDB();
  const cards = await Card.find({
    download: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { preview: { $exists: false } },
      { preview: null },
      { preview: '' },
    ],
  });

  console.log(`\nGenerating previews for ${cards.length} cards...\n`);

  let success = 0;
  let failed = 0;

  for (const card of cards) {
    const fn = card.fileMetadata?.downloadOriginalFileName || card._id.toString();
    let localFile = null;
    let previewFile = null;

    try {
      // Download original from S3
      const ext = path.extname(fn) || '.png';
      const tempFilename = `${card._id}${ext}`;
      console.log(`  [${success + failed + 1}/${cards.length}] ${fn}...`);

      localFile = await downloadToTemp(card.download, tempFilename);
      const originalSize = fs.statSync(localFile).size;

      // Generate preview
      previewFile = await generatePreview(localFile);
      const previewSize = fs.statSync(previewFile).size;

      // Upload preview to S3
      let previewUrl;
      if (isS3Configured) {
        previewUrl = await uploadLocalFileToS3(previewFile);
      } else {
        const dest = path.join(__dirname, '..', 'uploads', path.basename(previewFile));
        fs.copyFileSync(previewFile, dest);
        previewUrl = `/uploads/${path.basename(previewFile)}`;
      }

      if (!previewUrl) throw new Error('Failed to upload preview');

      // Update card in database
      await Card.updateOne(
        { _id: card._id },
        {
          $set: {
            preview: previewUrl,
            'fileMetadata.previewSource': 'auto-generated',
          },
        }
      );

      console.log(`    ✓ ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(previewSize / 1024).toFixed(0)}KB — ${previewUrl.split('/').pop()}`);
      success++;
    } catch (err) {
      console.error(`    ✗ FAILED: ${err.message}`);
      failed++;
    } finally {
      cleanup(localFile, previewFile);
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed out of ${cards.length} total.`);
  await mongoose.disconnect();
}

async function verify() {
  await connectDB();

  const total = await Card.countDocuments({ download: { $exists: true, $ne: null, $ne: '' } });
  const withPreview = await Card.countDocuments({
    download: { $exists: true, $ne: null, $ne: '' },
    preview: { $exists: true, $ne: null, $ne: '' },
  });
  const missing = total - withPreview;

  console.log(`\nCards with download URL: ${total}`);
  console.log(`  With preview:    ${withPreview}`);
  console.log(`  Missing preview: ${missing}`);

  if (missing > 0) {
    const missingCards = await Card.find({
      download: { $exists: true, $ne: null, $ne: '' },
      $or: [{ preview: { $exists: false } }, { preview: null }, { preview: '' }],
    }).lean();
    console.log('\nMissing:');
    for (const card of missingCards) {
      const fn = card.fileMetadata?.downloadOriginalFileName || '?';
      console.log(`  [${card.type}] ${card._id} — ${fn}`);
    }
  } else {
    console.log('\n✓ All cards with downloads have preview thumbnails.');
  }

  await mongoose.disconnect();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Generate Missing Previews

Creates resized JPEG thumbnails for cards that have a download image but no preview.
Back up your database before running --migrate.

Usage:
  node scripts/generate-missing-previews.js --dry-run    # Preview what would change
  node scripts/generate-missing-previews.js --migrate    # Generate and upload previews
  node scripts/generate-missing-previews.js --verify     # Check results
`);
    process.exit(0);
  }

  try {
    if (args.includes('--dry-run')) await dryRun();
    else if (args.includes('--migrate')) await migrate();
    else if (args.includes('--verify')) await verify();
    else {
      console.error('Unknown option. Use --dry-run, --migrate, or --verify.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
