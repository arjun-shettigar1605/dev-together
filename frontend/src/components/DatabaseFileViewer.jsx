
import React from "react";
import { FaDatabase } from "react-icons/fa";

const DatabaseFileViewer = ({ files, activeFileId, onSelectFile }) => {
  // Find the single database file (should be main.sql)
  const dbFile = Object.values(files).find((f) => f.type === "file");

  if (!dbFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-gray-200 dark:border-[#1e1e1e]">
          <h2 className="text-[0.85rem] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Query Editor
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Loading database file...
          </p>
        </div>
      </div>
    );
  }

  const isSelected = dbFile.id === activeFileId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
        <h2 className="text-[0.85rem] font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Query Editor
        </h2>
      </div>

      {/* File Item */}
      <div className="flex-1 overflow-y-auto p-3">
        <div
          onClick={() => onSelectFile(dbFile.id)}
          className={`flex items-center gap-2 p-2.5 rounded cursor-pointer transition-colors ${
            isSelected
              ? "bg-orange-100 dark:bg-orange-900/50 border border-orange-400/50"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <FaDatabase className="text-cyan-600 dark:text-cyan-400 text-lg" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {dbFile.name}
          </span>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <span className="text-lg">💡</span>
            <div>
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">
                Shared Query Editor
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-400">
                All users can execute queries on the same database. Changes are
                visible to everyone in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseFileViewer;
