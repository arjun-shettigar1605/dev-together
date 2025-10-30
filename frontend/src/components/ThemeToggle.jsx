import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import { FaSun, FaMoon } from "react-icons/fa";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-14 items-center rounded-full p-1 transition-colors ${
        theme === "light"
          ? "bg-gray-200 dark:bg-gray-200"
          : "bg-gray-700 dark:bg-gray-700"
      }`}
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {/* Toggle Circle */}
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform flex items-center justify-center ${
          theme === "light" ? "translate-x-6" : "translate-x-0"
        }`}
      >
        {/* Icon inside the circle */}
        {theme === "light" ? (
          <FaSun className="text-yellow-500 text-xs" />
        ) : (
          <FaMoon className="text-blue-400 text-xs" />
        )}
      </span>

      {/* Background icon (opposite of the circle icon) */}
      <span
        className={`absolute transition-opacity ${
          theme === "light" ? "left-2" : "right-2"
        }`}
      >
        {theme === "light" ? (
          <FaMoon className="text-gray-400 text-xs" />
        ) : (
          <FaSun className="text-gray-400 text-xs" />
        )}
      </span>
    </button>
  );
};

export default ThemeToggle;
