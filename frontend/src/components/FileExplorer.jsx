// src/components/FileExplorer.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  FaFolder,
  FaFolderOpen,
  FaFileCode,
  FaTrash,
  FaFile,
  FaCss3Alt,
  FaHtml5,
  FaJsSquare,
  FaFileAlt,
  FaFileInvoice,
} from "react-icons/fa";
import { LuFilePlus2 } from "react-icons/lu";
import { TbFolderPlus } from "react-icons/tb";
import * as SiIcons from "react-icons/si";

import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const ItemTypes = {
  FILE: "file",
  FOLDER: "folder",
};
// Helper to get the correct file icon
const getFileIcon = (fileName) => {
  const extension = fileName.split(".").pop();
  if (fileName === ".env") return <FaFileInvoice className="text-gray-400" />;
  if (extension === "html") return <FaHtml5 className="text-red-500" />;
  if (extension === "css") return <FaCss3Alt className="text-blue-500" />;
  if (extension === "js") return <FaJsSquare className="text-yellow-500" />;
  if (extension === "py")
    return (
      (SiIcons.SiPython && <SiIcons.SiPython className="text-blue-400" />) ||
      <FaFileCode />
    );
  if (extension === "java")
    return (
      (SiIcons.SiJava && <SiIcons.SiJava className="text-red-400" />) ||
      <FaFileCode />
    );
  if (extension === "cpp" || extension === "c")
    return (
      (SiIcons.SiCplusplus && <SiIcons.SiCplusplus className="text-blue-600" />) ||
      <FaFileCode />
    );
  if (extension === "rb")
    return (
      (SiIcons.SiRuby && <SiIcons.SiRuby className="text-red-600" />) ||
      <FaFileCode />
    );
  if (extension === "dart")
    return (
      (SiIcons.SiDart && <SiIcons.SiDart className="text-blue-300" />) ||
      <FaFileCode />
    );
  if (extension === "json")
    return (
      (SiIcons.SiJson && <SiIcons.SiJson className="text-yellow-600" />) ||
      <FaFileCode />
    );
  if (extension === "md")
    return (
      (SiIcons.SiMarkdown && <SiIcons.SiMarkdown className="text-gray-300" />) ||
      <FaFileCode />
    );
  if (extension === "go")
    return (
      (SiIcons.SiGo && <SiIcons.SiGo className="text-cyan-400" />) ||
      <FaFileCode />
    );
  if (extension === "php")
    return (
      (SiIcons.SiPhp && <SiIcons.SiPhp className="text-purple-400" />) ||
      <FaFileCode />
    );
  if (extension === "rs")
    return (
      (SiIcons.SiRust && <SiIcons.SiRust className="text-orange-500" />) ||
      <FaFileCode />
    );
  if (extension === "swift")
    return (
      (SiIcons.SiSwift && <SiIcons.SiSwift className="text-orange-400" />) ||
      <FaFileCode />
    );
  if (extension === "ts")
    return (
      (SiIcons.SiTypescript && <SiIcons.SiTypescript className="text-blue-500" />) ||
      <FaFileCode />
    );
  if (extension === "txt") return <FaFileAlt className="text-gray-300" />;

  return <FaFileCode className="text-gray-300" />;
};

