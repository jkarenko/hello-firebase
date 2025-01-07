import { useState, useEffect } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, useDisclosure, Badge } from "@nextui-org/react";
import { InboxIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

interface Project {
  id: string;
  name: string;
  owner: string;
  isCollaborator: boolean;
  collaboratorRole?: "reader" | "editor" | "pending";
}

interface GetProjectsResponse {
  songs: Project[];
}

const PendingInvites = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
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
      setPendingProjects(prev => prev.filter(p => p.id !== projectId));
      
      // If no more pending invites, close the modal
      if (pendingProjects.length === 1) {
        onClose();
      }
    } catch (error) {
      console.error('Error responding to invite:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="relative">
        <Button
          isIconOnly
          variant="light"
          onPress={onOpen}
          aria-label="Pending invitations"
          className="min-w-unit-8 w-unit-8 h-unit-8"
        >
          <InboxIcon className="w-5 h-5" />
          {pendingProjects.length > 0 && (
            <Badge
              color="danger"
              size="sm"
              className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2"
            >
              {pendingProjects.length}
            </Badge>
          )}
        </Button>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="md"
        isDismissable={true}
        hideCloseButton={true}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex justify-between items-center w-full">
              <h2 className="text-lg">Pending Invitations</h2>
              <Button
                isIconOnly
                variant="light"
                onPress={onClose}
                className="absolute right-2 top-2"
              >
                <XMarkIcon className="w-5 h-5" />
              </Button>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4 py-2">
              {pendingProjects.length === 0 ? (
                <div className="text-center text-default-500 py-4">
                  No pending invitations
                </div>
              ) : (
                pendingProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-default-100 rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{project.name}</div>
                      <div className="text-small text-default-500">
                        from {project.owner}
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
    </>
  );
};

export default PendingInvites; 
