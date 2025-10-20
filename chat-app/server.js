// Chat Application Server
// ======================
// This is the "brain" of our chat application - it runs the server
// and handles all the heavy lifting like storing messages, managing users,
// and making sure everyone can talk to each other in real-time

// Dependencies - the tools needed to make this entire project work.
const express = require('express');        // Express helps us create a web server easily
const http = require('http');              // HTTP is the basic protocol for web communication
const { Server } = require('socket.io');   // Socket.IO lets us do real-time communication (like instant messaging)
const path = require('path');              // Path helps us work with file and folder locations
const Redis = require('ioredis');          // Redis is our database - it stores all the chat messages

// Configuration - all the settings for our server
// This is like a settings file where we put all the important numbers and options
// If we need to change something later, we only have to change it here
const CONFIG = {

    port: process.env.PORT || 3000,        // What port to run on (3000 is our default, but we can change it)
    redis: {

        host: 'localhost',                 // Where our Redis database lives
        port: 6379   
                              // Redis's default port number
    },
    cors: {    
                                   // CORS settings - this controls who can connect to our server
        origin: '*',                      // Allow connections from anywhere
        methods: ['GET', 'POST']          // Only allow these types of requests for security

    }

};

// Redis/Valkey Client Setup
// =========================
// Redis is our database - it stores all the chat messages so they don't get lost
// We're using Valkey, which is compatible with Redis
// Think of it like a filing cabinet that never forgets anything

const valkeyClient = new Redis({
    
    host: CONFIG.redis.host,              // Where to find our database
    port: CONFIG.redis.port,              // What port it's listening on
    retryDelayOnFailover: 100,            // If the connection breaks, wait 100ms before trying again
    maxRetriesPerRequest: 3               // Try up to 3 times before giving up

});

// If something goes wrong with our database connection, let us know
valkeyClient.on('error', (err) => {

    console.error('Valkey Client Error:', err);

});

// When we successfully connect to the database let us know.
valkeyClient.on('connect', () => {

    console.log('Connected to Valkey');

});

// Express App Setup
// =================
// Express is like a waiter at a restaurant - it takes requests from customers (browsers)
// and serves them the right responses (web pages, data, etc.)

const app = express();                    // Create our Express application
const httpServer = http.createServer(app); // Create an HTTP server that uses our Express app

// Serve static files - this tells Express to serve our HTML, CSS, and JavaScript files
// When someone visits our website, Express will look in the 'public' folder for files to send them
app.use(express.static(path.join(__dirname, '../public')));

// Routes - these are like different "pages" or "endpoints" on our server
// When someone visits a specific URL, we tell them what to do

// The main route - when someone visits our website's homepage
app.get('/', (req, res) => {

    res.sendFile(path.join(__dirname, '../public/index.html')); // Send them our chat page

});

// Socket.IO Setup
// ===============
// Socket.IO is the magic that makes real-time chat possible
// Instead of the browser asking "any new messages?" every few seconds,
// Socket.IO creates a persistent connection that instantly sends new messages

const io = new Server(httpServer, {

    cors: CONFIG.cors  // Use our CORS settings to control who can connect

});

// Application State
// =================
// These are like the server's memory. They keep track of important information
// while the server is running

const activeUsernames = new Set();        // A list of all usernames currently being used
                                          // We use a Set because it automatically prevents duplicates
const MESSAGE_KEYS = {

    CHAT_MESSAGES: 'chat_messages'        // The key we use to store messages in Redis
                                          // It's like a label on a box in our filing cabinet
};

// Utility Functions
// =================
// These are helper functions that do specific tasks
// We put them here so we can reuse them throughout our code

/**
 * Logs user activity with consistent formatting
 * This helps us keep track of what's happening on our server
 * It's like keeping a diary of all the important events
 * 
 * @param {string} action - What the user did (like "connected" or "sent message")
 * @param {string} socketId - A unique ID for this user's connection
 * @param {string} username - The user's chosen name (optional)
 */
