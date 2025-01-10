import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {getAuth} from "firebase-admin/auth";
import * as logger from "firebase-functions/logger";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {isSupportedAudioFile, getDisplayName} from "./utils/audio";

const db = getFirestore();
const storage = getStorage();

export interface ProjectAccess {
  projectId: string;
  projectName: string;
  owner: string;
  collaborators: {
    [uid: string]: {
      role: "reader" | "editor" | "pending";
      addedAt: Timestamp;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProjectInvitation {
  email: string;
  isEditor: boolean;
  status: "pending" | "delivered";
  createdAt: Timestamp;
}

export async function getProjectAccess(projectId: string): Promise<ProjectAccess | null> {
  try {
    const doc = await db.collection("projects").doc(projectId).get();
    return doc.exists ? (doc.data() as ProjectAccess) : null;
  } catch (error) {
    logger.error("Error getting project access:", error);
    return null;
  }
}

export async function getUserProjects(uid: string): Promise<string[]> {
  try {
    // Get projects where user is owner
    const ownerQuery = await db.collection("projects").where("owner", "==", uid).get();

    // Get projects where user is a collaborator
    const collaboratorQuery = await db.collection("projects").where(`collaborators.${uid}`, "!=", null).get();

    const projects = new Set<string>();

    // Add owner's projects
    ownerQuery.forEach((doc) => projects.add(doc.id));

    // Add collaborator's projects
    collaboratorQuery.forEach((doc) => projects.add(doc.id));

    return Array.from(projects);
  } catch (error) {
    logger.error("Error getting user projects:", error);
    return [];
  }
}

export async function hasProjectAccess(uid: string, projectId: string): Promise<boolean> {
  try {
    const projectAccess = await getProjectAccess(projectId);
    if (!projectAccess) {
      return false;
    }

    // Check if user is owner
    if (projectAccess.owner === uid) {
      return true;
    }

    // Check if user is a collaborator
    return projectAccess.collaborators?.[uid] !== undefined;
  } catch (error) {
    logger.error("Error checking project access:", error);
    return false;
  }
}

export async function createProjectAccess(projectId: string, ownerUid: string, projectName: string): Promise<void> {
  try {
    const now = Timestamp.now();
    await db.collection("projects").doc(projectId).set({
      projectId,
      projectName,
      owner: ownerUid,
      collaborators: {},
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    logger.error("Error creating project access:", error);
    throw error;
  }
}

export async function addProjectCollaborator(
  projectId: string,
  collaboratorUid: string,
  role: "reader" | "editor" | "pending"
): Promise<void> {
  try {
    const now = Timestamp.now();
    await db
      .collection("projects")
      .doc(projectId)
      .update({
        [`collaborators.${collaboratorUid}`]: {
          role,
          addedAt: now,
        },
        updatedAt: now,
      });
  } catch (error) {
    logger.error("Error adding collaborator:", error);
    throw error;
  }
}

export async function removeCollaborator(projectId: string, collaboratorUid: string): Promise<void> {
  try {
    const now = Timestamp.now();
    await db
      .collection("projects")
      .doc(projectId)
      .update({
        [`collaborators.${collaboratorUid}`]: FieldValue.delete(),
        updatedAt: now,
      });
  } catch (error) {
    logger.error("Error removing collaborator:", error);
    throw error;
  }
}

export const removeCollaboratorCall = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId, email} = request.data;
      if (!projectId || !email) {
        throw new HttpsError("invalid-argument", "Project ID and email are required");
      }

      // Check if user has access to the project
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Get user by email
      try {
        const userRecord = await getAuth().getUserByEmail(email);

        // Don't allow removing the owner
        if (userRecord.uid === projectAccess.owner) {
          throw new HttpsError("invalid-argument", "Cannot remove project owner");
        }

        // Check if user is actually a collaborator
        if (!projectAccess.collaborators?.[userRecord.uid]) {
          throw new HttpsError("not-found", "User is not a collaborator on this project");
        }

        // Allow if user is owner OR if user is removing themselves
        if (projectAccess.owner !== request.auth.uid && userRecord.uid !== request.auth.uid) {
          throw new HttpsError("permission-denied", "Only the project owner can remove other collaborators");
        }

        // Remove the collaborator
        await removeCollaborator(projectId, userRecord.uid);

        logger.info("Removed collaborator from project", {
          projectId,
          collaboratorUid: userRecord.uid,
          collaboratorEmail: email,
          removedBy: request.auth.uid,
          selfRemoval: userRecord.uid === request.auth.uid,
        });

        return {success: true};
      } catch (error) {
        if (error instanceof HttpsError) {
          throw error;
        }
        logger.error("Error removing collaborator:", error);
        throw new HttpsError("not-found", "User not found");
      }
    } catch (error) {
      logger.error("Error in removeCollaborator:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to remove collaborator");
    }
  }
);

export const createProject = onCall(async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const {name} = request.data;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new HttpsError("invalid-argument", "Project name is required");
    }

