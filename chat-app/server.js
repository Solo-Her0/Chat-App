// Chat Application Server
// ======================
// This is the "brain" of our chat application it runs the server
// and handles all the heavy lifting like storing messages, managing users,
// and making sure everyone can talk to each other in real-time

// Dependencies the tools needed to make this entire project work.
const express = require('express');        // Express helps us create a web server easily
const http = require('http');              // HTTP is the basic protocol for web communication
const { Server } = require('socket.io');   // Socket.IO lets us do real-time communication (like instant messaging)
const path = require('path');              // Path helps us work with file and folder locations
const Redis = require('ioredis');          // Redis is our database it stores all the chat messages

// Configuration all the settings for our server
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
                                   // CORS settings this controls who can connect to our server
        origin: '*',                      // Allow connections from anywhere
        methods: ['GET', 'POST']          // Only allow these types of requests for security

    }

};

// Redis/Valkey Client Setup
// =========================
// Redis is our database it stores all the chat messages so they don't get lost
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

// Serve static files this tells Express to serve our HTML, CSS, and JavaScript files
// When someone visits our website, Express will look in the 'public' folder for files to send them
app.use(express.static(path.join(__dirname, '../public')));

// Routes these are like different "pages" or "endpoints" on our server
// When someone visits a specific URL, we tell them what to do

// The main route when someone visits our website's homepage
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

