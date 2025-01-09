import {Timestamp} from "firebase/firestore";

export interface Comment {
  id: string;
  content: string;
  createdAt: Timestamp;
  createdBy: string;
  versionFilename: string;
  startTimestamp: number;
  endTimestamp: number;
  resolved: boolean;
  updatedAt?: Timestamp;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
}

export interface CreateCommentData {
  content: string;
  versionFilename: string;
  startTimestamp: number;
  endTimestamp: number;
}

export interface UpdateCommentData {
  content?: string;
  resolved?: boolean;
}

export interface CommentWithUserInfo extends Comment {
  createdByUser: {
    displayName: string;
    photoURL?: string;
  };
  resolvedByUser?: {
    displayName: string;
    photoURL?: string;
  };
}

// Helper type for comment sorting and filtering
export type CommentSortBy = "timestamp" | "createdAt" | "resolved";
export type CommentFilterBy = "all" | "resolved" | "unresolved" | "mine";

// Comment range selection state
export interface CommentTimeRange {
  start: number;
  end: number;
}

// Comment list props interface
export interface CommentListProps {
  projectId: string;
  versionFilename: string;
  currentTime: number;
  onTimeRangeClick: (range: CommentTimeRange) => void;
}

// Comment form props interface
export interface CommentFormProps {
  projectId: string;
  versionFilename: string;
  currentTimeRange: CommentTimeRange;
  onCommentCreate: () => void;
}
