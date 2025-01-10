import { useState, useMemo } from 'react';
import { Card, CardBody, Avatar, Button, Select, SelectItem, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import { CheckCircleIcon, XCircleIcon, ChatBubbleLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useComments } from '../hooks/useComments';
import { CommentWithUserInfo, CommentFilterBy, CommentSortBy, CommentTimeRange } from '../types/comments';
import { formatDistanceToNow } from 'date-fns';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

const DeleteModal = ({ isOpen, onClose, onConfirm, isLoading }: DeleteModalProps) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <ModalContent>
      <ModalHeader>Delete Comment</ModalHeader>
      <ModalBody>
        Are you sure you want to delete this comment? This action cannot be undone.
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          Cancel
        </Button>
        <Button 
          color="danger" 
          onPress={onConfirm}
          isLoading={isLoading}
        >
          Delete
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
);

interface CommentListProps {
  projectId: string;
  versionFilename: string;
  onTimeRangeClick: (range: CommentTimeRange) => void;
}

export const CommentList = ({ projectId, versionFilename, onTimeRangeClick }: CommentListProps) => {
  const [filter, setFilter] = useState<CommentFilterBy>('all');
  const [sortBy, setSortBy] = useState<CommentSortBy>('timestamp');
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    commentId: string | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    commentId: null,
    isLoading: false,
  });
  
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  const {
    comments,
    loading,
    error,
    updateComment,
    deleteComment,
    filterComments,
    sortComments,
  } = useComments(projectId, versionFilename);

  const handleDeleteClick = (commentId: string) => {
    setDeleteModalState({
      isOpen: true,
      commentId,
      isLoading: false,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalState.commentId) return;

    setDeleteModalState(prev => ({ ...prev, isLoading: true }));
    try {
      await deleteComment(deleteModalState.commentId);
      toast.success('Comment deleted');
      setDeleteModalState({
        isOpen: false,
        commentId: null,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error('Failed to delete comment');
      setDeleteModalState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalState({
      isOpen: false,
      commentId: null,
      isLoading: false,
    });
  };

  const filteredAndSortedComments = useMemo(() => {
    const filtered = filterComments(comments, filter, userId);
    return sortComments(filtered, sortBy);
  }, [comments, filter, sortBy, userId, filterComments, sortComments]);

  const handleResolve = async (comment: CommentWithUserInfo) => {
    try {
      await updateComment(comment.id, { resolved: !comment.resolved });
      toast.success(comment.resolved ? 'Comment unresolved' : 'Comment resolved');
    } catch (err) {
      console.error('Failed to update comment:', err);
      toast.error('Failed to update comment status');
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner label="Loading comments..." color="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-danger-50">
        <CardBody className="text-center text-danger">
          <p>Error: {error}</p>
          <Button color="primary" variant="flat" className="mt-2" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Select
          label="Filter"
          selectedKeys={[filter]}
          onChange={(e) => setFilter(e.target.value as CommentFilterBy)}
        >
          <SelectItem key="all" value="all">All Comments</SelectItem>
          <SelectItem key="resolved" value="resolved">Resolved</SelectItem>
          <SelectItem key="unresolved" value="unresolved">Unresolved</SelectItem>
          <SelectItem key="mine" value="mine">My Comments</SelectItem>
        </Select>

        <Select
          label="Sort by"
          selectedKeys={[sortBy]}
          onChange={(e) => setSortBy(e.target.value as CommentSortBy)}
        >
          <SelectItem key="timestamp" value="timestamp">Time in Track</SelectItem>
          <SelectItem key="createdAt" value="createdAt">Date Created</SelectItem>
          <SelectItem key="resolved" value="resolved">Resolution Status</SelectItem>
        </Select>
      </div>

      {filteredAndSortedComments.length === 0 ? (
        <Card className="w-full">
          <CardBody className="text-center py-8">
            <ChatBubbleLeftIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600">No comments yet</p>
            <p className="text-sm text-gray-400">Be the first to add a comment!</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedComments.map((comment) => (
            <Card key={comment.id} className="w-full">
              <CardBody>
                <div className="flex items-start gap-4">
                  <Avatar
                    src={comment.createdByUser.photoURL || undefined}
                    name={comment.createdByUser.displayName || ''}
                    size="sm"
                  />
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{comment.createdByUser.displayName}</span>
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true })}
                      </span>
                      <Button
                        size="sm"
                        variant="light"
                        onClick={() => onTimeRangeClick({
                          start: comment.startTimestamp,
                          end: comment.endTimestamp
                        })}
                      >
                        {formatTimestamp(comment.startTimestamp)}
                        {comment.startTimestamp !== comment.endTimestamp && 
                          ` - ${formatTimestamp(comment.endTimestamp)}`}
                      </Button>
                    </div>
                    <p className="text-sm mb-2">{comment.content}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        color={comment.resolved ? "success" : "default"}
                        variant="flat"
                        onClick={() => handleResolve(comment)}
                        startContent={comment.resolved ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                      >
                        {comment.resolved ? 'Resolved' : 'Mark Resolved'}
                      </Button>
                      {comment.resolved && comment.resolvedByUser && (
                        <span className="text-xs text-gray-500">
                          by {comment.resolvedByUser.displayName}
                        </span>
                      )}
                      {comment.createdBy === userId && (
                        <Button
                          size="sm"
                          color="danger"
                          variant="light"
                          onClick={() => handleDeleteClick(comment.id)}
                          startContent={<TrashIcon className="w-4 h-4" />}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <DeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteModalState.isLoading}
      />
    </div>
  );
}; 
