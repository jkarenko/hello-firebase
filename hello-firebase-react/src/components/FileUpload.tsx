import { useState, useRef, DragEvent, useEffect } from 'react';
import { Button, Progress } from "@nextui-org/react";
import { CloudArrowUpIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { getFirebaseStorage } from '../firebase';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { SUPPORTED_AUDIO_FORMATS, isSupportedAudioFile, SupportedAudioFormat } from '../utils/audio';

interface FileUploadProps {
  projectId: string;
  onUploadComplete: () => void;
  existingVersions: string[];
}

const FileUpload = ({ projectId, onUploadComplete, existingVersions }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format the supported formats for display
  const supportedFormatsDisplay = SUPPORTED_AUDIO_FORMATS
    .map((format: SupportedAudioFormat) => format.replace('.', '').toUpperCase())
    .join(', ');

  // Helper function to add timestamp prefix to filename
  const getFilenameWithTimestamp = (originalName: string): string => {
    // Get current timestamp
    const timestamp = Date.now();
    
    // Create filename with timestamp prefix
    return `${timestamp}_${originalName}`;
  };

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

      // Validate file type using our shared utility
      if (!isSupportedAudioFile(file.name)) {
        throw new Error(`Unsupported file format. Please upload ${supportedFormatsDisplay} files only.`);
      }

      // Add timestamp suffix to filename
      const filename = getFilenameWithTimestamp(file.name);

      // Check if file already exists
      if (existingVersions.includes(filename)) {
        throw new Error('A file with this exact name and date already exists. Please try again in a moment.');
      }

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
          accept={SUPPORTED_AUDIO_FORMATS.map((format: SupportedAudioFormat) => `audio/${format.replace('.', '')}`).join(',')}
          className="hidden"
        />

        {showSuccess ? (
          <CheckCircleIcon className="w-12 h-12 mx-auto mb-4 text-success animate-fade-in" />
        ) : (
          <CloudArrowUpIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        )}
        
        <div className="mb-4">
          <p className="text-lg mb-2">
            {showSuccess ? 'Upload successful!' : 'Drag your audio file here'}
          </p>
          {!showSuccess && (
            <>
              <p className="text-xs text-gray-400 mb-2">
                {supportedFormatsDisplay}
              </p>
              <p className="text-sm text-gray-500 mb-1">
                or
              </p>
            </>
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
