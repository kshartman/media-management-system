export interface FileMetadata {
  date: string | Date;
  width?: number;
  height?: number;
  fileSize?: number;
  totalSequenceSize?: number; // Total size of all files in an image sequence
  originalFileName?: string;
  previewOriginalFileName?: string;
  downloadOriginalFileName?: string;
  movieOriginalFileName?: string;
  transcriptOriginalFileName?: string; // For transcript files in both reel and social cards
  imageSequenceOriginalFileNames?: string[]; // Array of original filenames for image sequence
  imageSequenceFileSizes?: number[]; // Array of file sizes for each image in the sequence
}

export interface BaseCardProps {
  id: string;
  type: "image" | "social" | "reel";
  tags: string[];
  description: string;
  fileMetadata?: FileMetadata;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  // Add properties needed for download all functionality
  preview?: string;
  download?: string;
  movie?: string;
  transcript?: string;
  imageSequence?: string[];
}

export interface ImageCardProps extends BaseCardProps {
  type: "image";
  preview?: string;
  download: string;
}

export interface SocialCardProps extends BaseCardProps {
  type: "social";
  preview?: string;
  imageSequence: string[]; // Array of image URLs 
  transcript?: string; // Optional transcript
}

export interface ReelCardProps extends BaseCardProps {
  type: "reel";
  preview?: string;
  movie: string;
  transcript: string;
}

export type CardProps = ImageCardProps | SocialCardProps | ReelCardProps;
