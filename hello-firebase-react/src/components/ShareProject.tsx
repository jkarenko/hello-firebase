import { useState, useEffect } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, Input, useDisclosure, Switch } from "@nextui-org/react";
import { TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getFirebaseFunctions, getAuth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import InviteLinkManager from './InviteLinkManager';

interface Collaborator {
  email: string;
  isEditor: boolean;
  isPending: boolean;
}

interface ShareProjectProps {
  projectId: string;
  projectName: string;
}

const ShareProject = React.forwardRef<{ onOpen: () => void }, ShareProjectProps>(({ projectId, projectName }, ref) => {
  const navigate = useNavigate();
  const shareModal = useDisclosure();
  const confirmModal = useDisclosure();
  const leaveConfirmModal = useDisclosure();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [ownerEmail, setOwnerEmail] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [collaboratorToRemove, setCollaboratorToRemove] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Expose onOpen method through ref
  React.useImperativeHandle(ref, () => ({
    onOpen: shareModal.onOpen
  }));

  // Track auth state
  useEffect(() => {
    const auth = getAuth();
    console.log('Initial auth state:', {
      currentUser: auth.currentUser,
      email: auth.currentUser?.email
    });
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', {
        user,
        email: user?.email
      });
      setCurrentUserEmail(user?.email || null);
    });
    return () => unsubscribe();
  }, []);

  const fetchCollaborators = async () => {
    try {
      const functions = getFirebaseFunctions();
      const getCollaboratorsFn = httpsCallable(functions, 'getCollaborators');
      const result = await getCollaboratorsFn({ projectId });
      setCollaborators(result.data as Collaborator[]);

      // Get owner email
      const ownerInfo = await httpsCallable(functions, 'getProjectOwner')({ projectId });
      const ownerEmailResult = (ownerInfo.data as { email: string }).email;
      setOwnerEmail(ownerEmailResult);
      
      // Check if current user is owner by comparing emails
      const auth = getAuth();
      const userEmail = auth.currentUser?.email || currentUserEmail;
      const isCurrentUserOwner = userEmail === ownerEmailResult;
      
      console.log('Debug ownership check:', {
        userEmail,
        currentUserEmail,
        ownerEmailResult,
        isCurrentUserOwner,
        authCurrentUser: auth.currentUser
      });
      
      setIsOwner(isCurrentUserOwner);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
    }
  };

  // Refetch when currentUserEmail changes
  useEffect(() => {
    console.log('Share modal state changed:', {
      isOpen: shareModal.isOpen,
      currentUserEmail,
      projectId
    });
    
    if (shareModal.isOpen) {
      fetchCollaborators();
    }
  }, [shareModal.isOpen, projectId, currentUserEmail]);

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

  const handleRemoveCollaborator = async (email: string) => {
    setCollaboratorToRemove(email);
    confirmModal.onOpen();
  };

  const confirmRemoveCollaborator = async () => {
    if (!collaboratorToRemove) {
      return;
    }
    
    try {
      const functions = getFirebaseFunctions();
      const removeCollaboratorFn = httpsCallable(functions, 'removeCollaboratorCall');
      await removeCollaboratorFn({ projectId, email: collaboratorToRemove });
      await fetchCollaborators();
      // Close modal and reset state
      confirmModal.onClose();
      setCollaboratorToRemove(null);
      // Return focus to the share modal
      setTimeout(() => {
        const shareModalElement = document.querySelector('[role="dialog"]');
        if (shareModalElement) {
          (shareModalElement as HTMLElement).focus();
        }
      }, 0);
    } catch (err) {
      console.error('Error removing collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    }
  };

  const handleLeaveProject = async () => {
    if (!currentUserEmail) {
      return;
    }
    
    try {
      const functions = getFirebaseFunctions();
      const removeCollaboratorFn = httpsCallable(functions, 'removeCollaboratorCall');
      await removeCollaboratorFn({ projectId, email: currentUserEmail });
      leaveConfirmModal.onClose();
      shareModal.onClose();
      // Navigate back to project list
      navigate('/');
    } catch (err) {
      console.error('Error leaving project:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave project');
    }
  };

  // Add debug render log
  console.log('Render state:', { isOwner, ownerEmail, collaborators });

  return (
    <>
      <Modal 
        isOpen={shareModal.isOpen} 
        onClose={shareModal.onClose} 
        size="lg"
        isDismissable={true}
        hideCloseButton={true}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex justify-between items-center w-full">
              <h2 className="text-lg">{projectName}</h2>
              <Button
                isIconOnly
                variant="light"
                onPress={shareModal.onClose}
                className="absolute right-2 top-2"
              >
                <XMarkIcon className="w-5 h-5" />
              </Button>
            </div>
            {!isOwner && currentUserEmail && collaborators.some(c => c.email === currentUserEmail) && (
              <div className="text-small text-foreground-500 flex items-center justify-between">
                <span>You have {collaborators.find(c => c.email === currentUserEmail)?.isEditor ? "editor" : "viewer"} access</span>
                <Button
                  color="danger"
                  variant="flat"
                  onPress={() => leaveConfirmModal.onOpen()}
                  size="sm"
                >
                  Leave Project
                </Button>
              </div>
            )}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Add collaborator section - only visible to owners and editors */}
              {isOwner && (
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
              )}

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
                  <h3 className="text-sm font-medium text-foreground">People with access</h3>
                  <div className="space-y-3">
                    {collaborators.map((collaborator) => (
                      <div key={collaborator.email} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground">{collaborator.email}</span>
                          {collaborator.isPending && (
                            <span className="text-xs text-foreground-400">(Pending)</span>
                          )}
                        </div>
                        {isOwner && collaborator.email !== ownerEmail && (
                          <div className="flex items-center gap-2">
                            <Switch
                              size="sm"
                              isSelected={collaborator.isEditor}
                              onValueChange={(isEditor) => handleToggleEditor(collaborator.email, isEditor)}
                            >
                              Can edit
                            </Switch>
                            <Button
                              isIconOnly
                              variant="flat"
                              color="danger"
                              onPress={() => handleRemoveCollaborator(collaborator.email)}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite Links section */}
              {isOwner && (
                <div className="mt-6 pt-6 border-t border-divider">
                  <InviteLinkManager
                    projectId={projectId}
                  isOwner={isOwner}
                  isEditor={collaborators.find(c => c.email === currentUserEmail)?.isEditor ?? false}
                />
              </div>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Confirmation Modal */}
      <Modal 
        isOpen={confirmModal.isOpen} 
        onClose={confirmModal.onClose} 
        size="sm"
        isDismissable={true}
      >
        <ModalContent>
          <ModalHeader>Remove Collaborator</ModalHeader>
          <ModalBody>
            <div className="space-y-4 pb-4">
              <p>Are you sure you want to remove {collaboratorToRemove} from this project?</p>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="flat" 
                  onPress={() => {
                    confirmModal.onClose();
                    setCollaboratorToRemove(null);
                  }}
                  autoFocus
                >
                  Cancel
                </Button>
                <Button 
                  color="danger" 
                  onPress={confirmRemoveCollaborator}
                >
                  Remove
                </Button>
              </div>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Leave Project Confirmation Modal */}
      <Modal 
        isOpen={leaveConfirmModal.isOpen} 
        onClose={leaveConfirmModal.onClose} 
        size="sm"
        isDismissable={true}
      >
        <ModalContent>
          <ModalHeader>Leave Project</ModalHeader>
          <ModalBody>
            <div className="space-y-4 pb-4">
              <p>Are you sure you want to leave this project? You'll lose access to all project content.</p>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="flat" 
                  onPress={leaveConfirmModal.onClose}
                  autoFocus
                >
                  Cancel
                </Button>
                <Button 
                  color="danger" 
                  onPress={handleLeaveProject}
                >
                  Leave Project
                </Button>
              </div>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
});

export default React.memo(ShareProject); 