// Group Chat Keys
// ===============
// These are the keys we use to store group-related data in Redis
// We namespace all group-related data under these patterns so we can keep everything organized
// Think of it like having different filing cabinets for different types of group information
const GROUP_KEYS = {

    GROUPS_SET: 'groups',                                 // Set of all group IDs keeps track of which groups exist
    meta: (groupId) => `group:${groupId}:meta`,           // Hash: stores group metadata like name, owner, and when it was created
    members: (groupId) => `group:${groupId}:members`,     // Set: keeps track of which usernames are members of the group
    messages: (groupId) => `group:${groupId}:messages`    // List: stores all the messages sent in this group

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
        throw error;  // Re throw the error so the calling function knows something went wrong

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
 * Validates a group ID string
 * check if a group ID is valid before we try to use it
 * Makes sure it's 2-50 characters with letters, numbers, underscores, and hyphens
 * 
 * @param {string} groupId - The group ID we want to validate
 * @returns {boolean} - Returns true if the group ID is valid, false otherwise
 */
function isValidGroupId(groupId) {

    if (!groupId || typeof groupId !== 'string') return false;
    const trimmed = groupId.trim();
    if (!trimmed) return false;
    // Allow letters, numbers, underscores and hyphens (2-50 chars)
    // This ensures group IDs are easy to type and remember
    return /^[a-zA-Z0-9_-]{2,50}$/.test(trimmed);

}

/**
 * Creates a new private group
 * Sets up a new group chat with the given ID. The person who creates it becomes the owner
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {{ groupId: string, name?: string }} data - Contains the group ID and optional name
 */
async function handleCreateGroup(socket, data) {

    if (!socket.username) {

        socket.emit('error', { message: 'Please select a username before creating groups.' });
        return;

    }

    const groupId = (data?.groupId || '').trim();
    const groupName = (data?.name || groupId).trim();

    if (!isValidGroupId(groupId)) {

        socket.emit('error', { message: 'Invalid group ID. Use 2-50 chars: letters, numbers, _ or -.' });
        return;

    }

    try {

        const exists = await handleRedisOperation(

            () => valkeyClient.sismember(GROUP_KEYS.GROUPS_SET, groupId),
            'group existence check'

        );

        if (exists) {

            socket.emit('error', { message: 'Group already exists.' });
            return;

        }

        // Add group to registry this i adding it to our list of existing groupss
        await handleRedisOperation(

            () => valkeyClient.sadd(GROUP_KEYS.GROUPS_SET, groupId),
            'group add to registry'

        );

        // Store group metadata who created it, when, and what it's called
        const createdAt = new Date().toISOString();
        await handleRedisOperation(

            () => valkeyClient.hset(GROUP_KEYS.meta(groupId), {
                name: groupName,
                owner: socket.username,
                createdAt
            }),

            'group meta set'

        );

        // Add the creator as a member. they automatically get added when they create the group
        await handleRedisOperation(

            () => valkeyClient.sadd(GROUP_KEYS.members(groupId), socket.username),
            'group add member'

        );

        // Join socket.io room. this should connect them to the group so they get messages
        socket.join(groupId);

        console.log(`[GROUP] Created by ${socket.username} → id=${groupId} name="${groupName}" at ${createdAt}`);

        socket.emit('group_created', {

            groupId,
            name: groupName,
            owner: socket.username,
            createdAt

        });

    } catch (error) {

        console.error('Failed to create group:', error);
        socket.emit('error', { message: 'Failed to create group. Please try again.' });

    }

}

/**
 * Joins an existing group
 * Adds a user to a group and sends them all the historical messages from that group
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {{ groupId: string }} data - Contains the group ID they want to join
 */
async function handleJoinGroup(socket, data) {

    if (!socket.username) {

        socket.emit('error', { message: 'Please select a username before joining groups.' });
        return;

    }

    const groupId = (data?.groupId || '').trim();
    if (!isValidGroupId(groupId)) {

        socket.emit('error', { message: 'Invalid group ID.' });
        return;

    }

    try {

        const exists = await handleRedisOperation(

            () => valkeyClient.sismember(GROUP_KEYS.GROUPS_SET, groupId),
            'group existence check'

        );

        if (!exists) {

            socket.emit('error', { message: 'Group does not exist.' });
            return;

        }

        // Add them to the member list
        await handleRedisOperation(

            () => valkeyClient.sadd(GROUP_KEYS.members(groupId), socket.username),
            'group add member'

        );

        // Join socket.io room  should make them receive group messages
        socket.join(groupId);

        console.log(`[GROUP] Join: user=${socket.username} group=${groupId}`);

        // Load all the historical messages from this group so they can see what's been said
        const messages = await handleRedisOperation(

            () => valkeyClient.lrange(GROUP_KEYS.messages(groupId), 0, -1),
            'group historical messages retrieval'

        );

        const parsedMessages = messages.map(item => JSON.parse(item));

        // Get the group's metadata (name, owner, etc.)
        const meta = await handleRedisOperation(

            () => valkeyClient.hgetall(GROUP_KEYS.meta(groupId)),
            'group meta get'

        );

        socket.emit('group_joined', {

            groupId,
            name: meta?.name || groupId,
            messages: parsedMessages

        });

    } catch (error) {

        console.error('Failed to join group:', error);
        socket.emit('error', { message: 'Failed to join group. Please try again.' });

    }

}

/**
 * Sends a message to a private group
 * Stores the message and sends it to everyone in that group (not global chat)
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {{ groupId: string, message: string, timestamp: string|Date }} data - The message data and which group it's for
 */
async function handleGroupMessage(socket, data) {

    if (!socket.username) {

        socket.emit('error', { message: 'Please select a username before sending messages.' });
        return;

    }

    const groupId = (data?.groupId || '').trim();
    const messageText = (data?.message || '').trim();
    const timestamp = data?.timestamp;

    if (!isValidGroupId(groupId) || !messageText) {

        return;

    }

    try {

        // Check if they're actually a member don't want people sending messages to groups they're not in
        const isMember = await handleRedisOperation(

            () => valkeyClient.sismember(GROUP_KEYS.members(groupId), socket.username),
            'group membership check'

        );

        if (!isMember) {

            socket.emit('error', { message: 'You are not a member of this group.' });
            return;

        }

        // Create the message object
        const messageData = {

            groupId,
            username: socket.username,
            message: messageText,
            timestamp

        };

        // Store the message in our database so it doesn't get lost
        await handleRedisOperation(

            () => valkeyClient.lpush(GROUP_KEYS.messages(groupId), JSON.stringify(messageData)),
            'group message storage'

        );

        // Send it to everyone in this group only
        io.to(groupId).emit('group_message', messageData);
        // console.log(`[GROUP] Message: group=${groupId} user=${socket.username}`);

    } catch (error) {

        console.error('Failed to send group message:', error);
        socket.emit('error', { message: 'Failed to send message. Please try again.' });

    }

}

/**
 * Clears the chat history of a private group
 * Removes all messages from the group but keeps the group itself
 * Any member can do this
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {{ groupId: string }} data - Contains the group ID whose history should be cleared
 */
async function handleClearGroupHistory(socket, data) {

    if (!socket.username) {

        socket.emit('error', { message: 'Please select a username before clearing group history.' });
        return;

    }

    const groupId = (data?.groupId || '').trim();
    if (!isValidGroupId(groupId)) return;

    try {

        // Check if they're a member only members should be able to clear history
        const isMember = await handleRedisOperation(

            () => valkeyClient.sismember(GROUP_KEYS.members(groupId), socket.username),
            'group membership check'

        );

        if (!isMember) {

            socket.emit('error', { message: 'You are not a member of this group.' });
            return;

        }

        // Delete all the messages from this group
        await handleRedisOperation(

            () => valkeyClient.del(GROUP_KEYS.messages(groupId)),
            'group history clearing'

        );

        console.log(`[GROUP] History cleared: group=${groupId} by ${socket.username}`);

        // This should notify everyone in the group that history was cleared
        io.to(groupId).emit('group_history_cleared', {
            groupId,
            clearedBy: socket.username,
            timestamp: new Date()
        });

    } catch (error) {

        console.error('Failed to clear group history:', error);
        socket.emit('error', { message: 'Failed to clear group history. Please try again.' });

    }

}

/**
 * Deletes a private group entirely
 * Removes everything about the group - messages, members, metadata
 * Anyone who is a member of the group can delete it. I'm not sure how to fix that.
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {{ groupId: string }} data - Contains the group ID to delete
 */
async function handleDeleteGroup(socket, data) {

    if (!socket.username) {

        socket.emit('error', { message: 'Please select a username before deleting groups.' });
        return;

    }

    const groupId = (data?.groupId || '').trim();
    if (!isValidGroupId(groupId)) return;

    try {

        const exists = await handleRedisOperation(

            () => valkeyClient.sismember(GROUP_KEYS.GROUPS_SET, groupId),
            'group existence check'

        );

        if (!exists) {

            socket.emit('error', { message: 'Group does not exist.' });
            return;

        }

        // Get the group's metadata supposed to check who the owner is but the check doesn't work right
        const meta = await handleRedisOperation(

            () => valkeyClient.hgetall(GROUP_KEYS.meta(groupId)),
            'group meta get'

        );

        // This is supposed to only let the owner delete it, but it's not working right
        if (!meta || meta.owner !== socket.username) {

            socket.emit('error', { message: 'Only the group owner can delete this group.' });
            return;

        }

        // This is supposed to notify everyone in the group that the group was deleted, but it doesn't work.
        io.to(groupId).emit('group_deleted', { groupId, deletedBy: socket.username });
        console.log(`[GROUP] Deleted: group=${groupId} by ${socket.username}`);

        // Delete all the group's data messages, members, metadata, and remove from registry
        await handleRedisOperation(

            () => valkeyClient.del(GROUP_KEYS.messages(groupId)),
            'group messages delete'

        );

        await handleRedisOperation(

            () => valkeyClient.del(GROUP_KEYS.members(groupId)),
            'group members delete'

        );

        await handleRedisOperation(

            () => valkeyClient.del(GROUP_KEYS.meta(groupId)),
            'group meta delete'

        );
        
        await handleRedisOperation(

            () => valkeyClient.srem(GROUP_KEYS.GROUPS_SET, groupId),
            'group registry remove'

        );

        // Make everyone leave the room - kick them out since the group doesn't exist anymore
        const room = io.sockets.adapter.rooms.get(groupId);
        if (room) {
            for (const socketId of room) {
                const s = io.sockets.sockets.get(socketId);
                if (s) s.leave(groupId);
            }
        }

    } catch (error) {

        console.error('Failed to delete group:', error);
        socket.emit('error', { message: 'Failed to delete group. Please try again.' });

    }

}

/**
 * Leaves a private group
 * Removes them from the member list and disconnects their socket from the group
 * 
 * @param {Object} socket - The user's connection to our server
 * @param {{ groupId: string }} data - Contains the group ID they want to leave
 */
async function handleLeaveGroup(socket, data) {

    if (!socket.username) {

        socket.emit('error', { message: 'Please select a username before leaving groups.' });
        return;

    }

    const groupId = (data?.groupId || '').trim();
    if (!isValidGroupId(groupId)) return;

    try {

        // Check if they're actually a member
        const isMember = await handleRedisOperation(

            () => valkeyClient.sismember(GROUP_KEYS.members(groupId), socket.username),
            'group membership check'

        );

        if (!isMember) {

            socket.emit('left_group', { groupId, status: 'not_member' });
            return;

        }

        // Remove them from the member list
        await handleRedisOperation(

            () => valkeyClient.srem(GROUP_KEYS.members(groupId), socket.username),
            'group remove member'

        );

        // Disconnect them from the group room they won't get group messages anymore
        socket.leave(groupId);
        console.log(`[GROUP] Leave: user=${socket.username} group=${groupId}`);
        socket.emit('left_group', { groupId, status: 'ok' });

    } catch (error) {

        console.error('Failed to leave group:', error);
        socket.emit('error', { message: 'Failed to leave group. Please try again.' });

    }

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

        username: socket.username,  // Use the server stored username (for security)
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
        
        // Notify all connected clients that global history was cleared
        io.emit('global_history_cleared', { 
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
// It's like a welcome committee it greets new users and sets up everything they need

io.on('connection', async (socket) => {

    // Someone new just connected! Let's welcome them
    logUserActivity('User connected', socket.id);
    
    // Send them all the old messages so they can see what's been said
    await loadHistoricalMessages(socket);
    
    // Set up listeners for different types of messages they might send
    // These are like different "mailboxes" that handle specific types of requests
    socket.on('select_username', (data) => handleUsernameSelection(socket, data));
    socket.on('message', (data) => handleMessage(socket, data));
    socket.on('load_more_messages', (data) => loadPaginatedMessages(socket, data.offset, data.limit));
    socket.on('clear_history', () => clearChatHistory(socket));
    
    // Group chat events these handle all the private group stuff
    socket.on('create_group', (data) => handleCreateGroup(socket, data));
    socket.on('join_group', (data) => handleJoinGroup(socket, data));
    socket.on('leave_group', (data) => handleLeaveGroup(socket, data));
    socket.on('group_message', (data) => handleGroupMessage(socket, data));
    socket.on('clear_group_history', (data) => handleClearGroupHistory(socket, data));
    socket.on('delete_group', (data) => handleDeleteGroup(socket, data));
    
    // Allow clients to request global history when they leave a group
    socket.on('request_global_history', () => loadHistoricalMessages(socket));
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