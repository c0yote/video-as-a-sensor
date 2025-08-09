import Hls from 'hls.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: string;
  type: 'rectangle' | 'polygon' | 'circle';
  points: Point[];
  color: string;
  label?: string;
}

interface MaskData {
  shapes: Shape[];
  videoDimensions: {
    width: number;
    height: number;
  };
  timestamp: number;
}

interface MaskableHLSPlayerProps {
  src: string;
  autoPlay?: boolean;
  controls?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
  onMaskChange?: (maskData: MaskData) => void;
}

export const MaskableHLSPlayer: React.FC<MaskableHLSPlayerProps> = ({
  src,
  autoPlay = true,
  controls = true,
  width = '100%',
  height = 'auto',
  className = '',
  onMaskChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'rectangle' | 'polygon' | 'circle'>('rectangle');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initializePlayer = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      setError(null);
      setIsLoading(true);

      if (Hls.isSupported()) {
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

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => setError('Video playback error occurred');
    const handleLoadedMetadata = () => {
      setVideoDimensions({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    initializePlayer();

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay]);

  // Update canvas size when video dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const container = containerRef.current;
    
    if (!canvas || !video || !container) return;

    const updateCanvasSize = () => {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      redrawShapes();
    };

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);
    
    // Initial size update
    setTimeout(updateCanvasSize, 100);

    return () => {
      resizeObserver.disconnect();
    };
  }, [videoDimensions]);

  // Convert canvas coordinates to video coordinates
  const canvasToVideoCoords = useCallback((canvasX: number, canvasY: number): Point => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return { x: canvasX, y: canvasY };

    const canvasRect = canvas.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;
    
    return {
      x: (canvasX - canvasRect.left + videoRect.left) * scaleX,
      y: (canvasY - canvasRect.top + videoRect.top) * scaleY
    };
  }, []);

  // Convert video coordinates to canvas coordinates
  const videoToCanvasCoords = useCallback((videoX: number, videoY: number): Point => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return { x: videoX, y: videoY };

    const canvasRect = canvas.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    
    const scaleX = videoRect.width / video.videoWidth;
    const scaleY = videoRect.height / video.videoHeight;
    
    return {
      x: videoX * scaleX,
      y: videoY * scaleY
    };
  }, []);

  // Drawing functions
  const redrawShapes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all completed shapes
    [...shapes, currentShape].filter(Boolean).forEach((shape) => {
      if (!shape || shape.points.length === 0) return;

      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      const canvasPoints = shape.points.map(p => videoToCanvasCoords(p.x, p.y));

      ctx.beginPath();

      if (shape.type === 'rectangle' && canvasPoints.length >= 2) {
        const [start, end] = canvasPoints;
        const width = end.x - start.x;
        const height = end.y - start.y;
        ctx.rect(start.x, start.y, width, height);
      } else if (shape.type === 'circle' && canvasPoints.length >= 2) {
        const [center, edge] = canvasPoints;
        const radius = Math.sqrt(
          Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
        );
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
      } else if (shape.type === 'polygon') {
        if (canvasPoints.length > 0) {
          ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
          canvasPoints.slice(1).forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          if (canvasPoints.length > 2) {
            ctx.closePath();
          }
        }
      }

      ctx.stroke();

      // Draw points
      canvasPoints.forEach((point, index) => {
        ctx.fillStyle = shape.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Label first point
        if (index === 0) {
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.fillText(shape.label || shape.id.slice(0, 6), point.x + 8, point.y - 8);
        }
      });

      ctx.setLineDash([]);
    });
  }, [shapes, currentShape, videoToCanvasCoords]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLoading || error) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasX = e.clientX;
    const canvasY = e.clientY;
    const videoCoords = canvasToVideoCoords(canvasX, canvasY);

    if (currentTool === 'polygon') {
      if (!currentShape) {
        // Start new polygon
        const newShape: Shape = {
          id: `shape_${Date.now()}`,
          type: 'polygon',
          points: [videoCoords],
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
          label: `Polygon ${shapes.length + 1}`
        };
        setCurrentShape(newShape);
      } else {
        // Add point to current polygon
        setCurrentShape({
          ...currentShape,
          points: [...currentShape.points, videoCoords]
        });
      }
    } else {
      // Start new rectangle or circle
      const newShape: Shape = {
        id: `shape_${Date.now()}`,
        type: currentTool,
        points: [videoCoords],
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        label: `${currentTool} ${shapes.length + 1}`
      };
      setCurrentShape(newShape);
      setIsDrawing(true);
    }
  }, [isLoading, error, currentTool, currentShape, shapes.length, canvasToVideoCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentShape || currentTool === 'polygon') return;

    const canvasX = e.clientX;
    const canvasY = e.clientY;
    const videoCoords = canvasToVideoCoords(canvasX, canvasY);

    setCurrentShape({
      ...currentShape,
      points: [currentShape.points[0], videoCoords]
    });
  }, [isDrawing, currentShape, currentTool, canvasToVideoCoords]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentShape && currentTool !== 'polygon') {
      setShapes(prev => [...prev, currentShape]);
      setCurrentShape(null);
      setIsDrawing(false);
    }
  }, [isDrawing, currentShape, currentTool]);

  const handleDoubleClick = useCallback(() => {
    if (currentTool === 'polygon' && currentShape) {
      // Finish polygon on double-click
      setShapes(prev => [...prev, currentShape]);
      setCurrentShape(null);
    }
  }, [currentTool, currentShape]);

  // Update mask data when shapes change
  useEffect(() => {
    if (onMaskChange && videoDimensions.width > 0) {
      const maskData: MaskData = {
        shapes,
        videoDimensions,
        timestamp: Date.now()
      };
      onMaskChange(maskData);
    }
  }, [shapes, videoDimensions, onMaskChange]);

  // Redraw when shapes change
  useEffect(() => {
    redrawShapes();
  }, [redrawShapes]);

  const clearShapes = () => {
    setShapes([]);
    setCurrentShape(null);
  };

  const exportMask = () => {
    const maskData: MaskData = {
      shapes,
      videoDimensions,
      timestamp: Date.now()
    };
    
    const blob = new Blob([JSON.stringify(maskData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mask_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  };

  return (
    <div className={`maskable-hls-player ${className}`}>
      {/* Drawing Tools */}
      <div className="mb-4 p-3 bg-gray-100 rounded-lg">
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => setCurrentTool('rectangle')}
            className={`px-3 py-1 rounded text-sm ${
              currentTool === 'rectangle' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Rectangle
          </button>
          <button
            onClick={() => setCurrentTool('circle')}
            className={`px-3 py-1 rounded text-sm ${
              currentTool === 'circle' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Circle
          </button>
          <button
            onClick={() => setCurrentTool('polygon')}
            className={`px-3 py-1 rounded text-sm ${
              currentTool === 'polygon' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Polygon
          </button>
          <button
            onClick={clearShapes}
            className="px-3 py-1 rounded text-sm bg-red-500 text-white hover:bg-red-600"
          >
            Clear All
          </button>
          <button
            onClick={exportMask}
            className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700"
          >
            Export Mask
          </button>
        </div>
        <div className="text-xs text-gray-600">
          {currentTool === 'polygon' 
            ? 'Click to add points, double-click to finish' 
            : 'Click and drag to draw'
          } • Shapes: {shapes.length}
        </div>
      </div>

      {/* Video Container */}
      <div ref={containerRef} className="relative inline-block">
        <video
          ref={videoRef}
          controls={controls}
          width={width}
          height={height}
          className="w-full h-auto bg-black"
          playsInline
          muted={autoPlay}
        />
        
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-auto cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
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
        <div>Video: {videoDimensions.width}×{videoDimensions.height}</div>
      </div>
    </div>
  );
};

export default MaskableHLSPlayer;
