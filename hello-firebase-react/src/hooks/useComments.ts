import {useState, useEffect, useCallback, useRef} from "react";
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
  serverTimestamp,
} from "firebase/firestore";
import {getFirestore} from "firebase/firestore";
import {getFirebaseFunctions} from "../firebase";
import {httpsCallable} from "firebase/functions";
import {useAuth} from "../hooks/useAuth";
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

interface PendingComment {
  localId: string;
  data: CommentWithUserInfo;
}

const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const useComments = (projectId: string, versionFilename?: string) => {
  const [comments, setComments] = useState<CommentWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(true);
  const lastRequestIdRef = useRef(0);
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  const pendingNewCommentsRef = useRef<Map<string, PendingComment>>(new Map());
  const debouncedGetCommentsFn = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const db = getFirestore();
  const {user} = useAuth();
  const functions = getFirebaseFunctions();

  // Memoize the query to prevent unnecessary re-subscriptions
  const getQuery = useCallback(() => {
    if (!projectId) {
      return null;
    }
    const commentsRef = collection(db, "projects", projectId, "comments");
    let q = query(commentsRef, orderBy("createdAt", "desc"));
    if (versionFilename) {
      q = query(q, where("versionFilename", "==", versionFilename));
    }
    return q;
  }, [db, projectId, versionFilename]);

  // Initialize debounced function
  useEffect(() => {
    debouncedGetCommentsFn.current = debounce(async (requestId: number) => {
      if (!user) {
        return; // Don't fetch if not authenticated
      }
      try {
        const getCommentsFn = httpsCallable<{projectId: string; versionFilename?: string}, GetCommentsResponse>(
          functions,
          "getComments"
        );

        const result = await getCommentsFn({projectId, versionFilename});

        // Check if this is still the most recent request
        if (requestId !== lastRequestIdRef.current) {
          return;
        }

        const commentsWithTimestamps = result.data.comments.map((comment) => ({
          ...comment,
          createdAt: Timestamp.fromMillis(comment.createdAt),
          updatedAt: comment.updatedAt ? Timestamp.fromMillis(comment.updatedAt) : undefined,
          resolvedAt: comment.resolvedAt ? Timestamp.fromMillis(comment.resolvedAt) : undefined,
        }));

        setComments((prevComments) => {
          const updatedComments: CommentWithUserInfo[] = [...commentsWithTimestamps];

          // Keep optimistic updates
          prevComments.forEach((prevComment) => {
            if (pendingUpdatesRef.current.has(prevComment.id)) {
              const index = updatedComments.findIndex((c) => c.id === prevComment.id);
              if (index !== -1) {
                updatedComments[index] = prevComment;
              }
            }
          });

          // Add pending new comments
          pendingNewCommentsRef.current.forEach((pendingComment, localId) => {
            const serverComment = updatedComments.find(
              (c) =>
                c.createdBy === pendingComment.data.createdBy &&
                c.content === pendingComment.data.content &&
                Math.abs(c.createdAt.toMillis() - pendingComment.data.createdAt.toMillis()) < 5000
            );

            if (serverComment) {
              pendingNewCommentsRef.current.delete(localId);
            } else {
              updatedComments.unshift(pendingComment.data);
            }
          });

          return updatedComments;
        });

        if (initialLoadRef.current) {
          initialLoadRef.current = false;
        }

        setError(null);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load comments:", err);
        setError("Failed to load comments");
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debouncedGetCommentsFn.current) {
        debouncedGetCommentsFn.current.cancel?.();
      }
    };
  }, [projectId, versionFilename, functions, user]);

  // Subscribe to comments
  useEffect(() => {
    const query = getQuery();
    if (!query || !user) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    unsubscribeRef.current = onSnapshot(
      query,
      async () => {
        const requestId = ++lastRequestIdRef.current;
        debouncedGetCommentsFn.current?.(requestId);
      },
      (err) => {
        console.error("Failed to subscribe to comments:", err);
        setError("Failed to subscribe to comments");
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [getQuery, user]);

  // Create a new comment
  const createComment = async (data: CreateCommentData) => {
    if (!user) {
      throw new Error("Must be logged in to comment");
    }

    const localId = Math.random().toString(36).substring(7);
    const now = Timestamp.now();

    const commentData: Omit<Comment, "id"> = {
      ...data,
      createdAt: now,
      createdBy: user.uid,
      resolved: false,
    };

    // Create optimistic comment
    const newComment: CommentWithUserInfo = {
      id: localId, // Temporary ID
      ...commentData,
      createdByUser: {
        displayName: user.displayName || "Unknown User",
        photoURL: user.photoURL || undefined,
      },
    };

    try {
      // Add to pending new comments
      pendingNewCommentsRef.current.set(localId, {
        localId,
        data: newComment,
      });

      // Optimistically update UI
      setComments((prev) => [newComment, ...prev]);

      // Actually create the comment
      const commentsRef = collection(db, "projects", projectId, "comments");
      const serverCommentData = {
        ...commentData,
        createdAt: serverTimestamp(), // Use server timestamp for consistent ordering
      };

      await addDoc(commentsRef, serverCommentData);
    } catch (err) {
      // Remove from pending on error
      pendingNewCommentsRef.current.delete(localId);
      // Remove optimistic update
      setComments((prev) => prev.filter((c) => c.id !== localId));
      setError("Failed to create comment");
      throw err;
    }
  };

  // Update a comment
  const updateComment = async (commentId: string, data: UpdateCommentData) => {
    if (!user) {
      throw new Error("Must be logged in to comment");
    }

    try {
      const commentRef = doc(db, "projects", projectId, "comments", commentId);

      const currentComment = comments.find((c) => c.id === commentId);
      if (!currentComment) {
        throw new Error("Comment not found");
      }

      pendingUpdatesRef.current.add(commentId);

      if (data.resolved !== undefined) {
        const updateData = {
          content: currentComment.content,
          createdAt: currentComment.createdAt,
          createdBy: currentComment.createdBy,
          versionFilename: currentComment.versionFilename,
          startTimestamp: currentComment.startTimestamp,
          endTimestamp: currentComment.endTimestamp,
          resolved: data.resolved,
          resolvedBy: user.uid,
          resolvedAt: serverTimestamp(), // Use serverTimestamp for consistency
        };

        // First update local state with current timestamp for optimistic update
        const optimisticUpdate = {
          ...updateData,
          resolvedAt: Timestamp.now(),
        };

        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  ...optimisticUpdate,
                  resolvedByUser: data.resolved
                    ? {
                        displayName: user.displayName || "Unknown User",
                        photoURL: user.photoURL || undefined,
                      }
                    : undefined,
                }
              : comment
          )
        );

        await updateDoc(commentRef, updateData);
      } else if (data.content) {
        const updateData = {
          content: data.content,
          updatedAt: serverTimestamp(), // Use serverTimestamp for consistency
          createdAt: currentComment.createdAt,
          createdBy: currentComment.createdBy,
          versionFilename: currentComment.versionFilename,
          startTimestamp: currentComment.startTimestamp,
          endTimestamp: currentComment.endTimestamp,
          resolved: currentComment.resolved,
        };

        // First update local state with current timestamp for optimistic update
        const optimisticUpdate = {
          ...updateData,
          updatedAt: Timestamp.now(),
        };

        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  ...optimisticUpdate,
                }
              : comment
          )
        );

        await updateDoc(commentRef, updateData);
      }

      pendingUpdatesRef.current.delete(commentId);
    } catch (err) {
      pendingUpdatesRef.current.delete(commentId);
      console.error("Failed to update comment:", err);
      setError("Failed to update comment");
      throw err;
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string) => {
    if (!user) {
      throw new Error("Must be logged in to delete comment");
    }

    try {
      const commentRef = doc(db, "projects", projectId, "comments", commentId);

      // Optimistically remove the comment from the UI
      setComments((prevComments) => prevComments.filter((c) => c.id !== commentId));

      // Actually delete the comment
      await deleteDoc(commentRef);
    } catch (err) {
      // Revert optimistic update on error
      const deletedComment = comments.find((c) => c.id === commentId);
      if (deletedComment) {
        setComments((prevComments) => [...prevComments, deletedComment]);
      }
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
