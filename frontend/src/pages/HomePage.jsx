import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const HomePage = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState(""); // Add username state

  const createNewRoom = async (e) => {
    e.preventDefault();
    if (!username) {
      alert("Please enter a username.");
      return;
    }
    try {
      const response = await axios.get("http://localhost:5001/api/create-room");
      const { roomId: newRoomId } = response.data;
      // Pass username in navigation state
      navigate(`/editor/${newRoomId}`, { state: { username } });
    } catch (err) {
      console.error("Error creating room", err);
    }
  };

  const joinRoom = () => {
    if (!roomId || !username) {
      alert("Please enter a room ID and a username.");
      return;
    }
    // Pass username in navigation state
    navigate(`/editor/${roomId}`, { state: { username } });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Collaborative Code Editor
        </h1>
        <div className="space-y-4">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter Room ID"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter Username"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={joinRoom}
            className="w-full bg-blue-600 py-2 rounded-md hover:bg-blue-700 transition duration-200"
          >
            Join Room
          </button>
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink mx-4 text-gray-400">OR</span>
            <div className="flex-grow border-t border-gray-600"></div>
          </div>
          <a
            href="#"
            onClick={createNewRoom}
            className="block w-full text-center bg-green-600 py-2 rounded-md hover:bg-green-700 transition duration-200"
          >
            Create a new room
          </a>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
