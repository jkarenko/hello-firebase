// Supported audio file extensions
export const SUPPORTED_AUDIO_FORMATS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];

// Helper function to check if a file is a supported audio file
export const isSupportedAudioFile = (filename: string): boolean => {
  return SUPPORTED_AUDIO_FORMATS.some((ext) => filename.toLowerCase().endsWith(ext));
};

// Helper function to get display name from filename
export const getDisplayName = (filename: string): string => {
  return SUPPORTED_AUDIO_FORMATS.reduce((name, ext) => name.replace(ext, ""), filename);
};