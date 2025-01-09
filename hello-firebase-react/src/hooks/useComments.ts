import {useState, useEffect, useCallback} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import {getFirestore} from "firebase/firestore";
import {getAuth} from "firebase/auth";
import {getFirebaseFunctions} from "../firebase";
import {httpsCallable} from "firebase/functions";
import {
  Comment,
  CreateCommentData,
  UpdateCommentData,
  CommentWithUserInfo,
  CommentFilterBy,
  CommentSortBy,
} from "../types/comments";

interface CommentResponse extends Omit<CommentWithUserInfo, "createdAt" | "updatedAt" | "resolvedAt"> {
  createdAt: number;
  updatedAt?: number;
  resolvedAt?: number;
}

interface GetCommentsResponse {
  comments: CommentResponse[];
}

export const useComments = (projectId: string, versionFilename?: string) => {
  const [comments, setComments] = useState<CommentWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const db = getFirestore();
  const auth = getAuth();
  const functions = getFirebaseFunctions();

  // Subscribe to comments
  useEffect(() => {
    if (!projectId) {
      return;
    }

    setLoading(true);
    const commentsRef = collection(db, "projects", projectId, "comments");
    let q = query(commentsRef, orderBy("createdAt", "desc"));

    if (versionFilename) {
      q = query(q, where("versionFilename", "==", versionFilename));
    }

    const unsubscribe = onSnapshot(
      q,
      async () => {
        try {
          const getCommentsFn = httpsCallable<{projectId: string; versionFilename?: string}, GetCommentsResponse>(
            functions,
            "getComments"
          );

          const result = await getCommentsFn({projectId, versionFilename});
          const commentsWithTimestamps = result.data.comments.map((comment) => ({
            ...comment,
            createdAt: Timestamp.fromMillis(comment.createdAt),
            updatedAt: comment.updatedAt ? Timestamp.fromMillis(comment.updatedAt) : undefined,
            resolvedAt: comment.resolvedAt ? Timestamp.fromMillis(comment.resolvedAt) : undefined,
          }));
          setComments(commentsWithTimestamps);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error("Failed to load comments:", err);
          setError("Failed to load comments");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Failed to subscribe to comments:", err);
        setError("Failed to subscribe to comments");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId, versionFilename, functions]);

  // Create a new comment
  const createComment = async (data: CreateCommentData) => {
    if (!auth.currentUser) {
      throw new Error("Must be logged in to comment");
    }

    const commentData: Omit<Comment, "id"> = {
      ...data,
      createdAt: Timestamp.now(),
      createdBy: auth.currentUser.uid,
      resolved: false,
    };

    try {
      const commentsRef = collection(db, "projects", projectId, "comments");
      await addDoc(commentsRef, commentData);
    } catch (err) {
      setError("Failed to create comment");
      throw err;
    }
  };

  // Update a comment
  const updateComment = async (commentId: string, data: UpdateCommentData) => {
    if (!auth.currentUser) {
      throw new Error("Must be logged in to update comment");
    }

    try {
      const commentRef = doc(db, "projects", projectId, "comments", commentId);
      const updateData: Partial<Comment> = {
        ...data,
        updatedAt: Timestamp.now(),
      };

      if (data.resolved !== undefined) {
        updateData.resolvedBy = auth.currentUser.uid;
        updateData.resolvedAt = Timestamp.now();
      }

      await updateDoc(commentRef, updateData);
    } catch (err) {
      setError("Failed to update comment");
      throw err;
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string) => {
    if (!auth.currentUser) {
      throw new Error("Must be logged in to delete comment");
    }

    try {
      const commentRef = doc(db, "projects", projectId, "comments", commentId);
      await deleteDoc(commentRef);
    } catch (err) {
      setError("Failed to delete comment");
      throw err;
    }
  };

  // Filter comments
  const filterComments = useCallback((comments: CommentWithUserInfo[], filter: CommentFilterBy, userId?: string) => {
    switch (filter) {
      case "resolved":
        return comments.filter((c) => c.resolved);
      case "unresolved":
        return comments.filter((c) => !c.resolved);
      case "mine":
        return comments.filter((c) => c.createdBy === userId);
      default:
        return comments;
    }
  }, []);

  // Sort comments
  const sortComments = useCallback((comments: CommentWithUserInfo[], sortBy: CommentSortBy) => {
    return [...comments].sort((a, b) => {
      switch (sortBy) {
        case "timestamp":
          return a.startTimestamp - b.startTimestamp;
        case "resolved":
          return a.resolved === b.resolved ? 0 : a.resolved ? -1 : 1;
        case "createdAt":
        default:
          return b.createdAt.toMillis() - a.createdAt.toMillis();
      }
    });
  }, []);

  return {
    comments,
    loading,
    error,
    createComment,
    updateComment,
    deleteComment,
    filterComments,
    sortComments,
  };
};