    // Create a new project ID
    const projectId = db.collection("projects").doc().id;

    try {
      // Create the project document
      await createProjectAccess(projectId, request.auth.uid, name.trim());
    } catch (dbError) {
      logger.error("Error creating project access:", {
        error: dbError,
        projectId,
        userId: request.auth.uid,
        name: name.trim(),
      });
      throw new HttpsError("internal", "Failed to create project access");
    }

    try {
      // Create the storage folder
      const bucket = storage.bucket();
      await bucket.file(`audio/${projectId}/.keep`).save("");
    } catch (storageError) {
      logger.error("Error creating storage folder:", {
        error: storageError,
        projectId,
        userId: request.auth.uid,
      });
      // Try to clean up the project document if storage fails
      try {
        await db.collection("projects").doc(projectId).delete();
      } catch (cleanupError) {
        logger.error("Error cleaning up project document after storage failure:", cleanupError);
      }
      throw new HttpsError("internal", "Failed to create project storage");
    }

    // Return the new project data
    return {
      id: projectId,
      name: name.trim(),
      versions: [],
    };
  } catch (error) {
    logger.error("Error in createProject:", {
      error,
      auth: request.auth
        ? {
            uid: request.auth.uid,
            token: request.auth.token,
          }
        : null,
      data: request.data,
    });
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to create project");
  }
});

export const getProjects = onCall(async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    // Get all project IDs the user has access to
    const projectIds = await getUserProjects(request.auth.uid);

    // Get full project data for each ID
    const projectPromises = projectIds.map(async (id) => {
      const projectAccess = await getProjectAccess(id);
      if (!projectAccess) {
        return null;
      }

      // Get versions for this project
      const bucket = storage.bucket();
      const prefix = `audio/${id}/`;
      const [files] = await bucket.getFiles({
        prefix,
      });

      // Filter and process versions
      const versions = files
        .filter((file) => !file.name.endsWith("/.keep") && isSupportedAudioFile(file.name))
        .map((file) => {
          const filename = file.name.split("/").pop()!;
          const displayName = getDisplayName(filename);
          return {filename, displayName};
        });

      logger.debug("Project versions:", {
        projectId: id,
        versions: versions.map((v) => v.filename),
        count: versions.length,
      });

      // We know request.auth exists because we checked at the start of the function
      const auth = request.auth!;
      const collaboratorRole = projectAccess.collaborators[auth.uid]?.role;

      // Get owner's email
      let ownerEmail = null;
      try {
        const owner = await getAuth().getUser(projectAccess.owner);
        ownerEmail = owner.email || "";
      } catch (error) {
        logger.error("Error getting owner email:", error);
      }

      return {
        id: projectAccess.projectId,
        name: projectAccess.projectName,
        versions,
        owner: projectAccess.owner,
        ownerEmail,
        isCollaborator: projectAccess.owner !== auth.uid,
        collaboratorRole,
      };
    });

    const projects = (await Promise.all(projectPromises)).filter((p): p is NonNullable<typeof p> => p !== null);

    logger.debug("All projects with versions:", {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        versionCount: p.versions.length,
        collaboratorRole: p.collaboratorRole,
      })),
    });

    return {
      songs: projects,
    };
  } catch (error) {
    logger.error("Error getting projects:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to get projects");
  }
});

