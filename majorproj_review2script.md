###### system architecture:

1. Frontend:
   The React app runs in the user’s browser.
   It handles everything the user does — like typing code or running the code.
2. Backend:
   The Node.js server manages users sessions and real-time collaboration.
   When code needs to be executed, it sends it to Docker, which runs it safely in isolated containers.
3. External Service (Google Cloud):
   When AI help is needed, the backend sends code to the Gemini API, which returns suggestions for the user.



###### class diagram:

* The main component in the frontend is the CodeEditor, which uses three key services to get its work done: one for real-time communication (SocketService), one for standard requests like executing code (ApiService), and one for the voice chat (WebRTCService).
* The Backend is the brain of the system. A SessionManager creates and maintains all the session. The most critical part here is the DockerService. This is what lets us securely run the code in isolated, safe sandboxes called containers.
* These two sides talk to each other constantly.



###### Use-case diagram:

* This diagram shows what a Developer can do in our system.
* Their main goal is to Collaborate on Code. To do this, they obviously need to be in a session.
* While collaborating, they can Execute Code, and they also have the option to use Voice Chat or Get AI Assistance.
* As you can see, the AI Assistance is the only feature that uses an external service



###### Sequence diagram-1:

* Developer A and B are in a same session.
* First, when Developer A types, their browser sends only the tiny change, instead of the whole file, to the server over a websocket connection.
* Next, the server gets the change and immediately broadcasts to everyone else in the room.
* Finally, Developer B receives the change instantly.



###### Sequence diagram-2:

* This diagram explains how our AI suggestion feature works.
* First, when the Developer hits Ctrl+Space, the browser sends the nearby code context to our server.
* Our server then asks the external Google Gemini API for a suggestion.
* Finally, the AI sends the suggestion back through our server to the browser.
