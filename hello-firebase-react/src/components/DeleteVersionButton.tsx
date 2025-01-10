import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import { TrashIcon } from '@heroicons/react/24/outline';
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';

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
  const functions = getFirebaseFunctions();

  if (!isOwner) {
    return null;
  }

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const deleteVersionFn = httpsCallable(functions, 'deleteVersion');
      await deleteVersionFn({ projectId, versionFilename });
      toast.success('Version deleted successfully');
      setIsOpen(false);
      onDeleted();
    } catch (err) {
      console.error('Failed to delete version:', err);
      toast.error('Failed to delete version');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        color="danger"
        variant="light"
        startContent={<TrashIcon className="w-4 h-4" />}
        onClick={() => setIsOpen(true)}
      >
        Delete Version
      </Button>

      <Modal isOpen={isOpen} onClose={() => !isLoading && setIsOpen(false)}>
        <ModalContent>
          <ModalHeader>Delete Version</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete this version?</p>
            <p className="text-sm text-gray-500 mt-2">
              This will permanently delete:
              <ul className="list-disc list-inside mt-1">
                <li>The version file</li>
                {commentCount > 0 && (
                  <li>{commentCount} comment{commentCount !== 1 ? 's' : ''} associated with this version</li>
                )}
              </ul>
            </p>
            <p className="text-sm text-danger mt-4">
              This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDelete}
              isLoading={isLoading}
            >
              Delete Version
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}; 
