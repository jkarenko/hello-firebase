import { useState, useRef, DragEvent, useEffect } from 'react';
import { Button, Progress } from "@nextui-org/react";
import { CloudArrowUpIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { getFirebaseStorage } from '../firebase';
import { ref, uploadBytesResumable } from 'firebase/storage';

interface FileUploadProps {
  projectId: string;
  onUploadComplete: () => void;
}

const FileUpload = ({ projectId, onUploadComplete }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset success state after 3 seconds
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showSuccess) {
      timeout = setTimeout(() => {
        setShowSuccess(false);
        setUploadProgress(null);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [showSuccess]);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleUpload = async (file: File) => {
    try {
      setError(null);
      setUploadProgress(0);
      setShowSuccess(false);

      // Validate file type
      if (!file.type.startsWith('audio/')) {
        throw new Error('Please upload an audio file');
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}_${file.name}`;

      // Get storage reference
      const storage = getFirebaseStorage();
      const storageRef = ref(storage, `audio/${projectId}/${filename}`);

      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          setError('Upload failed: ' + error.message);
          setUploadProgress(null);
          setShowSuccess(false);
        },
        () => {
          setUploadProgress(100);
          setShowSuccess(true);
          onUploadComplete();
        }
      );
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(null);
      setShowSuccess(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleUpload(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUpload(file);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/10'
            : showSuccess
            ? 'border-success bg-success/10'
            : 'border-gray-300 hover:border-primary'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="audio/*"
          className="hidden"
        />

        {showSuccess ? (
          <CheckCircleIcon className="w-12 h-12 mx-auto mb-4 text-success animate-fade-in" />
        ) : (
          <CloudArrowUpIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        )}
        
        <div className="mb-4">
          <p className="text-lg mb-2">
            {showSuccess ? 'Upload successful!' : 'Drag and drop your audio file here'}
          </p>
          {!showSuccess && (
            <p className="text-sm text-gray-500">
              or
            </p>
          )}
        </div>

        {!showSuccess && (
          <Button
            color="primary"
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
            className="mx-auto"
          >
            Select File
          </Button>
        )}

        {uploadProgress !== null && !showSuccess && (
          <Progress
            aria-label="Upload progress"
            value={uploadProgress}
            className="mt-4"
            color={uploadProgress === 100 ? "success" : "primary"}
          />
        )}

        {error && (
          <p className="mt-4 text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default FileUpload; 