function logUserActivity(action, socketId, username = null) {

    const userInfo = username ? `${username} (${socketId})` : socketId;
    console.log(`${action}: ${userInfo}`);

}

/**
 * Handles Redis operations with error handling
 * Redis is our database, and sometimes things go wrong
 * This function wraps our database calls with error handling so we don't crash
 * 
 * @param {Function} operation - The database operation we want to perform
 * @param {string} operationName - What we're trying to do (for error messages)
 * @returns {Promise<any>} - The result of the operation
 */
async function handleRedisOperation(operation, operationName) {

    try {

        return await operation();  // Try to do the database operation

    } catch (error) {

        console.error(`Error during ${operationName}:`, error);  // If it fails, log the error
        throw error;  // Re-throw the error so the calling function knows something went wrong

    }

}

// Socket Event Handlers
// =====================
// These functions handle different types of messages from users
// Think of them as different "mailboxes" - when a user sends a specific type of message,
// the right function picks it up and handles it

/**
 * Handles username selection
 * When a user picks a username, this function checks if it's available
 * It's like a bouncer at a club - it decides if the username is allowed in
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {Object} data - The data they sent (contains their chosen username)
 */
function handleUsernameSelection(socket, data) {

    const { username } = data;  // Extract the username from their message
    
    // Check if someone else is already using this username
    if (activeUsernames.has(username)) {

        // If it's taken, tell them to pick a different one
        socket.emit('username_taken', { 
            message: 'Username is already taken. Please choose another.' 
        });
        return;  // Stop here - don't let them use this username

    }
    
    // If the username is available, add it to our list and remember it
    activeUsernames.add(username);  // Add to our "taken usernames" list
    socket.username = username;     // Remember this user's username
    
    logUserActivity('User selected username', socket.id, username);
    
    // Tell the user "great! your username is accepted"
    socket.emit('username_accepted', { username });
    
    // Tell everyone else "hey, a new person joined the chat"
    socket.broadcast.emit('user_joined', { username });

}

/**
 * Handles message sending
 * When someone sends a chat message, this function processes it
 * It stores the message in our database and sends it to everyone
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {Object} data - The message data they sent
 */
async function handleMessage(socket, data) {

    // First, make sure they've picked a username (security check)
    if (!socket.username) {

        socket.emit('error', { 

            message: 'Please select a username before sending messages.' 

        });
        return;  // Stop here - they can't send messages without a username

    }
    
    // Create a clean message object with all the information we need
    const messageData = {

        username: socket.username,  // Use the server-stored username (for security)
        message: data.message,      // What they said
        timestamp: data.timestamp   // When they said it

    };
    
    logUserActivity('Message sent', socket.id, socket.username);
    
    try {

        // Store the message in our database so it doesn't get lost
        await handleRedisOperation(

            () => valkeyClient.lpush(MESSAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messageData)),
            'message storage'

        );
        
        // Send the message to everyone connected (including the sender)
        io.emit('message', messageData);

    } catch (error) {

        // If storing the message failed, let the user know
        console.error('Failed to store message:', error);
        socket.emit('error', { 

            message: 'Failed to send message. Please try again.' 

        });

    }

}

/**
 * Handles user disconnection
 * When someone leaves the chat (closes their browser, loses internet, etc.),
 * this function cleans up after them
 * 
 * @param {Object} socket - The user's connection that's disconnecting
 */
function handleDisconnection(socket) {

    if (socket.username) {

        // If they had a username, remove it from our "taken" list
        activeUsernames.delete(socket.username);
        logUserActivity('User disconnected', socket.id, socket.username);
        
        // Tell everyone else "hey, this person left the chat"
        socket.broadcast.emit('user_left', { username: socket.username });

    } else {

        // If they never picked a username, just log that they left
        logUserActivity('User disconnected', socket.id);

    }

}

/**
 * Loads and sends historical messages to a socket
 * When someone first joins, we send them all the old messages
 * This is like giving them a history book of the conversation
 * 
 * @param {Object} socket - The new user's connection
 */
