import HLSPlayer from '../components/HLSPlayer';
import MaskableHLSPlayer from '../components/MaskableHLSPlayer';
import PolygonCanvas from '../components/PolygonCanvas';

import { Link, Route, Routes } from 'react-router-dom';

export function App() {
  return (
<div>
      <Routes>
        <Route
          path="/"
          element={
            <div className="p-4">
              <h1 className="text-2xl font-bold mb-4">Video as a Sensor</h1>
              <div className="space-y-2">
                <div>
                  <Link to="/stream" className="text-blue-600 hover:underline">
                    → Live Stream with Mask Drawing
                  </Link>
                </div>
                <div>
                  <Link to="/stream2" className="text-blue-600 hover:underline">
                    → Live Stream
                  </Link>
                </div>
                <div>
                  <Link to="/polygons" className="text-blue-600 hover:underline">
                    → Polygon Canvas (Standalone)
                  </Link>
                </div>
              </div>
            </div>
          }
        />
        <Route
          path="/stream"
          element={
            <div className="p-4">
              <h1 className="text-2xl font-bold mb-4">Live HLS Stream with Mask Drawing</h1>
              <MaskableHLSPlayer 
                src="http://localhost:8080/hls/mystream.m3u8"
                autoPlay={true}
                controls={true}
                className="max-w-4xl"
                onMaskChange={(maskData) => {
                  console.log('Mask updated:', maskData);
                  // You can save this to localStorage, send to API, etc.
                }}
              />
              <div className="mt-4">
                <Link to="/" className="text-blue-600 hover:underline">
                  ← Back to Home
                </Link>
              </div>
            </div>
          }
        />
        <Route
          path="/stream2"
          element={
            <div className="p-4">
              <h1 className="text-2xl font-bold mb-4">Live HLS Stream</h1>
              <HLSPlayer 
                src="http://localhost:8080/hls/mystream.m3u8"
                autoPlay={true}
                controls={true}
                className="max-w-4xl"
              />  
            </div>
          }
        />
        <Route
          path="/polygons"
          element={
            <div className="p-4">
              <h1 className="text-2xl font-bold mb-4">Polygon Canvas</h1>
              <PolygonCanvas 
                width={800}
                height={600}
                onPolygonsChange={(polygons) => {
                  console.log('Polygons updated:', polygons);
                }}
              />
              <div className="mt-4">
                <Link to="/" className="text-blue-600 hover:underline">
                  ← Back to Home
                </Link>
              </div>
            </div>
          }
        />
        <Route
          path="/page-2"
          element={
            <div>
              <Link to="/">Click here to go back to root page.</Link>
            </div>
          }
        />
      </Routes>
      {/* END: routes */}
    </div>
  );
}

export default App;
