import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Select, SelectItem, Card, CardBody, Chip, Spinner } from "@nextui-org/react";
import { PlayCircleIcon, PauseCircleIcon } from '@heroicons/react/24/solid';
import { AudioCache } from '../utils/AudioCache';
import FileUpload from './FileUpload';
import ShareProject from './ShareProject';
import { getFirebaseAuth, getFirebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { getDisplayName } from '../utils/audio';

interface Version {
  filename: string;
  displayName: string;
}

interface Project {
  id: string;
  name: string;
  versions: Version[];
}

interface AudioPlayerProps {
  projectId: string;
  onBack: () => void;
}

interface GetProjectResponse {
  id: string;
  name: string;
  versions: Version[];
}

const AudioPlayer = ({ projectId, onBack }: AudioPlayerProps) => {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioContext = useRef<AudioContext | null>(null);
  const sourceNode = useRef<AudioBufferSourceNode | null>(null);
  const audioBuffer = useRef<AudioBuffer | null>(null);
  const startTime = useRef<number>(0);
  const offset = useRef<number>(0);
  const memoryCache = useRef<Map<string, AudioBuffer>>(new Map());
  const updateInterval = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize AudioContext and AudioCache
  useEffect(() => {
    try {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      AudioCache.init().catch(error => {
        console.error('Failed to initialize AudioCache:', error);
      });
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      setError('Your browser does not support audio playback');
    }

    return () => {
      // Cleanup audio resources
      if (updateInterval.current) {
        window.clearInterval(updateInterval.current);
      }
      sourceNode.current?.stop();
      sourceNode.current?.disconnect();
      audioContext.current?.close();
    };
  }, []);

  // Pre-cache all versions
  const preCacheVersions = useCallback(async (versions: Version[]) => {
    console.info('Starting pre-cache', { versionCount: versions.length });
    const loadingPromises = versions.map(async version => {
      try {
        if (!memoryCache.current.has(version.filename)) {
          await loadAudio(version.filename);
          console.debug('Pre-cached version', { version: version.displayName });
        }
      } catch (error) {
        console.error('Error pre-caching version', error, { version: version.displayName });
      }
    });

    await Promise.all(loadingPromises);
    console.info('Pre-cache complete', { cachedVersions: memoryCache.current.size });
  }, []);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        const auth = getFirebaseAuth();
        if (!auth.currentUser) {
          throw new Error('User not authenticated');
        }

        const functions = getFirebaseFunctions();
        const getProjectFn = httpsCallable<{projectId: string}, GetProjectResponse>(functions, 'getProject');
        const result = await getProjectFn({ projectId });
        
        setProject(result.data);
        if (result.data.versions.length > 0) {
          setSelectedVersion(result.data.versions[0].filename);
        }
        await preCacheVersions(result.data.versions);
      } catch (err) {
        console.error('Error loading project:', err);
        setError('Failed to load project. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, preCacheVersions]);

  const loadAudio = useCallback(async (filename: string): Promise<AudioBuffer> => {
    if (!audioContext.current) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Check memory cache first
      if (memoryCache.current.has(filename)) {
        console.debug('Using memory-cached audio', { filename });
        const buffer = memoryCache.current.get(filename)!;
        setDuration(buffer.duration);
        return buffer;
      }

      // Get audio URL from Firebase function
      const auth = getFirebaseAuth();
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/getAudioUrl?filename=${encodeURIComponent(filename)}&projectId=${encodeURIComponent(projectId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { url, etag: serverETag } = await response.json();

      // Check IndexedDB cache
      const cachedETag = await AudioCache.getETag(filename);
      if (cachedETag && serverETag === cachedETag) {
        const cachedBuffer = await AudioCache.get(filename);
        if (cachedBuffer) {
          console.debug('Using cached audio (ETag match)', { filename });
          const buffer = await audioContext.current.decodeAudioData(cachedBuffer);
          memoryCache.current.set(filename, buffer);
          setDuration(buffer.duration);
          return buffer;
        }
      }

      const audioResponse = await fetch(url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }

      const arrayBuffer = await audioResponse.arrayBuffer();
      
      // Cache the raw array buffer and ETag
      if (serverETag) {
        await AudioCache.set(filename, arrayBuffer, serverETag);
      }
      
      const buffer = await audioContext.current.decodeAudioData(arrayBuffer);
      memoryCache.current.set(filename, buffer);
      setDuration(buffer.duration);
      return buffer;
    } catch (err) {
      console.error('Error loading audio:', err);
      setError('Failed to load audio. Please try again.');
      throw err;
    }
  }, [projectId]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentTime = useCallback(() => {
    if (!audioBuffer.current) {
      return 0;
    }
    if (isPlaying) {
      return audioContext.current!.currentTime - startTime.current;
    }
    return offset.current;
  }, [isPlaying]);

  const stopAudio = useCallback(() => {
    if (sourceNode.current) {
      try {
        sourceNode.current.stop();
      } catch (error) {
        // Ignore errors from stopping already stopped nodes
      }
      sourceNode.current.disconnect();
      sourceNode.current = null;
    }
    
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    offset.current = getCurrentTime();
    setIsPlaying(false);
  }, [getCurrentTime]);

  const updateDisplay = useCallback(() => {
    if (!audioBuffer.current) {
      return;
    }

    const currentTime = getCurrentTime();
    const {duration} = audioBuffer.current;
    
    // Update both time and progress through state
    setCurrentTime(currentTime);

    if (currentTime >= duration) {
      console.log('Playback complete');
      stopAudio();
      offset.current = 0;
      setCurrentTime(0);
      return;
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateDisplay);
    }
  }, [getCurrentTime, isPlaying, stopAudio]);

  // Remove getCurrentDisplayTime since we're not throttling updates anymore

  const playAudio = useCallback((startFrom: number = 0) => {
    if (!audioContext.current || !audioBuffer.current) {
      console.warn('Attempted to play with no audio buffer');
      return;
    }

    console.log('Playing audio', { startFrom });

    // Stop any currently playing audio
    stopAudio();

    // Create and configure new source node
    sourceNode.current = audioContext.current.createBufferSource();
    sourceNode.current.buffer = audioBuffer.current;
    sourceNode.current.connect(audioContext.current.destination);

    offset.current = startFrom;
    startTime.current = audioContext.current.currentTime - offset.current;
    sourceNode.current.start(0, offset.current);
    setIsPlaying(true);

    // Start the display update loop
    requestAnimationFrame(updateDisplay);
  }, [stopAudio, updateDisplay]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioBuffer.current) {
      console.warn('Seek attempted with no audio buffer');
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = ratio * audioBuffer.current.duration;
    
    console.log('Seeking', { 
      fromTime: getCurrentTime(),
      toTime: newTime,
      ratio 
    });
    
    if (isPlaying) {
      stopAudio();
      playAudio(newTime);
    } else {
      offset.current = newTime;
      setCurrentTime(newTime);
      updateDisplay();
    }
  }, [getCurrentTime, isPlaying, playAudio, stopAudio, updateDisplay]);

  const switchVersion = useCallback(async (keepPlaying = true) => {
    const currentTime = getCurrentTime();
    const wasPlaying = isPlaying;
    
    console.log('Switching version', { 
      version: selectedVersion,
      currentTime,
      wasPlaying,
      keepPlaying
    });
    
    if (isPlaying) {
      stopAudio();
    }
    
    try {
      // Use cached version if available
      const buffer = await loadAudio(selectedVersion);
      audioBuffer.current = buffer;
      if (wasPlaying && keepPlaying) {
        playAudio(currentTime);
      } else {
        offset.current = currentTime;
        setCurrentTime(currentTime);
        updateDisplay();
      }
      console.debug('Version switch complete', { version: selectedVersion });
    } catch (error) {
      console.error('Error switching version:', error);
    }
  }, [getCurrentTime, isPlaying, loadAudio, playAudio, selectedVersion, stopAudio, updateDisplay]);

  // Handle version change
  useEffect(() => {
    if (selectedVersion) {
      switchVersion(true);
    }
  }, [selectedVersion, switchVersion]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio(offset.current);
    }
  }, [isPlaying, playAudio, stopAudio]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleUploadComplete = useCallback(async () => {
    // Reload project data to get new versions
    try {
      const auth = getFirebaseAuth();
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      const functions = getFirebaseFunctions();
      const getProjectFn = httpsCallable<{projectId: string}, GetProjectResponse>(functions, 'getProject');
      const result = await getProjectFn({ projectId });
      
      setProject(result.data);
      if (result.data.versions.length > 0) {
        setSelectedVersion(result.data.versions[0].filename);
      }
      await preCacheVersions(result.data.versions);
    } catch (err) {
      console.error('Error reloading project:', err);
      setError('Failed to reload project data. Please refresh the page.');
    }
  }, [projectId, preCacheVersions]);

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardBody className="p-8">
          <div className="flex flex-col gap-8">
            <div className="text-left">
              <Button
                variant="light"
                color="primary"
                onPress={onBack}
                className="px-0 -ml-2"
              >
                ← Back to Projects
              </Button>
            </div>
            <div className="flex justify-center items-center">
              <Spinner label="Loading Audio Player..." color="primary" />
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardBody className="p-8">
          <div className="flex flex-col gap-8">
            <div className="text-left">
              <Button
                variant="light"
                color="primary"
                onPress={onBack}
                className="px-0 -ml-2"
              >
                ← Back to Projects
              </Button>
            </div>
            <Chip
              color="danger"
              variant="flat"
              className="w-full"
            >
              {error}
            </Chip>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardBody className="p-8">
          <div className="flex flex-col gap-8">
            <div className="text-left">
              <Button
                variant="light"
                color="primary"
                onPress={onBack}
                className="px-0 -ml-2"
              >
                ← Back to Projects
              </Button>
            </div>
            <Chip
              color="danger"
              variant="flat"
              className="w-full"
            >
              Project not found
            </Chip>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardBody className="flex flex-col gap-8 p-8">
        {/* Header section with back button and share button */}
        <div className="flex justify-between items-center">
          <Button
            variant="light"
            color="primary"
            onPress={onBack}
            className="w-fit"
            startContent={<span>‹</span>}
          >
            Back to projects
          </Button>
          {project && (
            <ShareProject projectId={projectId} projectName={project.name} />
          )}
        </div>

        {/* Project title */}
        <h1 className="text-4xl font-normal text-left text-foreground">
          {project?.name}
        </h1>

        {/* Version selector */}
        {project.versions.length > 0 && (
          <Select
            label="Version"
            placeholder="Select a version"
            selectedKeys={selectedVersion ? [selectedVersion] : []}
            onChange={(e) => setSelectedVersion(e.target.value)}
          >
            {project.versions.map((version) => (
              <SelectItem key={version.filename} value={version.filename}>
                {getDisplayName(version.filename)}
              </SelectItem>
            ))}
          </Select>
        )}

        {/* Player controls */}
        <div className="flex items-center gap-6">
          <Button
            color="primary"
            onPress={togglePlayPause}
            isDisabled={!selectedVersion}
            size="lg"
            isIconOnly
            radius="full"
            className="w-16 h-16 min-w-[64px] p-0"
          >
            {isPlaying ? 
              <PauseCircleIcon className="w-16 h-16 text-white" /> : 
              <PlayCircleIcon className="w-16 h-16 text-white" />
            }
          </Button>

          <div className="flex-1 flex flex-col gap-2">
            <div className="flex justify-between text-base">
              <span className="text-foreground-500">{formatTime(currentTime)}</span>
              <span className="text-foreground-500">{formatTime(duration)}</span>
            </div>

            <div 
              className="w-full h-2 bg-default-200 dark:bg-default-100 rounded-full cursor-pointer overflow-hidden"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-primary transition-[width] duration-100"
                style={{ 
                  width: `${(currentTime / duration) * 100 || 0}%`,
                  transition: isPlaying ? 'none' : 'width 0.1s linear'
                }}
              />
            </div>
          </div>
        </div>

        {/* File Upload */}
        <FileUpload 
          projectId={projectId} 
          onUploadComplete={handleUploadComplete} 
          existingVersions={project?.versions.map(v => v.filename) || []}
        />

        {error && (
          <Chip
            color="danger"
            variant="flat"
            className="w-full"
          >
            {error}
          </Chip>
        )}

        {loading && (
          <div className="flex justify-center">
            <Spinner color="primary" />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default AudioPlayer; 