// Recursive node component
const FileNode = ({
  node,
  allFiles,
  level,
  onSelectItem,
  onSelectFile,
  selectedItemId,
  onMoveItem,
  isLastChild,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const ref = useRef(null);

  const isFolder = node.type === "folder";
  const isSelected = node.id === selectedItemId;

  const [{ isDragging }, drag] = useDrag(() => ({
    type: isFolder ? ItemTypes.FOLDER : ItemTypes.FILE,
    item: { id: node.id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.FILE, ItemTypes.FOLDER],
    drop: (item) => {
      if (item.id === node.id) return; // Don't drop on self
      // Drop *into* a folder, or *beside* a file (in its parent)
      const targetParentId = isFolder ? node.id : node.parentId;
      onMoveItem(item.id, targetParentId);
    },
    canDrop: (item) => {
      if (item.id === node.id) return false; // Don't drop on self
      const targetParentId = isFolder ? node.id : node.parentId;
      if (item.id === targetParentId) return false; // Don't drop folder into self

      // Robust check: Prevent dropping a folder into its own child
      let currentParentId = targetParentId;
      while (currentParentId) {
        if (currentParentId === item.id) return false; // Found dragged item in hierarchy
        const parentNode = allFiles[currentParentId];
        currentParentId = parentNode ? parentNode.parentId : null;
      }
      return true;
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  drag(drop(ref));

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelectItem(node.id); // Always select the item
    if (!isFolder) {
      onSelectFile(node.id); // If it's a file, also open it
    }
  };

  const handleToggleFolder = (e) => {
    e.stopPropagation();
    if (isFolder) {
      setIsOpen(!isOpen);
    }
  };

  const children = (node.children || [])
    .map((id) => allFiles[id])
    .filter(Boolean)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1; // Folders first
      return a.name.localeCompare(b.name); // Then alphabetical
    });

  return (
    <div
      ref={ref}
      className={`tree-node ${isLastChild ? "tree-node-last" : ""} opacity-${
        isDragging ? 50 : 100
      }`}
      style={{ paddingLeft: `${level * 16}px` }}
    >
      {/* Tree lines (level is used for positioning) */}
      <div
        className="tree-node-line"
        style={{ left: `${level * 16 + 8}px` }}
      ></div>
      <div
        className="tree-node-joint"
        style={{ left: `${level * 16 + 8}px` }}
      ></div>

      <div
        className={`relative flex items-center justify-between group cursor-pointer rounded ${
          isOver && canDrop ? "bg-blue-500/20" : "" // Drop highlight
        }`}
        style={{ paddingLeft: `${level * 16 + 16}px` }} // Indent content
        onClick={handleSelect} // Select on the whole row
      >
        {/* Highlight div (now has padding) */}
        <div
          className={`absolute inset-y-0 left-0 right-0 -ml-1 pr-1 rounded ${
            isSelected ? "border border-orange-400/50 bg-orange-400/10" : ""
          }`}
          style={{ left: `${level * 16 + 16}px` }} // Match content padding
        ></div>

        {/* Content (relative to position) */}
        <div className="relative flex items-center gap-1.5 flex-1 z-10">
          <span className="w-4 flex-shrink-0" onClick={handleToggleFolder}>
            {isFolder ? (
              isOpen ? (
                <FaFolderOpen className="text-blue-400" />
              ) : (
                <FaFolder className="text-blue-400" />
              )
            ) : (
              getFileIcon(node.name)
            )}
          </span>
          <span className={`truncate py-1.5 ${isFolder ? "font-medium" : ""}`}>
            {node.name}
          </span>
        </div>
      </div>

      {/* Recursive rendering for children */}
      {isFolder && isOpen && (
        <div className="pl-4">
          {children.map((childNode, index) => (
            <FileNode
              key={childNode.id}
              node={childNode}
              allFiles={allFiles}
              level={0} // CSS tree handles nesting, so level is 0
              onSelectItem={onSelectItem}
              onSelectFile={onSelectFile}
              selectedItemId={selectedItemId}
              onMoveItem={onMoveItem}
              isLastChild={index === children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main component
const FileExplorer = ({
  files,
  onSelectFile,
  activeFileId,
  onCreateItem,
  onDeleteItem,
  onMoveItem,
}) => {
  const [showInput, setShowInput] = useState(null); // { type }
  const [inputValue, setInputValue] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(null);

  const rootNode = Object.values(files).find((node) => node.parentId === null);

  // Keyboard delete listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Delete" && selectedItemId) {
        // Don't delete root
        if (files[selectedItemId] && files[selectedItemId].parentId !== null) {
          handleDelete(selectedItemId, files[selectedItemId].name);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedItemId, files, onDeleteItem]);

  const handleShowCreate = (type) => {
    setShowInput({ type });
    setInputValue("");
  };

  const handleCreate = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      let parentId;
      if (selectedItemId && files[selectedItemId]?.type === "folder") {
        parentId = selectedItemId; // Create in selected folder
      } else if (selectedItemId && files[selectedItemId]?.type === "file") {
        parentId = files[selectedItemId].parentId; // Create in same folder as selected file
      } else {
        parentId = rootNode.id; // Create in root
      }

      onCreateItem(inputValue, showInput.type, parentId);
      setShowInput(null);
      setInputValue("");
    }
    if (e.key === "Escape") {
      setShowInput(null);
      setInputValue("");
    }
  };

  const handleDelete = (itemId, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      onDeleteItem(itemId);
      if (selectedItemId === itemId) {
        setSelectedItemId(null); // Deselect
      }
    }
  };

  // Add root drop target
  const [{ isOverRoot, canDropRoot }, dropRoot] = useDrop(() => ({
    accept: [ItemTypes.FILE, ItemTypes.FOLDER],
    drop: (item) => {
      if (rootNode) {
        onMoveItem(item.id, rootNode.id); // Move to root
      }
    },
    canDrop: (item) => {
      if (!rootNode) return false;
      const itemNode = files[item.id];
      // Can't drop if already in root
      if (itemNode && itemNode.parentId === rootNode.id) return false;
      return true;
    },
    collect: (monitor) => ({
      isOverRoot: !!monitor.isOver(),
      canDropRoot: monitor.canDrop(),
    }),
  }));

  if (!rootNode) {
    return (
      <div className="p-2 text-xs text-gray-500">Loading file tree...</div>
    );
  }

  const renderRootChildren = (rootNode.children || [])
    .map((id) => files[id])
    .filter(Boolean)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1; // Folders first
      return a.name.localeCompare(b.name); // Then alphabetical
    });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            Explorer
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleShowCreate("file")}
              className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
              title="New File"
            >
              <LuFilePlus2 />
            </button>
            <button
              onClick={() => handleShowCreate("folder")}
              className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
              title="New Folder"
            >
              <TbFolderPlus />
            </button>
          </div>
        </div>
      </div>

      {/* Input field for creating new file/folder */}
      {showInput && (
        <div className="p-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleCreate}
            onBlur={() => setShowInput(null)}
            placeholder={
              showInput.type === "file" ? "filename.ext" : "folder_name"
            }
            className="w-full px-2 py-1 bg-white dark:bg-[#1e1e1e] border border-blue-500 rounded text-xs focus:outline-none"
            autoFocus
          />
        </div>
      )}

      <div
        ref={dropRoot}
        className={`flex-1 overflow-y-auto p-2 min-h-0 ${
          isOverRoot && canDropRoot ? "bg-blue-500/20" : ""
        }`}
      >
        {renderRootChildren.map((node, index) => (
          <FileNode
            key={node.id}
            node={node}
            allFiles={files}
            level={0} // CSS tree handles nesting
            onSelectItem={setSelectedItemId}
            onSelectFile={onSelectFile}
            selectedItemId={selectedItemId}
            onMoveItem={onMoveItem}
            isLastChild={index === renderRootChildren.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

// Wrap the main component with DndProvider
const FileExplorerWrapper = (props) => (
  <DndProvider backend={HTML5Backend}>
    <FileExplorer {...props} />
  </DndProvider>
);

export default FileExplorerWrapper;
