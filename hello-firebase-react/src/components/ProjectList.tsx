import { useState, useEffect } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure, Divider } from "@nextui-org/react";
import { getFirebaseAuth, getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  name: string;
  versions: Array<{
    filename: string;
    displayName: string;
  }>;
  owner: string;
  isCollaborator: boolean;
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

  useEffect(() => {
    const loadProjects = async () => {
      try {
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
    };

    loadProjects();
  }, []);

  if (loading) {
    return (
      <div className="project-section">
        <h1>Loading Projects...</h1>
        <div className="loading-indicator">
          Please wait while we load your projects...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-section">
        <h1>Error</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="project-section" id="projectSection">
      <div className="flex justify-between mb-6 ">
        <h1 className="text-2xl m-0">Your Projects</h1>
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
          <div className="project-list" id="projectList">
            {projects.filter(p => !p.isCollaborator).length === 0 ? (
              <div className="no-projects">No projects available</div>
            ) : (
              projects
                .filter(p => !p.isCollaborator)
                .map((project) => (
                  <div
                    key={project.id}
                    className="project-card"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <h2>{project.name}</h2>
                    <p>
                      {project.versions.length} version
                      {project.versions.length === 1 ? '' : 's'}
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      <Divider></Divider>

      <div className="flex justify-between mb-6">
        <h1 className="text-2xl m-0">Projects Shared With Me</h1>
      </div>
      
      <div className="space-y-8">
        <div>
          <div className="project-list">
            {projects.filter(p => p.isCollaborator).length === 0 ? (
              <div className="no-projects">No shared projects</div>
            ) : (
              projects
                .filter(p => p.isCollaborator)
                .map((project) => (
                  <div
                    key={project.id}
                    className="project-card"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <h2>{project.name}</h2>
                    <p>
                      {project.versions.length} version
                      {project.versions.length === 1 ? '' : 's'}
                    </p>
                  </div>
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
            <Button variant="light" onPress={onClose}>
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
