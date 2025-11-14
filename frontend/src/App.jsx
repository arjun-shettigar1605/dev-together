import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import EditorPage from "./pages/EditorPage";
import JoinRoom from "./pages/JoinRoom";
// import PreviewPage from "./pages/PreviewPage"; // 1. Import
import { Toaster } from "react-hot-toast"; // Import Toaster

function App() {
  return (
    <>
      <div>
        <Toaster
          position="top-right"
          toastOptions={{
            success: {
              theme: {
                primary: "#4aed88",
              },
            },
          }}
        ></Toaster>
      </div>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/editor/:roomId" element={<EditorPage />} />
          {/* <Route path="/preview/:roomId" element={<PreviewPage />} /> */}
        </Routes>
      </Router>
    </>
  );
}
export default App;
