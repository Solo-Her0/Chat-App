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
- Add the ability to create and join group chats.
- Figure out how to add a text to speech voice that sounds like Donalad Duck.
- If I figure out how to add the first text to speech voice add more for fun.
- Add some CSS stuff to make everything look nicer than a giant white page with "Chat" in the top left corner.
- Figure out more stuff to add if I have the time as this project isn't due until December 4th 2025.

## What This App Can Do

- **Real-time Messaging**: Send and receive messages instantly using Socket.IO
- **Message Persistence**: All messages are stored in Valkey database and loaded when users connect
- **Chat History**: New users automatically receive the complete chat history upon connection
- **Username Selection**: Users must choose a unique username before joining the chat
- **Username Validation**: Client-side validation ensures usernames meet requirements (2-20 characters, alphanumeric with underscores/hyphens)
- **Modern UI**: Clean, responsive interface built with Tailwind CSS featuring a modal-based username selection
- **Multiple Input Methods**: Send messages by clicking the send button or pressing Enter
- **Smart Timestamps**: Messages show time for today, full date for older messages
- **User Avatars**: Each message displays a colorful avatar with the user's initial
- **Group Chat**: Messages get broadcast to everyone connected to the chat
- **Chat History Management**: Clear all chat history with confirmation dialog
- **Message Pagination**: Load more older messages with "Load More" button
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

## Project Structure (STILL A WORK IN PROGRESS)

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
   - Server broadcasts it to everyone connected
   - All connected clients receive and display the message
7. **Smart Features**: 
   - Timestamps show time for same day for recent messages, full date for older messages
   - User avatars display the first letter of the username
   - Enter key sends messages, Shift+Enter creates new lines
   - Complete chat history is preserved and loaded for new users
   - Real-time username conflict detection and error handling
   - "Load More" button to fetch older messages in batches of 50
   - "Clear History" button with confirmation dialog to prevent accidental deletion
   - All connected users are notified when history is cleared

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