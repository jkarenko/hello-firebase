import { useState, useEffect } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, Input, useDisclosure, Switch } from "@nextui-org/react";
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

interface Collaborator {
  email: string;
  isEditor: boolean;
}

interface ShareProjectProps {
  projectId: string;
  projectName: string;
}

const ShareProject = ({ projectId, projectName }: ShareProjectProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [ownerEmail, setOwnerEmail] = useState<string>('');

  const fetchCollaborators = async () => {
    try {
      const functions = getFirebaseFunctions();
      const getCollaboratorsFn = httpsCallable(functions, 'getCollaborators');
      const result = await getCollaboratorsFn({ projectId });
      setCollaborators(result.data as Collaborator[]);

      // Get owner email
      const ownerInfo = await httpsCallable(functions, 'getProjectOwner')({ projectId });
      setOwnerEmail((ownerInfo.data as { email: string }).email);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCollaborators();
    }
  }, [isOpen, projectId]);

  const handleShare = async () => {
    try {
      setError(null);
      const functions = getFirebaseFunctions();
      const addCollaboratorFn = httpsCallable(functions, 'addCollaborator');
      await addCollaboratorFn({ projectId, email });
      await fetchCollaborators();
      setEmail('');
    } catch (err) {
      console.error('Error sharing project:', err);
      setError(err instanceof Error ? err.message : 'Failed to share project');
    }
  };

  const handleToggleEditor = async (email: string, isEditor: boolean) => {
    try {
      const functions = getFirebaseFunctions();
      const updateCollaboratorFn = httpsCallable(functions, 'updateCollaborator');
      await updateCollaboratorFn({ projectId, email, isEditor });
      await fetchCollaborators();
    } catch (err) {
      console.error('Error updating collaborator:', err);
    }
  };

  return (
    <>
      <Button
        isIconOnly
        variant="light"
        onPress={onOpen}
        aria-label="Share project"
      >
        <UserPlusIcon className="w-6 h-6" />
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>Share {projectName}</ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Add collaborator section */}
              <div className="flex gap-2">
                <Input
                  label="Email Address"
                  placeholder="Enter collaborator's email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  errorMessage={error}
                  className="flex-grow"
                />
                <Button 
                  color="primary"
                  className="self-end"
                  onPress={handleShare}
                  isDisabled={!email.trim()}
                >
                  Share
                </Button>
              </div>

              {/* Owner section */}
              {ownerEmail && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Owner</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{ownerEmail}</span>
                  </div>
                </div>
              )}
              
              {/* Collaborators section */}
              {collaborators.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Collaborators</h3>
                  <div className="space-y-2">
                    {collaborators.map((collaborator) => (
                      <div key={collaborator.email} className="flex items-center justify-between">
                        <span className="text-sm">{collaborator.email}</span>
                        <Switch
                          size="sm"
                          isSelected={collaborator.isEditor}
                          onValueChange={(checked) => handleToggleEditor(collaborator.email, checked)}
                        >
                          Editor
                        </Switch>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ShareProject; 
