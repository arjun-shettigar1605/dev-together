<div align="center">
  <img src="frontend/public/LogoDark.png" alt="CoCode Logo" width="300"/>
  <h3>
    A real-time, collaborative code editor with AI-powered suggestions, secure multi-language execution, and integrated voice chat.
  </h3>
</div>

## ✨ Features

CoCode is a full-stack application designed for developers to code, collaborate, and execute in a seamless, all-in-one environment.

* ⚡ **Real-Time Collaboration:** Code with your team just like in Google Docs. See live text synchronization, user presence indicators, and shared file states.
* 🤖 **AI-Powered Suggestions:** Get intelligent, context-aware code completions from the Mistral's Codestral AI model. Simply press `Ctrl+Space` to trigger suggestions.
* 🔒 **Secure Code Execution:** Run code in 12 different languages safely inside isolated Docker containers, with strict resource and time limits.
* 🎙️ **Integrated Voice Chat:** Ditch Discord. Talk directly to your team with built-in, peer-to-peer WebRTC voice chat, complete with mute controls.
* 🖥️ **Live Web Preview:** Instantly see your HTML, CSS, and JavaScript changes rendered in a separate live preview window, updated in real-time.
* 🗂️ **Rich File Explorer:** A complete file system per room, supporting folder/file creation, deletion, and drag-and-drop moving.
* 🎨 **Light & Dark Mode:** A sleek, modern UI with a theme toggle for your comfort.

## 🖼️ Screenshots

<div style="display: flex; gap: 16px; flex-wrap: wrap;">
  <img width="1919" height="866" alt="image" src="https://github.com/user-attachments/assets/f2d72261-d6b4-47e1-9fae-ceb98396ab0e" />
  <img width="1900" height="881" alt="image" src="https://github.com/user-attachments/assets/1de711dd-2942-416a-b10f-0487b5aa8304" />  
  
</div>

## 🛠️ Tech Stack

| Area | Technology |
| :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS, Monaco Editor, Socket.io Client, Simple-Peer (WebRTC) |
| **Backend** | Node.js, Express, Socket.io, Dockerode |
| **AI** | MistralAI (Codestral Model) |
| **Execution** | Docker |

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

* Node.js (v18 or later recommended)
* npm (v8 or later)
* Docker Desktop (must be running for code execution)
* MistralAI API Key (for AI features)

### ⚙️ Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/dev-together.git](https://github.com/your-username/dev-together.git)
    cd dev-together
    ```

2.  **Set up the Backend:**
    * Navigate to the backend directory:
        ```bash
        cd backend
        ```
    * Install dependencies:
        ```bash
        npm install
        ```
    * Create an environment file:
        ```bash
        touch .env
        ```
    * Add your API key to the `.env` file:
        ```ini
        MISTRAL_API_KEY=your_mistral_api_key_here
        PORT=5001
        ```
    * Start the backend server:
        ```bash
        npm run dev
        ```
    * The server will be running on `http://localhost:5001`.

3.  **Set up the Frontend:**
    * Open a new terminal and navigate to the frontend directory:
        ```bash
        cd frontend
        ```
    * Install dependencies:
        ```bash
        npm install
        ```
    * Start the frontend development server:
        ```bash
        npm run dev
        ```
    * The application will be accessible at `http://localhost:5173`.

4.  **Verify Docker:**
    * Make sure Docker Desktop is running.
    * You can test the Docker connection with the provided test script:
        ```bash
        # From the 'backend' directory
        node test-docker.js
        ```
    * This should pull the `node:16-slim` image and print "Hello from Docker!".

## 🧑‍💻 Supported Languages

The secure execution environment supports the following languages, each running in its own container:

<p align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=java,python,js,ts,cpp,c,ruby,dart,go,php,swift" />
  </a>
</p>


*Note: HTML, CSS, and JSON are handled by the Live Preview and are not "executed" on the backend.*




