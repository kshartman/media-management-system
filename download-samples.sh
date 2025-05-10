#!/bin/bash

echo "Downloading sample files to server/uploads directory..."

# Create directory if it doesn't exist
mkdir -p server/uploads

# Download sample images using curl with error handling
download_file() {
  local url=$1
  local output=$2
  echo "Downloading $output from $url..."
  
  if curl -L -o "$output" "$url"; then
    echo "Successfully downloaded $output"
  else
    echo "Failed to download $output"
    exit 1
  fi
}

# Download sample images
download_file "https://picsum.photos/seed/img1/800/800" "server/uploads/sample-image-preview.jpg"
download_file "https://picsum.photos/seed/img2/800/800" "server/uploads/sample-image-download.jpg"
download_file "https://picsum.photos/seed/social/800/800" "server/uploads/sample-social-preview.jpg"
download_file "https://picsum.photos/seed/reel/800/800" "server/uploads/sample-reel-preview.jpg"

# Create a sample transcript file
echo "This is a sample transcript for the video." > "server/uploads/sample-reel-transcript.txt"

# Download sample PDF (from Mozilla sample PDF)
download_file "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf" "server/uploads/sample-social-copy.pdf"

# Download sample video file
download_file "https://sample-videos.com/video123/mp4/240/big_buck_bunny_240p_1mb.mp4" "server/uploads/sample-reel-video.mp4"

echo "All sample files downloaded successfully!"
