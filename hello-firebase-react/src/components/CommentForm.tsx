import { useState } from 'react';
import { Button, Textarea, Chip } from "@nextui-org/react";
import { useComments } from '../hooks/useComments';
import { CommentTimeRange } from '../types/comments';
import { toast } from 'sonner';

interface CommentFormProps {
  projectId: string;
  versionFilename: string;
  currentTimeRange: CommentTimeRange;
  onCommentCreate: () => void;
}

export const CommentForm = ({ projectId, versionFilename, currentTimeRange, onCommentCreate }: CommentFormProps) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createComment } = useComments(projectId, versionFilename);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createComment({
        content: trimmedContent,
        versionFilename,
        startTimestamp: currentTimeRange.start,
        endTimestamp: currentTimeRange.end,
      });
      
      setContent('');
      toast.success('Comment added successfully');
      onCommentCreate();
    } catch (err) {
      console.error('Failed to create comment:', err);
      setError(err instanceof Error ? err.message : 'Failed to create comment');
      toast.error('Failed to create comment');
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
      <div className="text-sm text-default-500">
        Commenting at: {formatTimestamp(currentTimeRange.start)}
        {currentTimeRange.start !== currentTimeRange.end && 
          ` - ${formatTimestamp(currentTimeRange.end)}`}
      </div>
      <Textarea
        placeholder="Add a comment... Use @email to mention someone"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setError(null);
        }}
        minRows={2}
        maxRows={5}
        isDisabled={isSubmitting}
        classNames={{
          input: error ? "border-danger" : ""
        }}
      />
      {error && (
        <Chip color="danger" variant="flat" size="sm">
          {error}
        </Chip>
      )}
      <div className="flex justify-end">
        <Button
          color="primary"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          isDisabled={!content.trim() || isSubmitting}
        >
          Add Comment
        </Button>
      </div>
    </div>
  );
} 
