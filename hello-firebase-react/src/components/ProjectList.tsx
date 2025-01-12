import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure, Divider, Card, CardBody } from "@nextui-org/react";
import { getFirebaseAuth, getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { eventEmitter, PROJECTS_UPDATED } from '../utils/events';

interface Project {
  id: string;
  name: string;
  versions: Array<{
    filename: string;
    displayName: string;
  }>;
  owner: string;
  isCollaborator: boolean;
  collaboratorRole?: "reader" | "editor" | "pending";
}

interface CreateProjectResponse {
  id: string;
  name: string;
  versions: [];
  owner: string;
  isCollaborator: boolean;
}

interface GetProjectsResponse {
  songs: Project[];
}

const ProjectList = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const auth = getFirebaseAuth();
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      const functions = getFirebaseFunctions();
      const getProjectsFn = httpsCallable<void, GetProjectsResponse>(functions, 'getProjects');
      const result = await getProjectsFn();
      
      if (!result.data || !Array.isArray(result.data.songs)) {
        throw new Error('Invalid response format');
      }

      console.log('Projects loaded:', result.data);
      setProjects(result.data.songs);
    } catch (err) {
      console.error('Error loading projects:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load projects';
      setError(errorMessage);
      if (err instanceof Error && err.message.includes('401')) {
        const auth = getFirebaseAuth();
        await auth.signOut();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Listen for project updates
  useEffect(() => {
    eventEmitter.on(PROJECTS_UPDATED, loadProjects);
    return () => {
      eventEmitter.off(PROJECTS_UPDATED, loadProjects);
    };
  }, [loadProjects]);

  const handleCreateProject = async () => {
    try {
      const auth = getFirebaseAuth();
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      const functions = getFirebaseFunctions();
      const createProjectFn = httpsCallable<{name: string}, CreateProjectResponse>(functions, 'createProject');
      const result = await createProjectFn({ name: newProjectName });
      
      setProjects(prevProjects => [...prevProjects, result.data]);
      setNewProjectName('');
      onClose();
    } catch (err) {
      console.error('Error creating project:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        code: err instanceof Error && 'code' in err ? (err as any).code : 'unknown',
        details: err instanceof Error && 'details' in err ? (err as any).details : 'no details'
      });
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-6 text-foreground">Loading Projects...</h1>
        <div className="text-foreground-50">
          Please wait while we load your projects...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-6 text-foreground">Error</h1>
        <div className="text-danger p-3 my-3 bg-danger-50 rounded-md text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="text-center" id="projectSection">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-foreground">My Projects</h1>
        <Button 
          color="primary" 
          onPress={onOpen}
          className="px-4"
        >
          Create New Project
        </Button>
      </div>

      <div className="space-y-2">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-5 max-w-[1200px] mx-auto" id="projectList">
            {projects.filter(p => !p.isCollaborator).length === 0 ? (
              <div className="text-foreground-50">No projects available</div>
            ) : (
              projects
                .filter(p => !p.isCollaborator)
                .map((project) => (
                  <Card
                    key={project.id}
                    isPressable
                    onPress={() => navigate(`/project/${project.id}`)}
                    className="w-full transition duration-200 hover:-translate-y-0.5"
                  >
                    <CardBody className="p-5">
                      <h2 className="text-lg font-semibold text-foreground mb-2">{project.name}</h2>
                      <p className="text-foreground-50">
                        {project.versions.length} version
                        {project.versions.length === 1 ? '' : 's'}
                      </p>
                    </CardBody>
                  </Card>
                ))
            )}
          </div>
        </div>
      </div>

      <Divider className="my-8" />

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Projects Shared With Me</h1>
      </div>
      
      <div className="space-y-8">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-5 max-w-[1200px] mx-auto">
            {projects.filter(p => p.isCollaborator && p.collaboratorRole !== "pending").length === 0 ? (
              <div className="text-foreground-50">No shared projects</div>
            ) : (
              projects
                .filter(p => p.isCollaborator && p.collaboratorRole !== "pending")
                .map((project) => (
                  <Card
                    key={project.id}
                    isPressable
                    onPress={() => navigate(`/project/${project.id}`)}
                    className="w-full transition duration-200 hover:-translate-y-0.5"
                  >
                    <CardBody className="p-5">
                      <h2 className="text-lg font-semibold text-foreground mb-2">{project.name}</h2>
                      <p className="text-foreground-50">
                        {project.versions.length} version
                        {project.versions.length === 1 ? '' : 's'}
                      </p>
                    </CardBody>
                  </Card>
                ))
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Create New Project</ModalHeader>
          <ModalBody>
            <Input
              label="Project Name"
              placeholder="Enter project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleCreateProject}
              isDisabled={!newProjectName.trim()}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ProjectList; 
