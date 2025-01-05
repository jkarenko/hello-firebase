import { useState, useRef, DragEvent } from 'react';
import { Button, Progress } from "@nextui-org/react";
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface FileUploadProps {
  projectId: string;
  onUploadComplete: () => void;
}

interface UploadUrlResponse {
  signedUrl: string;
}

const FileUpload = ({ projectId, onUploadComplete }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Validate file type
      if (!file.type.startsWith('audio/')) {
        throw new Error('Please upload an audio file');
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}_${file.name}`;

      // Get signed URL for upload
      const functions = getFunctions();
      const getUploadUrl = httpsCallable<{ projectId: string, filename: string }, UploadUrlResponse>(functions, 'getUploadUrl');
      const { data: { signedUrl } } = await getUploadUrl({ projectId, filename });

      // Upload the file with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setUploadProgress(100);
      onUploadComplete();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(null);
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

        <CloudArrowUpIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        
        <div className="mb-4">
          <p className="text-lg mb-2">
            Drag and drop your audio file here
          </p>
          <p className="text-sm text-gray-500">
            or
          </p>
        </div>

        <Button
          color="primary"
          variant="flat"
          onPress={() => fileInputRef.current?.click()}
          className="mx-auto"
        >
          Select File
        </Button>

        {uploadProgress !== null && (
          <Progress
            aria-label="Upload progress"
            value={uploadProgress}
            className="mt-4"
            color="primary"
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
