import { useState, useMemo } from 'react';
import { Card, CardBody, Avatar, Button, Select, SelectItem } from "@nextui-org/react";
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useComments } from '../hooks/useComments';
import { CommentWithUserInfo, CommentFilterBy, CommentSortBy, CommentTimeRange } from '../types/comments';
import { formatDistanceToNow } from 'date-fns';
import { getAuth } from 'firebase/auth';

interface CommentListProps {
  projectId: string;
  versionFilename: string;
  onTimeRangeClick: (range: CommentTimeRange) => void;
}

export const CommentList = ({ projectId, versionFilename, onTimeRangeClick }: CommentListProps) => {
  const [filter, setFilter] = useState<CommentFilterBy>('all');
  const [sortBy, setSortBy] = useState<CommentSortBy>('timestamp');
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  const {
    comments,
    loading,
    error,
    updateComment,
    filterComments,
    sortComments,
  } = useComments(projectId, versionFilename);

  const filteredAndSortedComments = useMemo(() => {
    const filtered = filterComments(comments, filter, userId);
    return sortComments(filtered, sortBy);
  }, [comments, filter, sortBy, userId, filterComments, sortComments]);

  const handleResolve = async (comment: CommentWithUserInfo) => {
    try {
      await updateComment(comment.id, { resolved: !comment.resolved });
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) return <div>Loading comments...</div>;
  if (error) return <div>Error: {error}</div>;

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
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}; 
