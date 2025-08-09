import React, { useCallback, useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Polygon {
  id: string;
  points: Point[];
  color: string;
  label?: string;
}

interface PolygonCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  onPolygonsChange?: (polygons: Polygon[]) => void;
}

export const PolygonCanvas: React.FC<PolygonCanvasProps> = ({
  width = 800,
  height = 600,
  className = '',
  onPolygonsChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [currentPolygon, setCurrentPolygon] = useState<Polygon | null>(null);

  // Generate random color for new polygons
  const generateColor = useCallback(() => {
    return `hsl(${Math.random() * 360}, 70%, 50%)`;
  }, []);

  // Redraw all polygons on canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid (optional)
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw all completed polygons
    [...polygons, currentPolygon].filter(Boolean).forEach((polygon) => {
      if (!polygon || polygon.points.length === 0) return;

      ctx.strokeStyle = polygon.color;
      ctx.fillStyle = polygon.color + '20'; // Add transparency for fill
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      // Draw polygon outline
      ctx.beginPath();
      ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
      polygon.points.slice(1).forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      
      // Close polygon if it has more than 2 points and is completed
      if (polygon.points.length > 2 && polygons.includes(polygon)) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();

      // Draw points
      polygon.points.forEach((point, index) => {
        ctx.fillStyle = polygon.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw point numbers
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), point.x, point.y + 3);
      });

      // Draw polygon label
      if (polygon.label && polygon.points.length > 0) {
        const firstPoint = polygon.points[0];
        ctx.fillStyle = polygon.color;
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(polygon.label, firstPoint.x + 10, firstPoint.y - 10);
      }

      // Draw connecting lines for current polygon in progress
      if (polygon === currentPolygon && polygon.points.length > 0) {
        ctx.strokeStyle = polygon.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
        polygon.points.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        
        // Auto-connect back to first point if we have at least 3 points
        if (polygon.points.length >= 3) {
          ctx.lineTo(polygon.points[0].x, polygon.points[0].y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [polygons, currentPolygon]);

  // Handle mouse clicks
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!currentPolygon) {
      // Start new polygon
      const newPolygon: Polygon = {
        id: `polygon_${Date.now()}`,
        points: [{ x, y }],
        color: generateColor(),
        label: `Polygon ${polygons.length + 1}`
      };
      setCurrentPolygon(newPolygon);
    } else {
      // Add point to current polygon
      setCurrentPolygon({
        ...currentPolygon,
        points: [...currentPolygon.points, { x, y }]
      });
    }
  }, [currentPolygon, polygons.length, generateColor]);

  // Handle double-click to finish polygon
  const handleCanvasDoubleClick = useCallback(() => {
    if (currentPolygon && currentPolygon.points.length >= 3) {
      setPolygons(prev => [...prev, currentPolygon]);
      setCurrentPolygon(null);
    }
  }, [currentPolygon]);

  // Handle right-click to cancel current polygon
  const handleCanvasRightClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (currentPolygon) {
      setCurrentPolygon(null);
    }
  }, [currentPolygon]);

  // Clear all polygons
  const clearAllPolygons = useCallback(() => {
    setPolygons([]);
    setCurrentPolygon(null);
  }, []);

  // Remove last polygon
  const removeLastPolygon = useCallback(() => {
    if (currentPolygon) {
      setCurrentPolygon(null);
    } else if (polygons.length > 0) {
      setPolygons(prev => prev.slice(0, -1));
    }
  }, [currentPolygon, polygons.length]);

  // Export polygons as JSON
  const exportPolygons = useCallback(() => {
    const data = {
      polygons,
      canvasDimensions: { width, height },
      timestamp: Date.now()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polygons_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [polygons, width, height]);

  // Redraw canvas when polygons change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Notify parent component when polygons change
  useEffect(() => {
    if (onPolygonsChange) {
      onPolygonsChange(polygons);
    }
  }, [polygons, onPolygonsChange]);

  return (
    <div className={`polygon-canvas ${className}`}>
      {/* Controls */}
      <div className="mb-4 p-3 bg-gray-100 rounded-lg">
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={clearAllPolygons}
            className="px-3 py-1 rounded text-sm bg-red-500 text-white hover:bg-red-600"
            disabled={polygons.length === 0 && !currentPolygon}
          >
            Clear All
          </button>
          <button
            onClick={removeLastPolygon}
            className="px-3 py-1 rounded text-sm bg-orange-500 text-white hover:bg-orange-600"
            disabled={polygons.length === 0 && !currentPolygon}
          >
            Remove Last
          </button>
          <button
            onClick={exportPolygons}
            className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700"
            disabled={polygons.length === 0}
          >
            Export JSON
          </button>
        </div>
        <div className="text-xs text-gray-600">
          <div>
            <strong>Instructions:</strong> Click to add points • Double-click to finish polygon • Right-click to cancel
          </div>
          <div className="mt-1">
            <strong>Status:</strong> {
              currentPolygon 
                ? `Drawing polygon (${currentPolygon.points.length} points)` 
                : `${polygons.length} polygons completed`
            }
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-300 cursor-crosshair bg-white"
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onContextMenu={handleCanvasRightClick}
        style={{ width: `${width}px`, height: `${height}px` }}
      />

      {/* Polygon List */}
      {polygons.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Completed Polygons:</h3>
          <div className="space-y-1">
            {polygons.map((polygon, index) => (
              <div key={polygon.id} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-4 h-4 border border-gray-300"
                  style={{ backgroundColor: polygon.color + '40' }}
                />
                <span>{polygon.label}</span>
                <span className="text-gray-500">({polygon.points.length} points)</span>
                <button
                  onClick={() => setPolygons(prev => prev.filter(p => p.id !== polygon.id))}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PolygonCanvas;
