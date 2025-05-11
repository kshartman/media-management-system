export interface FileMetadata {
  date: string | Date;
  width?: number;
  height?: number;
  fileSize?: number;
  originalFileName?: string;
  previewOriginalFileName?: string;
  downloadOriginalFileName?: string;
  documentCopyOriginalFileName?: string;
  movieOriginalFileName?: string;
  transcriptOriginalFileName?: string;
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
  documentCopy?: string;
  movie?: string;
  transcript?: string;
}

export interface ImageCardProps extends BaseCardProps {
  type: "image";
  preview?: string;
  download: string;
}

export interface SocialCardProps extends BaseCardProps {
  type: "social";
  preview?: string;
  documentCopy: string;
}

export interface ReelCardProps extends BaseCardProps {
  type: "reel";
  preview?: string;
  movie: string;
  transcript: string;
}

export type CardProps = ImageCardProps | SocialCardProps | ReelCardProps;