export const getUploadUrl = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : [
          "https://jkarenko-hello-firebase.web.app",
          "https://jkarenko-hello-firebase.firebaseapp.com",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
        ],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId, filename} = request.data;
      if (!projectId || !filename) {
        throw new HttpsError("invalid-argument", "Project ID and filename are required");
      }

      // Check if user has access to the project
      const hasAccess = await hasProjectAccess(request.auth.uid, projectId);
      if (!hasAccess) {
        throw new HttpsError("permission-denied", "You don't have access to this project");
      }

      // Generate a signed URL for upload
      const bucket = storage.bucket();
      const file = bucket.file(`audio/${projectId}/${filename}`);

      // URL expires in 15 minutes
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: "audio/*",
        queryParams: {userToken: request.auth.token.uid}, // Add user token to URL
      });

      return {signedUrl};
    } catch (error) {
      logger.error("Error generating upload URL:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to generate upload URL");
    }
  }
);

export const getProject = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId} = request.data;
      if (!projectId) {
        throw new HttpsError("invalid-argument", "Project ID is required");
      }

      // Check if user has access to the project
      const hasAccess = await hasProjectAccess(request.auth.uid, projectId);
      if (!hasAccess) {
        throw new HttpsError("permission-denied", "You don't have access to this project");
      }

      // Get project data
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // List files in the project's storage folder
      const bucket = storage.bucket();
      logger.debug("Storage bucket info:", {
        projectId,
        bucketName: bucket.name,
        exists: await bucket.exists().then(([exists]) => exists),
      });

      const prefix = `audio/${projectId}/`;
      logger.debug("Searching for files with prefix:", {prefix});

      const [files] = await bucket.getFiles({
        prefix,
        // Removing the delimiter as it might be restricting our results
      });

      logger.debug("Raw files found in storage:", {
        projectId,
        allFiles: files.map((f) => f.name),
        filesCount: files.length,
      });

      // Filter out .keep file and create version objects
      const filteredFiles = files.filter((file) => {
        const isKeepFile = file.name.endsWith("/.keep");
        const isAudioFile = isSupportedAudioFile(file.name);
        const isInProject = file.name.startsWith(prefix);
        return !isKeepFile && isAudioFile && isInProject;
      });

      logger.debug("Files after filtering:", {
        projectId,
        filteredFiles: filteredFiles.map((f) => f.name),
        filteredCount: filteredFiles.length,
      });

      const versions = filteredFiles.map((file) => {
        const filename = file.name.split("/").pop()!;
        const displayName = getDisplayName(filename);
        return {filename, displayName};
      });

      logger.debug("Final processed versions:", {
        projectId,
        versions: versions.map((v) => ({filename: v.filename, displayName: v.displayName})),
        versionsCount: versions.length,
      });

      return {
        id: projectAccess.projectId,
        name: projectAccess.projectName,
        versions,
        owner: projectAccess.owner,
      };
    } catch (error) {
      logger.error("Error getting project:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to get project");
    }
  }
);

export const listProjects = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      // Get all project IDs the user has access to
      const projectIds = await getUserProjects(request.auth.uid);

      // Get full project data for each ID
      const projectPromises = projectIds.map(async (id) => {
        const projectAccess = await getProjectAccess(id);
        if (!projectAccess) {
          return null;
        }
        return {
          id: projectAccess.projectId,
          name: projectAccess.projectName,
          createdAt: projectAccess.createdAt.toDate().toISOString(),
        };
      });

      return (await Promise.all(projectPromises)).filter((p): p is NonNullable<typeof p> => p !== null);
    } catch (error) {
      logger.error("Error listing projects:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to list projects");
    }
  }
);

export const addCollaborator = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId, email} = request.data;
      if (!projectId || !email) {
        throw new HttpsError("invalid-argument", "Project ID and email are required");
      }

      // Check if user has access to modify the project
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Only owner can add collaborators
      if (projectAccess.owner !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Only the project owner can add collaborators");
      }

      // Create invitation document
      const invitationRef = db.collection("projects").doc(projectId).collection("invitations").doc(email);
      const now = Timestamp.now();

      const invitationData: ProjectInvitation = {
        email,
        isEditor: request.data.isEditor || false,
        status: "pending",
        createdAt: now,
      };

      // Save invitation
      await invitationRef.set(invitationData);

      try {
        // Try to find user by email
        const userRecord = await getAuth().getUserByEmail(email);

        // If user exists, add them as a collaborator
        await addProjectCollaborator(projectId, userRecord.uid, "pending");

        // Update invitation status
        await invitationRef.update({status: "delivered"});

        logger.info("Added collaborator to project", {
          projectId,
          collaboratorUid: userRecord.uid,
          collaboratorEmail: email,
          addedBy: request.auth.uid,
        });
      } catch (error) {
        // User doesn't exist - invitation will remain pending
        logger.info("Created pending invitation", {
          projectId,
          email,
          addedBy: request.auth.uid,
        });
      }

      return {success: true};
    } catch (error) {
      logger.error("Error in addCollaborator:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to add collaborator");
    }
  }
);

