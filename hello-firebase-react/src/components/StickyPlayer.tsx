import { Button } from "@nextui-org/react";
import { PlayCircleIcon, PauseCircleIcon } from '@heroicons/react/24/solid';

interface StickyPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  isDisabled?: boolean;
}

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const StickyPlayer = ({ 
  isPlaying, 
  currentTime, 
  duration, 
  onPlayPause, 
  onProgressClick,
  isDisabled = false 
}: StickyPlayerProps) => {
  return (
    <div className="flex items-center flex-1 min-w-100 mr-auto w-auto">
      <Button
        color="primary"
        onPress={onPlayPause}
        isDisabled={isDisabled}
        size="sm"
        isIconOnly
        radius="full"
        className="w-8 h-8 min-w-[32px] p-0 bg-transparent hover:bg-primary/10 shrink-0"
      >
        {isPlaying ? 
          <PauseCircleIcon className="w-8 h-8 text-primary" /> : 
          <PlayCircleIcon className="w-8 h-8 text-primary" />
        }
      </Button>

      <div className="flex-1 flex flex-col gap-1 min-w-[120px] sm:min-w-[160px] overflow-hidden">
        <div className="flex justify-between text-xs">
          <span className="text-foreground-500">{formatTime(currentTime)}</span>
          <span className="text-foreground-500">{formatTime(duration)}</span>
        </div>

        <div 
          className="w-full h-1 bg-background-progressbar rounded-full cursor-pointer overflow-hidden"
          onClick={onProgressClick}
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
  );
};

export default StickyPlayer; 
