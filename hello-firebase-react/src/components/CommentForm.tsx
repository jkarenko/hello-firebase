import { useState } from 'react';
import { Button, Textarea } from "@nextui-org/react";
import { useComments } from '../hooks/useComments';
import { CommentTimeRange } from '../types/comments';

interface CommentFormProps {
  projectId: string;
  versionFilename: string;
  currentTimeRange: CommentTimeRange;
  onCommentCreate: () => void;
}

export const CommentForm = ({ projectId, versionFilename, currentTimeRange, onCommentCreate }: CommentFormProps) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createComment } = useComments(projectId, versionFilename);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await createComment({
        content: content.trim(),
        versionFilename,
        startTimestamp: currentTimeRange.start,
        endTimestamp: currentTimeRange.end,
      });
      setContent('');
      onCommentCreate();
    } catch (err) {
      console.error('Failed to create comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500">
        Commenting at: {formatTimestamp(currentTimeRange.start)}
        {currentTimeRange.start !== currentTimeRange.end && 
          ` - ${formatTimestamp(currentTimeRange.end)}`}
      </div>
      <Textarea
        placeholder="Add a comment... Use @email to mention someone"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        minRows={2}
        maxRows={5}
      />
      <div className="flex justify-end">
        <Button
          color="primary"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          isDisabled={!content.trim()}
        >
          Add Comment
        </Button>
      </div>
    </div>
  );
}; 