async function loadHistoricalMessages(socket) {

    try {

        // Get all the stored messages from our database
        const messages = await handleRedisOperation(

            () => valkeyClient.lrange(MESSAGE_KEYS.CHAT_MESSAGES, 0, -1),
            'historical messages retrieval'

        );
        
        // Convert the stored strings back into JavaScript objects
        const parsedMessages = messages.map(item => JSON.parse(item));
        
        // Send all the old messages to the new user
        socket.emit('historical_messages', parsedMessages);

    } catch (error) {

        // If we can't load the old messages, let the user know
        console.error('Failed to load historical messages:', error);
        socket.emit('error', { 

            message: 'Failed to load chat history.' 

        });

    }

}

/**
 * Loads paginated historical messages for a socket
 * This allows users to load more messages as they scroll up
 * 
 * @param {Object} socket - The user's connection
 * @param {number} offset - How many messages to skip (for pagination)
 * @param {number} limit - How many messages to load
 */
async function loadPaginatedMessages(socket, offset = 0, limit = 50) {

    try {

        // Get paginated messages from our database
        const messages = await handleRedisOperation(

            () => valkeyClient.lrange(MESSAGE_KEYS.CHAT_MESSAGES, offset, offset + limit - 1),
            'paginated messages retrieval'

        );
        
        // Convert the stored strings back into JavaScript objects
        const parsedMessages = messages.map(item => JSON.parse(item));
        
        // Send the paginated messages to the user
        socket.emit('paginated_messages', { 
            messages: parsedMessages, 
            hasMore: messages.length === limit,
            offset: offset + messages.length

        });

    } catch (error) {

        // If we can't load the messages, let the user know
        console.error('Failed to load paginated messages:', error);
        socket.emit('error', { 

            message: 'Failed to load more messages.' 

        });

    }

}

/**
 * Clears all chat history from the database
 * This removes all stored messages and notifies all connected clients
 * 
 * @param {Object} socket - The user's connection who requested the clear
 */
async function clearChatHistory(socket) {

    // First, make sure they've picked a username (security check)
    if (!socket.username) {

        socket.emit('error', { 

            message: 'Please select a username before clearing chat history.' 

        });
        return;

    }
    
    try {

        // Clear all messages from our database
        await handleRedisOperation(

            () => valkeyClient.del(MESSAGE_KEYS.CHAT_MESSAGES),
            'chat history clearing'

        );
        
        logUserActivity('Chat history cleared', socket.id, socket.username);
        
        // Notify all connected clients that history was cleared
        io.emit('history_cleared', { 
            clearedBy: socket.username,
            timestamp: new Date()
            
        });

    } catch (error) {

        // If clearing failed, let the user know
        console.error('Failed to clear chat history:', error);
        socket.emit('error', { 

            message: 'Failed to clear chat history. Please try again.' 

        });

    }

}

// Socket.IO Connection Handler
// ============================
// This is the main function that runs when someone connects to our chat
// It's like a welcome committee - it greets new users and sets up everything they need

io.on('connection', async (socket) => {

    // Someone new just connected! Let's welcome them
    logUserActivity('User connected', socket.id);
    
    // Send them all the old messages so they can see what's been said
    await loadHistoricalMessages(socket);
    
    // Set up listeners for different types of messages they might send
    socket.on('select_username', (data) => handleUsernameSelection(socket, data));
    socket.on('message', (data) => handleMessage(socket, data));
    socket.on('load_more_messages', (data) => loadPaginatedMessages(socket, data.offset, data.limit));
    socket.on('clear_history', () => clearChatHistory(socket));
    socket.on('disconnect', () => handleDisconnection(socket));

});

// Server Startup
// ==============
// This is where we actually start our server and make it available to the world
// It's like opening the doors of our chat room for business

httpServer.listen(CONFIG.port, () => {

    console.log(`Server running on port ${CONFIG.port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Chat server can now accepet connections.');

});