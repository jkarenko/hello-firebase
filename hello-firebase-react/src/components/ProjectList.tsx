import { useState, useEffect } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure } from "@nextui-org/react";

interface Project {
  id: string;
  name: string;
  versions: Array<{
    filename: string;
    displayName: string;
  }>;
}

interface ProjectListProps {
  onProjectSelect: (projectId: string) => void;
}

const ProjectList = ({ onProjectSelect }: ProjectListProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleCreateProject = async () => {
    try {
      const {currentUser} = window.firebase.auth();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const createProjectFn = window.firebase.functions().httpsCallable('createProject');
      const result = await createProjectFn({ name: newProjectName });
      
      setProjects(prevProjects => [...prevProjects, result.data]);
      setNewProjectName('');
      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
    }
  };

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const {currentUser} = window.firebase.auth();
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        const getProjectsFn = window.firebase.functions().httpsCallable('getProjects');
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
          await window.firebase.auth().signOut();
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
      <div className="flex justify-between items-center mb-6">
        <h1>Select a Project</h1>
        <Button 
          color="primary" 
          onPress={onOpen}
          className="px-4"
        >
          Create New Project
        </Button>
      </div>

      <div className="project-list" id="projectList">
        {projects.length === 0 ? (
          <div className="no-projects">No projects available</div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => onProjectSelect(project.id)}
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
