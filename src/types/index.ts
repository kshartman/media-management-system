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

// API Response Interfaces
export interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface CardsResponse extends ApiResponse<Card[]> {
  data: Card[];
}

export interface CardResponse extends ApiResponse<Card> {
  data: Card;
}

export interface TagsResponse extends ApiResponse<string[]> {
  data: string[];
}

export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'editor';
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

export interface AuthResponse extends ApiResponse<{ user: User }> {
  user: User;
}

export interface UsersResponse extends ApiResponse<User[]> {
  data: User[];
}

export interface UserResponse extends ApiResponse<User> {
  data: User;
}

export interface HealthResponse extends ApiResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version?: string;
  dependencies?: {
    database?: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
      connectionPool?: {
        current: number;
        max: number;
        min: number;
      };
    };
    storage?: {
      status: 'configured' | 'not_configured';
      type: 'local' | 's3';
    };
    email?: {
      status: 'configured' | 'not_configured';
      driver?: string;
    };
  };
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorResponse extends ApiResponse {
  error: string;
  details?: ValidationError[];
  correlationId?: string;
  timestamp?: string;
  path?: string;
  method?: string;
}
