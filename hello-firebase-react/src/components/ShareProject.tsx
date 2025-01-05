import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure } from "@nextui-org/react";
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

interface ShareProjectProps {
  projectId: string;
  projectName: string;
}

const ShareProject = ({ projectId, projectName }: ShareProjectProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    try {
      setError(null);
      const functions = getFirebaseFunctions();
      const addCollaboratorFn = httpsCallable(functions, 'addCollaborator');
      await addCollaboratorFn({ projectId, email });
      onClose();
      setEmail('');
    } catch (err) {
      console.error('Error sharing project:', err);
      setError(err instanceof Error ? err.message : 'Failed to share project');
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

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Share {projectName}</ModalHeader>
          <ModalBody>
            <Input
              label="Email Address"
              placeholder="Enter collaborator's email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              errorMessage={error}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleShare}
              isDisabled={!email.trim()}
            >
              Share
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ShareProject; 
