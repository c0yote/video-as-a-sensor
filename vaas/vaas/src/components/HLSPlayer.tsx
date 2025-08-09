import Hls from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';

interface HLSPlayerProps {
  src: string;
  autoPlay?: boolean;
  controls?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const HLSPlayer: React.FC<HLSPlayerProps> = ({
  src,
  autoPlay = true,
  controls = true,
  width = '100%',
  height = 'auto',
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initializePlayer = () => {
      // Clean up existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      setError(null);
      setIsLoading(true);

      if (Hls.isSupported()) {
        // Use HLS.js for browsers that support MSE
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        hlsRef.current = hls;

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          if (autoPlay) {
            video.play().catch((err) => {
              console.warn('Autoplay failed:', err);
            });
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Network error occurred while loading the stream');
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Media error occurred while playing the stream');
                break;
              default:
                setError('An unknown error occurred');
                break;
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari and other browsers with native HLS support
        video.src = src;
        setIsLoading(false);
        
        if (autoPlay) {
          video.play().catch((err) => {
            console.warn('Autoplay failed:', err);
          });
        }
      } else {
        setError('HLS is not supported in this browser');
        setIsLoading(false);
      }
    };

    // Event listeners for video element
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => setError('Video playback error occurred');

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    initializePlayer();

    // Cleanup function
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    
    // Re-initialize the player
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  };

  return (
    <div className={`hls-player ${className}`}>
      <div className="relative">
        <video
          ref={videoRef}
          controls={controls}
          width={width}
          height={height}
          className="w-full h-auto bg-black"
          playsInline
          muted={autoPlay} // Mute for autoplay to work in most browsers
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-lg">Loading stream...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75">
            <div className="text-red-400 text-lg mb-4">{error}</div>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-2 text-sm text-gray-600">
        <div>Status: {isLoading ? 'Loading...' : isPlaying ? 'Playing' : 'Paused'}</div>
        <div>Stream: {src}</div>
      </div>
    </div>
  );
};

export default HLSPlayer;
