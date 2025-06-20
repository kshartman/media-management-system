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
  instagramCopyOriginalFileName?: string; // For Instagram copy
  facebookCopyOriginalFileName?: string; // For Facebook copy
  imageSequenceOriginalFileNames?: string[]; // Array of original filenames for image sequence
  imageSequenceFileSizes?: number[]; // Array of file sizes for each image in the sequence
  imageSequenceCaptions?: string[]; // Array of captions for each image in the sequence
  isPreviewGenerated?: boolean; // Indicates if preview was auto-generated
}

export interface BaseCardProps {
  id: string;
  type: "image" | "social" | "reel";
  tags: string[];
  description: string;
  fileMetadata?: FileMetadata;
  downloadCount?: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
  isAdmin?: boolean;
  isEditor?: boolean;
  isDeleted?: boolean; // For trash functionality - shows if card is deleted
  // Add properties needed for download all functionality
  preview?: string;
  download?: string;
  movie?: string;
  transcript?: string;
  imageSequence?: string[];
  instagramCopy?: string;
  facebookCopy?: string;
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
  instagramCopy?: string; // Instagram copy content
  facebookCopy?: string; // Facebook copy content
}

export interface ReelCardProps extends BaseCardProps {
  type: "reel";
  preview?: string;
  movie: string;
  transcript: string;
  instagramCopy?: string; // Instagram copy content
  facebookCopy?: string; // Facebook copy content
}

export type CardProps = ImageCardProps | SocialCardProps | ReelCardProps;

export interface Card {
  _id: string;
  type: "image" | "social" | "reel";
  description: string;
  tags: string[];
  preview?: string;
  download?: string;
  movie?: string;
  transcript?: string;
  imageSequence?: string[];
  instagramCopy?: string;
  facebookCopy?: string;
  fileMetadata?: FileMetadata;
  downloadCount?: number;
  createdAt?: string;
  updatedAt?: string;
  // Trash fields (optional for backward compatibility)
  deletedAt?: string | null;
  deletedBy?: {
    _id: string;
    username: string;
  } | null;
}
