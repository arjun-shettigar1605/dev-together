import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import ThemeToggle from "../components/ThemeToggle";
import { FaUserPlus, FaSignInAlt, FaArrowLeft } from "react-icons/fa";
import { useTheme } from "../contexts/ThemeContext";

const JoinRoom = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState("join"); // 'join' or 'create'
  const { theme } = useTheme();

  const createNewRoom = async (e) => {
    e.preventDefault();
    if (!username) {
      toast.error("Please enter a username.");
      return;
    }
    try {
      const { data } = await axios.get("http://localhost:5001/api/create-room");
      navigate(`/editor/${data.roomId}`, { state: { username } });
    } catch (err) {
      console.error("Error creating room", err);
      toast.error("Error creating room, please try again.");
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomId || !username) {
      toast.error("Please enter a room ID and a username.");
      return;
    }
    navigate(`/editor/${roomId}`, { state: { username } });
  };

  const TabButton = ({ active, onClick, children, icon: Icon }) => (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-md transition-colors ${
        active
          ? "bg-[#ffb06b] text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#1A1F2A] dark:text-gray-300 dark:hover:bg-[#2A303C]"
      }`}
    >
      <Icon />
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#fffef0] dark:bg-[#0b0f19] flex items-center justify-center text-gray-900 dark:text-white transition-colors">
      <div className="absolute top-5 left-4">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-[#f9943b] hover:text-[#ffb06b] transition-colors"
          title="Back to Home"
        >
          <FaArrowLeft />
          Home
        </Link>
      </div>
      <div className="bg-[#fffef0] dark:bg-[#1a1815] p-8 rounded-lg shadow-lg w-full max-w-md relative border border-gray-200 dark:border-[#2A303C]">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-center gap-2 mb-6 w-full">
          <img
            src={theme === "dark" ? "/LogoDark.png" : "/LogoLight.png"}
            alt="CollabCode"
            className="h-10 w-auto" // A bit larger for this page
            onError={(e) => {
              // fallback to text if image not found
              e.currentTarget.style.display = "none";
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.querySelector(".logo-fallback")) {
                const span = document.createElement("span");
                span.className =
                  "logo-fallback text-2xl font-bold text-gray-900 dark:text-white";
                span.textContent = "CollabCode";
                parent.appendChild(span);
              }
            }}
          />
        </div>

        <h1 className="flex items-center justify-center text-2xl font-bold mb-2 text-gray-900 dark:text-white">
          Start Collaborating
        </h1>

        <div className="mb-6 p-1.5 bg-gray-200 dark:bg-[#0B0F19] rounded-lg flex gap-1.5">
          <TabButton
            active={mode === "join"}
            onClick={() => setMode("join")}
            icon={FaSignInAlt}
          >
            Join Room
          </TabButton>
          <TabButton
            active={mode === "create"}
            onClick={() => setMode("create")}
            icon={FaUserPlus}
          >
            Create Room
          </TabButton>
        </div>

        {/* Form changes based on mode */}
        <form onSubmit={mode === "join" ? joinRoom : createNewRoom}>
          <div className="space-y-4">
            {mode === "join" && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter your room ID"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-[#0B0F19] border border-gray-300 dark:border-[#2A303C] rounded-md focus:outline-none focus:ring-2 focus:ring-[#f9943b]"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-[#0B0F19] border border-gray-300 dark:border-[#2A303C] rounded-md focus:outline-none focus:ring-2 focus:ring-[#f9943b]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#ffb06b] text-white py-3 rounded-md hover:bg-[#f9943b] transition duration-200"
            >
              {mode === "join" ? "Join Room" : "Create New Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinRoom;
