import HLSPlayer from '../components/HLSPlayer';

import { Link, Route, Routes } from 'react-router-dom';

export function App() {
  return (
<div>
      <Routes>
        <Route
          path="/"
          element={
            <div>
              This is the generated root route.{' '}
              <Link to="/stream">Click here to view the live stream.</Link>
            </div>
          }
        />
        <Route
          path="/stream"
          element={
            <div className="p-4">
              <h1 className="text-2xl font-bold mb-4">Live HLS Stream</h1>
              <HLSPlayer 
                src="http://localhost:8080/hls/mystream.m3u8"
                autoPlay={false}
                controls={true}
                className="max-w-4xl"
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
