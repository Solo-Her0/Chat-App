## About This Project
- **Chat Application**
- **Course Name:** COSC 2327 Introduction to Computer Networks.
- **Instructor Name:** Professor Kubra Kose
- **Project Option Chosen:** Project 1 Option A
- **IDE/Environment Used:** VSCodium & Github Desktop App
- **Submission Deadline:** December 4th 2025

This is my chat application project for SHSU COSC 2327 Introduction to Computer Networks. I am building a demo of a fully functional real-time chat app using Node.js, Express, and Socket.IO.

## To-Do

- ~~Add chat history and persistance.~~ ✅ **COMPLETED**
- ~~Remove the hard coded user I have for testing purposed and figure out how to implement a way to decide a username upon connection to the chat app.~~ ✅ **COMPLETED**
- ~~Add the ability to create and join group chats.~~ ✅ **COMPLETED**
- Figure out how to add a text to speech voice that sounds like Donalad Duck.
- If I figure out how to add the first text to speech voice add more for fun.
- Add some CSS stuff to make everything look nicer than a giant white page with "Chat" in the top left corner.

## What This App Can Do

- **Real-time Messaging**: Send and receive messages instantly using Socket.IO
- **Message Persistence**: All messages are stored in Valkey database and loaded when users connect
- **Chat History**: New users automatically receive chat history upon connection
- **Username Selection**: Users must choose a unique username before joining the chat
- **Username Validation**: Client-side validation ensures usernames meet requirements (2-20 characters, alphanumeric with underscores/hyphens)
- **Multiple Input Methods**: Send messages by clicking the send button or pressing Enter
- **Smart Timestamps**: Messages show time for today, full date for older messages
- **User Avatars**: Each message displays an avatar with the user's first initial
- **Global Chat**: Messages get broadcast to everyone connected to the chat
- **Private Group Chats**: Create or join private groups using a Group ID (letters, numbers, _ and -)
- **Scoped Visibility**: When inside a private group, global chat messages are hidden
- **Group History Management**: Clear chat history for just the current group (does not affect global or other groups)
- **Independent Clears**: Clearing global history never clears group history, and vice versa
- **Server Logs**: Console logs for group lifecycle events (create group chat, clear history (group chat or global), new user connections, etc.)
- **Static File Serving**: Serves up HTML, CSS, and JavaScript files from the public folder
- **Error Handling**: Error messages for username conflicts and validation issues

## Tech Stack

Here's what I used to build this chat app:

- **Backend**: Node.js with Express.js for the server
- **Real-time Messaging**: Socket.IO for instant messaging between clients
- **Database**: Valkey (Redis-compatible) for message persistence and chat history
- **Database Client**: ioredis for connecting to Valkey database
- **Frontend**: HTML5, Tailwind CSS for styling, and vanilla JavaScript
- **UI Framework**: Tailwind CSS with custom utility classes for responsive design
- **Static File Serving**: Express static middleware to serve frontend files
- **CORS Support**: Configured to work seamlessly with browsers
- **Client-side Validation**: JavaScript-based username validation with regex patterns

## Project Structure 

Here's how I organized the files:

```
Chat-App/
├── chat-app/
│   ├── server.js          # The main server file with Socket.IO and Express
│   ├── package.json       # All the dependencies and scripts
│   └── package-lock.json  # Keeps dependency versions locked in
├── public/
│   ├── index.html         # The chat interface that users see
│   └── js/
│       └── main.js        # Frontend JavaScript for chat functionality
└── README.md              # This file you're reading right now
```

## Getting Started

Here's how to get it running:

1. **Install Valkey database:**
   ```bash
   # On Ubuntu/Debian
   sudo apt install valkey
   
   # On macOS
   brew install valkey
   
   # Or use Docker
   docker run -p 6379:6379 valkey/valkey:latest
   ```

2. **Start Valkey server:**
   ```bash
   systemctl start valkey.service
   ```

3. **Navigate to the project folder:**
   ```bash
   cd chat-app
   ```

4. **Install all the required packages:**
   ```bash
   npm install
   ```

5. **Start the server:**
   ```bash
   node server.js
   ```
   *(You can also just run `server.js` directly in your favorite code editor like VS Code, VSCodium, etc.)*

6. **Open the chat app:**
   - Fire up your browser and head to `http://localhost:3000`
   - You'll see the chat interface ready to use with full chat history.
   - To create/join a private group: enter a Group ID in the header input, then click "Create" or "Join". While in a group, messages only go to that group.

## How It All Works

Here's the behind-the-scenes magic:

1. **Server Setup**: Express server handles HTTP requests and serves static files
2. **Database Connection**: Server connects to Valkey database for message persistence
3. **Socket.IO Connection**: When you visit the page, your browser connects to the server via WebSocket
4. **Username Selection Flow**:
   - New users see a modal popup asking for a username
   - Client-side validation checks username format (2-20 characters, alphanumeric with underscores/hyphens)
   - Username is sent to server for availability checking
5. **Chat History Loading**: New users automatically receive all previous messages from Valkey after username selection
6. **Message Journey**: 
   - You type a message and hit send (or press Enter)
   - The message gets sent to the server via Socket.IO
   - Server stores the message in Valkey database
   - If you're in the global lobby, the server broadcasts to everyone connected to the lobby
   - If you're in a private group, the server stores and broadcasts to that group's room only
   - Clients in a private group do not display global lobby messages until they leave the group
7. **Smart Features**: 
   - Timestamps show time for same day for recent messages, full date for older messages
   - User avatars display the first letter of the username
   - Enter key sends messages
   - Complete chat history is preserved and loaded for new users
   - Real-time username conflict detection and error handling
   - "Load More" button to fetch older messages in batches of 50 (Doesn't really work but it's theree)
   - "Clear History" (Global) and "Clear Group" (Private Group) actions, each scoped to their own chat
   - Global history clear is emitted as a global-only event; group history clear is emitted to that group's room
   - Server logs when groups are created, joined, left, cleared, and deleted

## Dependencies

These are the packages that make this chat app tick:

- `express`: The web framework that serves up static files and handles HTTP requests
- `socket.io`: Powers the real-time messaging - messages fly back and forth instantly
- `ioredis`: Redis-compatible client for connecting to Valkey database and storing messages
- `@socket.io/cluster-adapter`: Makes Socket.IO work with clustering (for future scaling)
- `@socket.io/sticky`: Keeps your session connected to the right worker process

## Contributors

- **Mason R. Murphy**

## Credits

- inital code creation and understanding of configuring Websocket with Node.js came from [this guide.](https://deadsimplechat.com/blog/websockets-and-nodejs-real-time-chat-app/)