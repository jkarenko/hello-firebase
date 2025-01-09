import {onDocumentCreated, onDocumentDeleted, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import {DocumentSnapshot} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const db = getFirestore();
const auth = getAuth();

// Function to get user info
async function getUserInfo(uid: string) {
  try {
    const user = await auth.getUser(uid);
    return {
      displayName: user.displayName || "Unknown User",
      photoURL: user.photoURL,
      email: user.email,
    };
  } catch (error) {
    logger.error("Error getting user info:", error);
    return {
      displayName: "Unknown User",
      photoURL: null,
      email: null,
    };
  }
}

// Cloud function to get comments with user info
export const getComments = onCall(async (request) => {
  const {projectId, versionFilename} = request.data;

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to get comments");
  }

  try {
    const commentsRef = db.collection("projects").doc(projectId).collection("comments");
    let query = commentsRef.orderBy("createdAt", "desc");

    if (versionFilename) {
      query = query.where("versionFilename", "==", versionFilename);
    }

    const snapshot = await query.get();
    const comments = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as CommentData;
        const [createdByUser, resolvedByUser] = await Promise.all([
          getUserInfo(data.createdBy),
          data.resolvedBy ? getUserInfo(data.resolvedBy) : null,
        ]);

        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toMillis(),
          updatedAt: data.updatedAt?.toMillis(),
          resolvedAt: data.resolvedAt?.toMillis(),
          createdByUser,
          resolvedByUser,
        };
      })
    );

    return {comments};
  } catch (error) {
    logger.error("Error getting comments:", error);
    throw new HttpsError("internal", "Failed to get comments");
  }
});

// Validate user has permission to create/update comments
const validateUserPermissions = async (
  projectId: string,
  userId: string
): Promise<{isAllowed: boolean; role?: string}> => {
  const projectRef = await db.collection("projects").doc(projectId).get();
  const project = projectRef.data();

  if (!project) {
    return {isAllowed: false};
  }

  if (project.owner === userId) {
    return {isAllowed: true, role: "owner"};
  }

  const collaborator = project.collaborators?.[userId];
  if (collaborator?.role === "editor") {
    return {isAllowed: true, role: "editor"};
  }

  return {isAllowed: false};
};

// Process mentions in comment content
const processMentions = async (content: string): Promise<string[]> => {
  const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
  const matches = content.match(mentionRegex) || [];
  return matches.map((match) => match.substring(1)); // Remove @ symbol
};

interface CommentData {
  content: string;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  versionFilename: string;
  startTimestamp: number;
  endTimestamp: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

// Validate comment before creation
export const onCommentCreate = onDocumentCreated("projects/{projectId}/comments/{commentId}", async (event) => {
  const snapshot = event.data as DocumentSnapshot;
  if (!snapshot) {
    return;
  }

  const comment = snapshot.data() as CommentData;
  const {projectId} = event.params;

  // Validate user permissions
  const {isAllowed} = await validateUserPermissions(projectId, comment.createdBy);
  if (!isAllowed) {
    await snapshot.ref.delete();
    throw new HttpsError("permission-denied", "User does not have permission to comment on this project");
  }

  // Process mentions and send notifications
  const mentionedEmails = await processMentions(comment.content);
  if (mentionedEmails.length > 0) {
    const projectDoc = await db.collection("projects").doc(projectId).get();
    const project = projectDoc.data();

    for (const email of mentionedEmails) {
      try {
        const userRecord = await auth.getUserByEmail(email);

        // Create notification
        await db
          .collection("users")
          .doc(userRecord.uid)
          .collection("notifications")
          .add({
            type: "mention",
            projectId,
            projectName: project?.name || "Unknown Project",
            commentId: snapshot.id,
            mentionedBy: comment.createdBy,
            createdAt: FieldValue.serverTimestamp(),
            read: false,
          });
      } catch (error) {
        console.warn(`User not found for email: ${email}`);
      }
    }
  }
});

// Clean up when comment is deleted
export const onCommentDelete = onDocumentDeleted("projects/{projectId}/comments/{commentId}", async (event) => {
  const snapshot = event.data as DocumentSnapshot;
  if (!snapshot) {
    return;
  }

  const {commentId} = event.params;

  // Clean up notifications related to this comment
  const notificationsQuery = db.collectionGroup("notifications").where("commentId", "==", commentId);

  const notifications = await notificationsQuery.get();
  const batch = db.batch();

  notifications.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
});

// Update project stats when comment status changes
export const onCommentUpdate = onDocumentUpdated("projects/{projectId}/comments/{commentId}", async (event) => {
  const beforeSnapshot = event.data?.before;
  const afterSnapshot = event.data?.after;

  if (!beforeSnapshot || !afterSnapshot) {
    return;
  }

  const beforeData = beforeSnapshot.data() as CommentData;
  const afterData = afterSnapshot.data() as CommentData;
  const {projectId} = event.params;

  // If resolved status changed, update project stats
  if (beforeData.resolved !== afterData.resolved) {
    const projectRef = db.collection("projects").doc(projectId);

    await projectRef.update({
      resolvedCommentCount: FieldValue.increment(afterData.resolved ? 1 : -1),
      totalCommentCount: FieldValue.increment(0), // Ensure the field exists
    });
  }
});
