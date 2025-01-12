import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import { TrashIcon } from '@heroicons/react/24/outline';
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { getDisplayName } from '../utils/audio';

interface DeleteVersionButtonProps {
  projectId: string;
  versionFilename: string;
  commentCount: number;
  onDeleted: () => void;
  isOwner: boolean;
}

export const DeleteVersionButton = ({ projectId, versionFilename, commentCount, onDeleted, isOwner }: DeleteVersionButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const functions = getFirebaseFunctions();
      const deleteVersionFn = httpsCallable(functions, 'deleteVersion');
      await deleteVersionFn({ projectId, versionFilename });
      toast.success('Version deleted successfully');
      onDeleted();
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to delete version:', err);
      toast.error('Failed to delete version');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOwner) {
    return null;
  }

  return (
    <>
      <Button
        color="danger"
        variant="light"
        size="sm"
        isIconOnly
        onClick={() => setIsOpen(true)}
        className="text-danger hover:text-danger-600"
      >
        <TrashIcon className="w-4 h-4" />
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <ModalContent>
          <ModalHeader>Delete Version</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete <strong>{getDisplayName(versionFilename)}</strong>?</p>
            {commentCount > 0 && (
              <p className="text-danger">This will also delete {commentCount} comment{commentCount === 1 ? '' : 's'} associated with this version.</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="danger" 
              onPress={handleDelete}
              isLoading={isLoading}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}; 
