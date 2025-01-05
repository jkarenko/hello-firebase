// Supported audio file extensions
export const SUPPORTED_AUDIO_FORMATS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"] as const;

export type SupportedAudioFormat = (typeof SUPPORTED_AUDIO_FORMATS)[number];

// Helper function to check if a file is a supported audio file
export const isSupportedAudioFile = (filename: string): boolean => {
  return SUPPORTED_AUDIO_FORMATS.some((ext: SupportedAudioFormat) => filename.toLowerCase().endsWith(ext));
};

// Helper function to check if a string is a timestamp (13-digit number)
const isTimestamp = (str: string): boolean => {
  return /^\d{13}$/.test(str);
};

// Helper function to format timestamp to readable date
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  // Get ISO string (format: "2024-01-23T14:00:00.000Z")
  // Take first 16 characters ("2024-01-23T14:00") and replace T with space
  return date.toISOString().slice(0, 16).replace("T", " ");
};

// Helper function to get display name from filename
export const getDisplayName = (filename: string): string => {
  // First remove the extension
  const nameWithoutExt = SUPPORTED_AUDIO_FORMATS.reduce((name, ext) => name.replace(ext, ""), filename);

  // Split by underscore
  const parts = nameWithoutExt.split("_");

  // Check if the first part is a timestamp
  if (parts.length > 1 && isTimestamp(parts[0])) {
    // Get the original name (everything after the timestamp)
    const originalName = parts.slice(1).join("_");
    // Format the timestamp
    const timestamp = formatTimestamp(parseInt(parts[0]));
    return `${originalName} (${timestamp})`;
  }

  // If no timestamp found, return the name without extension
  return nameWithoutExt;
};
