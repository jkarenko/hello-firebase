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

interface PendingComment {
  localId: string;
  data: CommentWithUserInfo;
}

export const useComments = (projectId: string, versionFilename?: string) => {
  const [comments, setComments] = useState<CommentWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(true);
  const lastRequestIdRef = useRef(0);
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  const pendingNewCommentsRef = useRef<Map<string, PendingComment>>(new Map());

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
          const requestId = ++lastRequestIdRef.current;
          const getCommentsFn = httpsCallable<{projectId: string; versionFilename?: string}, GetCommentsResponse>(
            functions,
            "getComments"
          );

          const result = await getCommentsFn({projectId, versionFilename});

          // Check if this is still the most recent request
          if (requestId !== lastRequestIdRef.current) {
            console.debug("Ignoring stale comments update", {requestId, currentId: lastRequestIdRef.current});
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

            // Keep optimistic updates for modified comments
            prevComments.forEach((prevComment) => {
              if (pendingUpdatesRef.current.has(prevComment.id)) {
                const index = updatedComments.findIndex((c) => c.id === prevComment.id);
                if (index !== -1) {
                  updatedComments[index] = prevComment;
                }
              }
            });

            // Add pending new comments that haven't been synced yet
            pendingNewCommentsRef.current.forEach((pendingComment, localId) => {
              // Check if this pending comment has been synced (exists in server response)
              const serverComment = updatedComments.find(
                (c) =>
                  c.createdBy === pendingComment.data.createdBy &&
                  c.content === pendingComment.data.content &&
                  Math.abs(c.createdAt.toMillis() - pendingComment.data.createdAt.toMillis()) < 5000
              );

              if (serverComment) {
                // Remove from pending if found in server response
                pendingNewCommentsRef.current.delete(localId);
              } else {
                // Keep the optimistic update if not yet synced
                updatedComments.unshift(pendingComment.data);
              }
            });

            return updatedComments;
          });

          // Only mark as not initial load after first successful update
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

    const localId = Math.random().toString(36).substring(7);
    const now = Timestamp.now();

    const commentData: Omit<Comment, "id"> = {
      ...data,
      createdAt: now,
      createdBy: auth.currentUser.uid,
      resolved: false,
    };

    // Create optimistic comment
    const newComment: CommentWithUserInfo = {
      id: localId, // Temporary ID
      ...commentData,
      createdByUser: {
        displayName: auth.currentUser.displayName || "Unknown User",
        photoURL: auth.currentUser.photoURL || undefined,
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
    if (!auth.currentUser) {
      throw new Error("Must be logged in to comment");
    }

    try {
      const commentRef = doc(db, "projects", projectId, "comments", commentId);

      // Get the current comment data first
      const currentComment = comments.find((c) => c.id === commentId);
      if (!currentComment) {
        throw new Error("Comment not found");
      }

      // Add to pending updates
      pendingUpdatesRef.current.add(commentId);

      if (data.resolved !== undefined) {
        // For resolution status updates
        const updateData = {
          content: currentComment.content,
          createdAt: currentComment.createdAt,
          createdBy: currentComment.createdBy,
          versionFilename: currentComment.versionFilename,
          startTimestamp: currentComment.startTimestamp,
          endTimestamp: currentComment.endTimestamp,
          resolved: data.resolved,
          resolvedBy: auth.currentUser.uid,
          resolvedAt: Timestamp.now(),
        };

        // First update local state
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  ...updateData,
                  resolvedByUser: data.resolved
                    ? {
                        displayName: auth.currentUser?.displayName || "Unknown User",
                        photoURL: auth.currentUser?.photoURL || undefined,
                      }
                    : undefined,
                }
              : comment
          )
        );

        // Then update the database
        await updateDoc(commentRef, updateData);
      } else if (data.content) {
        // For content updates
        const updateData = {
          content: data.content,
          updatedAt: Timestamp.now(),
          createdAt: currentComment.createdAt,
          createdBy: currentComment.createdBy,
          versionFilename: currentComment.versionFilename,
          startTimestamp: currentComment.startTimestamp,
          endTimestamp: currentComment.endTimestamp,
          resolved: currentComment.resolved,
        };

        // First update local state
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  ...updateData,
                }
              : comment
          )
        );

        // Then update the database
        await updateDoc(commentRef, updateData);
      }

      // Remove from pending updates after successful update
      pendingUpdatesRef.current.delete(commentId);
    } catch (err) {
      // Remove from pending updates on error
      pendingUpdatesRef.current.delete(commentId);
      console.error("Failed to update comment:", err);
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