export const getCollaborators = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId} = request.data;
      if (!projectId) {
        throw new HttpsError("invalid-argument", "Project ID is required");
      }

      // Check if user has access to the project
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Check if user has access to this project
      const hasAccess = await hasProjectAccess(request.auth.uid, projectId);
      if (!hasAccess) {
        throw new HttpsError("permission-denied", "You don't have access to this project");
      }

      // Get collaborator emails from both collaborators and invitations
      const collaborators = new Map<string, {email: string; isEditor: boolean; isPending: boolean}>();

      // First, get existing collaborators
      const collaboratorPromises = Object.entries(projectAccess.collaborators || {}).map(async ([uid, data]) => {
        try {
          const user = await getAuth().getUser(uid);
          collaborators.set(user.email!, {
            email: user.email!,
            isEditor: data.role === "editor",
            isPending: data.role === "pending",
          });
        } catch (error) {
          logger.error("Error getting user info:", error);
        }
      });
      await Promise.all(collaboratorPromises);

      // Then, get pending invitations that don't have collaborator entries yet
      const invitationsSnapshot = await db
        .collection("projects")
        .doc(projectId)
        .collection("invitations")
        .where("status", "==", "pending")
        .get();

      invitationsSnapshot.forEach((doc) => {
        const invitation = doc.data() as ProjectInvitation;
        // Only add if not already in collaborators
        if (!collaborators.has(invitation.email)) {
          collaborators.set(invitation.email, {
            email: invitation.email,
            isEditor: invitation.isEditor,
            isPending: true,
          });
        }
      });

      // Convert map to array and sort by email
      return Array.from(collaborators.values()).sort((a, b) => a.email.localeCompare(b.email));
    } catch (error) {
      logger.error("Error getting collaborators:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to get collaborators");
    }
  }
);

export const updateCollaborator = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId, email, isEditor} = request.data;
      if (!projectId || !email || typeof isEditor !== "boolean") {
        throw new HttpsError("invalid-argument", "Project ID, email, and isEditor status are required");
      }

      // Check if user has access to the project
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Check if user is the owner
      if (projectAccess.owner !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Only the project owner can update collaborator permissions");
      }

      // Get user by email
      try {
        const userRecord = await getAuth().getUserByEmail(email);

        // Don't allow modifying the owner's role
        if (userRecord.uid === projectAccess.owner) {
          throw new HttpsError("invalid-argument", "Cannot modify project owner's role");
        }

        // Check if user is actually a collaborator
        if (!projectAccess.collaborators?.[userRecord.uid]) {
          throw new HttpsError("not-found", "User is not a collaborator on this project");
        }

        // Update collaborator role
        await addProjectCollaborator(projectId, userRecord.uid, isEditor ? "editor" : "reader");

        logger.info("Updated collaborator role", {
          projectId,
          collaboratorUid: userRecord.uid,
          collaboratorEmail: email,
          newRole: isEditor ? "editor" : "reader",
          updatedBy: request.auth.uid,
        });

        return {success: true};
      } catch (error) {
        if (error instanceof HttpsError) {
          throw error;
        }
        logger.error("Error updating collaborator:", error);
        throw new HttpsError("not-found", "User not found");
      }
    } catch (error) {
      logger.error("Error in updateCollaborator:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to update collaborator");
    }
  }
);

