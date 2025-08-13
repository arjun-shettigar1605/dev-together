import React from 'react';
import Avatar from 'react-avatar';
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

const Client = ({ username, socketId, onMuteToggle, isMuted})=>{
    return (
      // <div className='flex items-center mb-2 border border-white-200 p-0.5 rounded-lg shadow-lg'>
      //     <Avatar name={username} size="40" round="10px"/>
      //     <span className='ml-2 font-medium'>{username}</span>

      // </div>
      <div className="flex items-center mb-3 justify-between">
        <div className="flex items-center">
          <Avatar name={username} size="40" round="10px" />
          <span className="ml-2 font-medium">{username}</span>
        </div>
        <button
          onClick={() => onMuteToggle(socketId)}
          className="text-xl text-gray-300 hover:text-white"
        >
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </button>
      </div>
    );
}

export default Client; 