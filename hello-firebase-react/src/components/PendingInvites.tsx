import { useState, useEffect } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody } from "@nextui-org/react";
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  owner: string;
  ownerEmail: string | null;
  isCollaborator: boolean;
  collaboratorRole?: "reader" | "editor" | "pending";
}

interface GetProjectsResponse {
  songs: Project[];
}

interface PendingInvitesProps {
  onInviteAccepted?: () => void;
  setPendingCount?: (count: number) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const PendingInvites = ({ onInviteAccepted, setPendingCount, isOpen, onOpenChange }: PendingInvitesProps) => {
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPendingInvites = async () => {
    try {
      setLoading(true);
      const functions = getFirebaseFunctions();
      const getProjectsFn = httpsCallable<any, GetProjectsResponse>(functions, 'getProjects');
      const result = await getProjectsFn({});
      
      // Filter for projects where the user is a pending collaborator
      const pending = result.data.songs.filter(project => 
        project.isCollaborator && project.collaboratorRole === "pending"
      );
      setPendingProjects(pending);
      setPendingCount?.(pending.length);
    } catch (error) {
      console.error('Error fetching pending invites:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingInvites();
  }, []);

  const handleResponse = async (projectId: string, accept: boolean) => {
    try {
      setActionLoading(projectId);
      const functions = getFirebaseFunctions();
      const respondToInviteFn = httpsCallable(functions, 'respondToCollaborationInvite');
      await respondToInviteFn({ projectId, accept });
      
      // Remove the project from the list
      const project = pendingProjects.find(p => p.id === projectId);
      setPendingProjects(prev => {
        const newPendingProjects = prev.filter(p => p.id !== projectId);
        setPendingCount?.(newPendingProjects.length);
        return newPendingProjects;
      });
      
      // Show toast for accepted invitation
      if (accept && project) {
        toast.success("Invitation accepted!", {
          description: `Project: ${project.name}`,
          duration: 3000,
        });
        // Trigger projects list refresh
        onInviteAccepted?.();
      }
    } catch (error) {
      console.error('Error responding to invite:', error);
      toast.error("Failed to respond to invitation", {
        description: error instanceof Error ? error.message : "An error occurred",
        duration: 3000,
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => onOpenChange(false)}
      placement="top-center"
      classNames={{
        wrapper: "z-[2000]"
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-lg">Pending Invitations</h2>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4 py-2">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : pendingProjects.length === 0 ? (
              <div className="text-center text-foreground-500 py-4">
                No pending invitations
              </div>
            ) : (
              pendingProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-background-100 rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{project.name}</div>
                    <div className="text-small text-foreground-500">
                      from {project.ownerEmail || 'Unknown'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      color="danger"
                      variant="flat"
                      size="sm"
                      onPress={() => handleResponse(project.id, false)}
                      isLoading={actionLoading === project.id}
                    >
                      Decline
                    </Button>
                    <Button
                      color="primary"
                      size="sm"
                      onPress={() => handleResponse(project.id, true)}
                      isLoading={actionLoading === project.id}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default PendingInvites; 