export const getProjectOwner = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId} = request.data;
      if (!projectId) {
        throw new HttpsError("invalid-argument", "Project ID is required");
      }

      // Check if user has access to the project
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Check if user has access to this project
      const hasAccess = await hasProjectAccess(request.auth.uid, projectId);
      if (!hasAccess) {
        throw new HttpsError("permission-denied", "You don't have access to this project");
      }

      // Get owner's email
      try {
        const owner = await getAuth().getUser(projectAccess.owner);
        return {
          email: owner.email || "",
        };
      } catch (error) {
        logger.error("Error getting owner info:", error);
        throw new HttpsError("internal", "Failed to get owner information");
      }
    } catch (error) {
      logger.error("Error getting project owner:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to get project owner");
    }
  }
);

export const respondToCollaborationInvite = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId, accept} = request.data;
      if (!projectId || typeof accept !== "boolean") {
        throw new HttpsError("invalid-argument", "Project ID and accept status are required");
      }

      // Check if project exists
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Get the user's current collaboration status
      const userCollaboration = projectAccess.collaborators?.[request.auth.uid];
      if (!userCollaboration) {
        throw new HttpsError("not-found", "No collaboration invitation found");
      }

      // Check if the invitation is pending
      if (userCollaboration.role !== "pending") {
        throw new HttpsError("failed-precondition", "No pending invitation to respond to");
      }

      if (accept) {
        // Accept the invitation by setting role to reader
        await addProjectCollaborator(projectId, request.auth.uid, "reader");

        logger.info("Collaboration invitation accepted", {
          projectId,
          collaboratorUid: request.auth.uid,
          previousRole: "pending",
          newRole: "reader",
        });
      } else {
        // Reject the invitation by removing the collaborator
        await removeCollaborator(projectId, request.auth.uid);

        logger.info("Collaboration invitation rejected", {
          projectId,
          collaboratorUid: request.auth.uid,
        });
      }

      return {success: true};
    } catch (error) {
      logger.error("Error responding to collaboration invite:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to respond to collaboration invitation");
    }
  }
);

export const renameProject = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId, name} = request.data;
      if (!projectId || !name || typeof name !== "string" || name.trim().length === 0) {
        throw new HttpsError("invalid-argument", "Project ID and new name are required");
      }

      // Check if project exists and get access info
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Check if user is the owner or an editor
      const isOwner = projectAccess.owner === request.auth.uid;
      const isEditor = projectAccess.collaborators?.[request.auth.uid]?.role === "editor";
      if (!isOwner && !isEditor) {
        throw new HttpsError("permission-denied", "Only project owners and editors can rename projects");
      }

      // Update the project name
      const now = Timestamp.now();
      await db.collection("projects").doc(projectId).update({
        projectName: name.trim(),
        updatedAt: now,
      });

      logger.info("Project renamed", {
        projectId,
        oldName: projectAccess.projectName,
        newName: name.trim(),
        updatedBy: request.auth.uid,
        isOwner,
        isEditor,
      });

      return {
        id: projectId,
        name: name.trim(),
      };
    } catch (error) {
      logger.error("Error renaming project:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to rename project");
    }
  }
);

// Function to check and process pending invitations for a new user
export async function processPendingInvitations(email: string, uid: string) {
  try {
    logger.info("Starting to process pending invitations", {email, uid});

    // Query all projects for pending invitations for this email
    const projectsRef = db.collection("projects");
    const projects = await projectsRef.get();

    logger.info("Found projects to check", {
      totalProjects: projects.size,
      projectIds: projects.docs.map((d) => d.id),
    });

    for (const projectDoc of projects.docs) {
      const invitationRef = projectDoc.ref.collection("invitations").doc(email);
      const invitation = await invitationRef.get();

      logger.info("Checking invitation for project", {
        projectId: projectDoc.id,
        exists: invitation.exists,
        data: invitation.exists ? invitation.data() : null,
      });

      if (invitation.exists && invitation.data()?.status === "pending") {
        logger.info("Processing pending invitation", {
          projectId: projectDoc.id,
          email,
          uid,
          invitationData: invitation.data(),
        });

        try {
          // Add user as pending collaborator
          await addProjectCollaborator(projectDoc.id, uid, "pending");
          logger.info("Added pending collaborator", {projectId: projectDoc.id, uid});

          // Update invitation status
          await invitationRef.update({status: "delivered"});
          logger.info("Updated invitation status to delivered", {projectId: projectDoc.id, email});
        } catch (error) {
          logger.error("Error processing single invitation", {
            error,
            projectId: projectDoc.id,
            email,
            uid,
          });
          throw error;
        }
      }
    }
  } catch (error) {
    logger.error("Error processing pending invitations:", error);
    throw error;
  }
}

