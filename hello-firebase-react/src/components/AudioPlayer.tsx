import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Select, SelectItem, Card, CardBody, Chip, Spinner } from "@nextui-org/react";
import { AudioCache } from '../utils/AudioCache';

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
        const {currentUser} = window.firebase.auth();
        if (!currentUser) {
          throw new Error('User not authenticated');
        }

        const token = await currentUser.getIdToken();
        const response = await fetch('/getSongVersions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const currentProject = result.songs.find((s: Project) => s.id === projectId);
        
        if (!currentProject) {
          throw new Error('Project not found');
        }

        setProject(currentProject);
        if (currentProject.versions.length > 0) {
          setSelectedVersion(currentProject.versions[0].filename);
        }
        await preCacheVersions(currentProject.versions);
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
      const {currentUser} = window.firebase.auth();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const token = await currentUser.getIdToken();
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

          <h1 className="text-2xl font-semibold text-center text-foreground">
            {project.name}
          </h1>

          {project.versions.length > 0 && (
            <Select
              label="Select Version"
              placeholder="Choose a version"
              selectedKeys={[selectedVersion]}
              className="max-w-md mx-auto"
              onChange={(e) => setSelectedVersion(e.target.value)}
              variant="bordered"
              size="lg"
            >
              {project.versions.map((version) => (
                <SelectItem key={version.filename} value={version.filename}>
                  {version.displayName}
                </SelectItem>
              ))}
            </Select>
          )}

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-center gap-4">
              <Button
                color="primary"
                onPress={togglePlayPause}
                isDisabled={!selectedVersion}
                size="lg"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <span className="text-sm text-foreground-500">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Progress Bar with click handling */}
            <div 
              className="w-full max-w-md mx-auto h-2 bg-default-200 dark:bg-default-100 rounded-medium cursor-pointer overflow-hidden"
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
        </div>
      </CardBody>
    </Card>
  );
};

export default AudioPlayer; 
