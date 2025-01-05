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
      role: "reader" | "editor";
      addedAt: Timestamp;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  role: "reader" | "editor" = "reader"
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

      return {
        id: projectAccess.projectId,
        name: projectAccess.projectName,
        versions,
      };
    });

    const projects = (await Promise.all(projectPromises)).filter((p): p is NonNullable<typeof p> => p !== null);

    logger.debug("All projects with versions:", {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        versionCount: p.versions.length,
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

export const addCollaborator = onCall(async (request) => {
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

    // Check if user is the owner
    if (projectAccess.owner !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the project owner can add collaborators");
    }

    // Get user by email
    try {
      const userRecord = await getAuth().getUserByEmail(email);

      // Don't allow adding the owner as a collaborator
      if (userRecord.uid === projectAccess.owner) {
        throw new HttpsError("invalid-argument", "Cannot add project owner as a collaborator");
      }

      // Add collaborator with reader role
      await addProjectCollaborator(projectId, userRecord.uid);

      logger.info("Added collaborator to project", {
        projectId,
        collaboratorUid: userRecord.uid,
        collaboratorEmail: email,
        addedBy: request.auth.uid,
      });

      return {success: true};
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Error adding collaborator:", error);
      throw new HttpsError("not-found", "User not found");
    }
  } catch (error) {
    logger.error("Error in addCollaborator:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to add collaborator");
  }
});

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

      // Get collaborator emails
      const collaboratorPromises = Object.entries(projectAccess.collaborators || {}).map(async ([uid, data]) => {
        try {
          const user = await getAuth().getUser(uid);
          return {
            email: user.email || "",
            isEditor: data.role === "editor",
          };
        } catch (error) {
          logger.error("Error getting user info:", error);
          return null;
        }
      });

      return (await Promise.all(collaboratorPromises))
              .filter((c): c is NonNullable<typeof c> => c !== null)
              .sort((a, b) => a.email.localeCompare(b.email));
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
