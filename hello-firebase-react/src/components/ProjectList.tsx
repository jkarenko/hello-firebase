import { useState, useEffect } from 'react';

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

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const currentUser = window.firebase.auth().currentUser;
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        const token = await currentUser.getIdToken();
        if (!token) {
          throw new Error('Failed to get auth token');
        }

        const response = await fetch('/getSongVersions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        let result;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          throw new Error('Failed to parse server response');
        }

        if (!result || !Array.isArray(result.songs)) {
          throw new Error('Invalid response format');
        }

        console.log('Projects loaded:', result);
        setProjects(result.songs);
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
      <h1>Select a Project</h1>
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
    </div>
  );
};

export default ProjectList; 