export const processUserInvitations = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      // Process invitations for this user
      await processPendingInvitations(request.auth.token.email || "", request.auth.uid);

      return {success: true};
    } catch (error) {
      logger.error("Error processing user invitations:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to process invitations");
    }
  }
);

export const deleteVersion = onCall(async (request) => {
  const {projectId, versionFilename} = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "Must be logged in to delete version");
  }

  if (!projectId || !versionFilename) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const db = getFirestore();
  const storage = getStorage();

  try {
    // Get project document to check permissions first
    const projectRef = db.collection("projects").doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      throw new HttpsError("not-found", "Project not found");
    }

    const projectData = projectDoc.data();
    if (!projectData) {
      throw new HttpsError("not-found", "Project data not found");
    }

    // Check if user has permission to delete version
    if (projectData.owner !== userId) {
      throw new HttpsError("permission-denied", "Only project owner can delete versions");
    }

    // Delete the file from storage first
    const bucket = storage.bucket();
    const file = bucket.file(`audio/${projectId}/${versionFilename}`);
    const [exists] = await file.exists();

    if (!exists) {
      throw new HttpsError("not-found", "Version file not found in storage");
    }

    await file.delete();

    // Now delete all associated comments in a transaction
    await db.runTransaction(async (transaction) => {
      // Get all comments for this version
      const commentsRef = db.collection("projects").doc(projectId).collection("comments");
      const commentsQuery = await transaction.get(commentsRef.where("versionFilename", "==", versionFilename));

      // Delete all comments
      commentsQuery.forEach((doc) => {
        transaction.delete(doc.ref);
      });
    });

    return {
      success: true,
      message: "Version and associated comments deleted successfully",
    };
  } catch (err) {
    logger.error("Failed to delete version:", err);
    throw new HttpsError("internal", "Failed to delete version");
  }
});

export const deleteProject = onCall(
  {
    cors: process.env.FUNCTIONS_EMULATOR
      ? true
      : ["https://jkarenko-hello-firebase.web.app", "https://jkarenko-hello-firebase.firebaseapp.com"],
  },
  async (request) => {
    try {
      // Ensure user is authenticated
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const {projectId} = request.data;
      if (!projectId) {
        throw new HttpsError("invalid-argument", "Project ID is required");
      }

      // Check if project exists and get access info
      const projectAccess = await getProjectAccess(projectId);
      if (!projectAccess) {
        throw new HttpsError("not-found", "Project not found");
      }

      // Only owner can delete project
      if (projectAccess.owner !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Only the project owner can delete the project");
      }

      // Delete all files in storage
      const bucket = storage.bucket();
      const prefix = `audio/${projectId}/`;
      const [files] = await bucket.getFiles({prefix});

      // Delete all files in parallel
      await Promise.all(files.map((file) => file.delete()));

      // Delete all comments
      const commentsRef = db.collection("comments").where("projectId", "==", projectId);
      const commentsSnapshot = await commentsRef.get();
      const commentBatch = db.batch();
      commentsSnapshot.docs.forEach((doc) => {
        commentBatch.delete(doc.ref);
      });
      await commentBatch.commit();

      // Delete all invitations
      const invitationsRef = db.collection("projects").doc(projectId).collection("invitations");
      const invitationsSnapshot = await invitationsRef.get();
      const invitationBatch = db.batch();
      invitationsSnapshot.docs.forEach((doc) => {
        invitationBatch.delete(doc.ref);
      });
      await invitationBatch.commit();

      // Finally, delete the project document
      await db.collection("projects").doc(projectId).delete();

      logger.info("Project deleted", {
        projectId,
        deletedBy: request.auth.uid,
        filesDeleted: files.length,
        commentsDeleted: commentsSnapshot.size,
        invitationsDeleted: invitationsSnapshot.size,
      });

      return {success: true};
    } catch (error) {
      logger.error("Error deleting project:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to delete project");
    }
  }
);
