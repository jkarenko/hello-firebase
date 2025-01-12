import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure } from "@nextui-org/react";
import { EllipsisVerticalIcon, ShareIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState, useRef } from 'react';
import { getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { getDisplayName } from '../utils/audio';
import ShareProject from './ShareProject';
import { useNavigate } from 'react-router-dom';

interface ProjectActionsProps {
  projectId: string;
  projectName: string;
  selectedVersion: string;
  commentCount: number;
  isOwner: boolean;
  onProjectRenamed: (newName: string) => void;
  onVersionDeleted: () => void;
}

export const ProjectActions = ({
  projectId,
  projectName,
  selectedVersion,
  commentCount,
  isOwner,
  onProjectRenamed,
  onVersionDeleted,
}: ProjectActionsProps) => {
  const navigate = useNavigate();
  const renameModal = useDisclosure();
  const deleteModal = useDisclosure();
  const deleteProjectModal = useDisclosure();
  const shareRef = useRef<{ onOpen: () => void } | null>(null);
  const [newProjectName, setNewProjectName] = useState(projectName);
  const [isLoading, setIsLoading] = useState(false);

  const handleRename = async () => {
    if (!newProjectName.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const functions = getFirebaseFunctions();
      const renameProjectFn = httpsCallable(functions, 'renameProject');
      await renameProjectFn({ projectId, name: newProjectName.trim() });
      onProjectRenamed(newProjectName.trim());
      renameModal.onClose();
      toast.success('Project renamed successfully');
    } catch (err) {
      console.error('Error renaming project:', err);
      toast.error('Failed to rename project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const functions = getFirebaseFunctions();
      const deleteVersionFn = httpsCallable(functions, 'deleteVersion');
      await deleteVersionFn({ projectId, versionFilename: selectedVersion });
      toast.success('Version deleted successfully');
      onVersionDeleted();
      deleteModal.onClose();
    } catch (err) {
      console.error('Failed to delete version:', err);
      toast.error('Failed to delete version');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsLoading(true);
    try {
      const functions = getFirebaseFunctions();
      const deleteProjectFn = httpsCallable(functions, 'deleteProject');
      await deleteProjectFn({ projectId });
      toast.success('Project deleted successfully');
      deleteProjectModal.onClose();
      navigate('/');
    } catch (err) {
      console.error('Failed to delete project:', err);
      toast.error('Failed to delete project');
    } finally {
      setIsLoading(false);
    }
  };

  const openRenameModal = () => {
    setNewProjectName(projectName);
    renameModal.onOpen();
  };

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button 
            isIconOnly
            variant="flat"
            className="data-[hover]:bg-default-100"
            aria-label="Project actions"
          >
            <EllipsisVerticalIcon className="w-6 h-6" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Project actions">
          <DropdownItem
            key="share"
            description="Share this project with others"
            startContent={<ShareIcon className="w-4 h-4 text-default-500" />}
            onPress={() => shareRef.current?.onOpen()}
          >
            Share Project
          </DropdownItem>
          {isOwner ? (
            <DropdownItem
              key="rename"
              description="Change project name"
              startContent={<PencilIcon className="w-4 h-4 text-default-500" />}
              onPress={openRenameModal}
            >
              Rename Project
            </DropdownItem>
          ) : null}
          {(isOwner && selectedVersion) ? (
            <DropdownItem
              key="delete-version"
              className="text-danger"
              color="danger"
              description="Delete current version"
              startContent={<TrashIcon className="w-4 h-4" />}
              onPress={deleteModal.onOpen}
            >
              Delete Version
            </DropdownItem>
          ) : null}
          {isOwner ? (
            <DropdownItem
              key="delete-project"
              className="text-danger"
              color="danger"
              description="Permanently delete this project"
              startContent={<TrashIcon className="w-4 h-4" />}
              onPress={deleteProjectModal.onOpen}
            >
              Delete Project
            </DropdownItem>
          ) : null}
        </DropdownMenu>
      </Dropdown>

      {/* Share Project Component */}
      <ShareProject
        ref={shareRef}
        projectId={projectId}
        projectName={projectName}
      />

      {/* Rename Modal */}
      <Modal 
        isOpen={renameModal.isOpen} 
        onOpenChange={renameModal.onOpenChange}
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Rename Project</ModalHeader>
              <ModalBody>
                <Input
                  label="Project Name"
                  placeholder="Enter new project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleRename}
                  isLoading={isLoading}
                >
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Version Modal */}
      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader>Delete Version</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete <strong>{getDisplayName(selectedVersion)}</strong>?</p>
            {commentCount > 0 && (
              <p className="text-danger">This will also delete {commentCount} comment{commentCount === 1 ? '' : 's'} associated with this version.</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={deleteModal.onClose}>
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

      {/* Delete Project Modal */}
      <Modal isOpen={deleteProjectModal.isOpen} onClose={deleteProjectModal.onClose}>
        <ModalContent>
          <ModalHeader>Delete Project</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete <strong>{projectName}</strong>?</p>
            <p className="text-danger">This action cannot be undone. All versions and comments will be permanently deleted.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={deleteProjectModal.onClose}>
              Cancel
            </Button>
            <Button 
              color="danger" 
              onPress={handleDeleteProject}
              isLoading={isLoading}
            >
              Delete Project
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}; 
