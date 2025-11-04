// Chat Application Main Client Logic
// =====================================
// Handles everything that happens in the browser
// Manages the UI, talks to the server, makes sure everything works

// Socket.IO connection connects to the server
// Real-time connection so we can send and receive messages instantly
const socket = io();

// Application state keeps track of important stuff
let selectedUsername = null; // We'll store the user's chosen name here once they pick one
let loadedMessageCount = 0;  // How many messages we've loaded from the server
let hasMoreMessages = true;  // Whether there are more messages to load
let currentGroupId = null;   // Currently joined group (if any)

// DOM Elements (cached for performance)
// Find them once and store them here instead of searching every time
// Makes things faster
const elements = {
    
    usernameModal: document.getElementById('username-modal'),     // The popup where users pick their name
    usernameForm: document.getElementById('username-form'),       // The form inside the popup
    usernameInput: document.getElementById('username-input'),     // The text box where they type their name
    usernameError: document.getElementById('username-error'),     // Where we show error messages
    chatInterface: document.querySelector('.grid.h-screen > div'), // The main chat area (hidden until username is picked)
    messageForm: document.getElementById('message-form'),         // The form for sending messages
    messageInput: document.getElementById('message'),             // The text area where they type messages
    chatMessages: document.getElementById('chat-messages'),       // The container where all messages appear
    loadMoreBtn: document.getElementById('load-more-btn'),        // Button to load more messages
    clearHistoryBtn: document.getElementById('clear-history-btn'), // Button to clear chat history
    clearConfirmationModal: document.getElementById('clear-confirmation-modal'), // Confirmation modal
    confirmClearBtn: document.getElementById('confirm-clear'),    // Confirm clear button
    cancelClearBtn: document.getElementById('cancel-clear'),       // Cancel clear button
    groupIdInput: document.getElementById('group-id-input'),     // The text input where users enter group IDs
    createGroupBtn: document.getElementById('create-group-btn'),   // Button to create a new private group
    joinGroupBtn: document.getElementById('join-group-btn'),       // Button to join an existing group
    leaveGroupBtn: document.getElementById('leave-group-btn'),      // Button to leave the current group
    clearGroupBtn: document.getElementById('clear-group-btn'),     // Button to clear the current group's history
    deleteGroupBtn: document.getElementById('delete-group-btn'),  // Button to delete the current group (owner only)
    currentGroupLabel: document.getElementById('current-group-label') // Label showing which group you're in
    
};

// Configuration all the rules and settings
// Put all the "magic numbers" and rules here so we only have to change them in one place
const CONFIG = {
    
    username: {
        
        minLength: 2,                    // Usernames must be at least 2 characters (so we don't get "a" or "b")
        maxLength: 20,                   // But not more than 20 characters (so they don't take up too much space)
        pattern: /^[a-zA-Z0-9_-]+$/     // Only letters, numbers, underscores, and hyphens are allowed
        
    }
    
};

// Utility Functions
// =================
// These are helper functions that do specific tasks
// We put them at the top so they're available everywhere in our code

/**
 * Validates username according to rules
 * Checks if a username is valid - length, characters, etc.
 * 
 * @param {string} username - The username the user wants to use
 * @returns {string|null} - Error message if there's a problem, null if it's good
 */
function validateUsername(username) {
    
    const trimmed = username.trim(); // Remove any extra spaces at the beginning or end
    
    // Check if the username is empty (just spaces don't count)
    if (!trimmed) return "Username cannot be empty";
    
    // Check if it's too short (we want people to be able to identify each other)
    if (trimmed.length < CONFIG.username.minLength) return `Username must be at least ${CONFIG.username.minLength} characters long`;
    
    // Check if it's too long (we don't want usernames that take up the whole screen)
    if (trimmed.length > CONFIG.username.maxLength) return `Username must be less than ${CONFIG.username.maxLength} characters`;
    
    // Check if it contains only allowed characters (no weird symbols that might break things)
    if (!CONFIG.username.pattern.test(trimmed)) return "Username can only contain letters, numbers, underscores, and hyphens";
    
    return null; // If we get here, the username is perfect!
    
}

/**
 * Shows error message in the username form
 * Makes the error visible so the user knows what went wrong
 * 
 * @param {string} message - The error message to show
 */
function showUsernameError(message) {
    
    elements.usernameError.textContent = message;  // Put the error message in the error box
    elements.usernameError.classList.remove('hidden'); // Make the error box visible
    
}

/**
 * Hides username error message
 * Hides old errors to keep the interface clean
 */
function hideUsernameError() {
    
    elements.usernameError.classList.add('hidden'); // Hide the error box
    
}

/**
 * Formats timestamp for display
 * Shows just the time if it's today, or full date if it's older
 * 
 * @param {Date|string} timestamp - The timestamp to format
 * @returns {string} - Formatted time string
 */
function formatTimestamp(timestamp) {
    
    const now = new Date();                    // What time is it right now?
    const messageDate = new Date(timestamp);   // When was this message sent?
    
    // If the message was sent today, just show the time (like "2:30 PM")
    // If it was sent on a different day, show the full date and time (like "12/25/2023, 2:30 PM")
    return now.toLocaleDateString() === messageDate.toLocaleDateString()
        ? messageDate.toLocaleTimeString()
        : messageDate.toLocaleString();
        
}

// Username Selection Logic
// ========================
// Handles picking a username

/**
 * Handles username form submission
 * Checks if username is valid, then sends it to the server
 * 
 * @param {Event} event - The form submit event
 */
function handleUsernameSubmit(event) {
    
    event.preventDefault(); // Stop the form from trying to reload the page (that's the default behavior)
    
    const username = elements.usernameInput.value; // Get what the user typed
    const error = validateUsername(username);      // Check if it's a good username
    
    // If there's a problem with the username, show the error and stop here
    if (error) {
        
        showUsernameError(error);
        return;
        
    }
    
    // If the username looks good, hide any old errors and send it to the server
    hideUsernameError();
    socket.emit('select_username', { username: username.trim() });
    
}

/**
 * Handles successful username acceptance from server
 * Hides the username popup and shows the chat interface
 * 
 * @param {Object} data - Server response with accepted username
 */
function handleUsernameAccepted(data) {
    
    selectedUsername = data.username;                    // Remember the username for later
    elements.usernameModal.style.display = 'none';      // Hide the username popup
    elements.chatInterface.style.display = 'flex';      // Show the main chat area
    elements.messageInput.focus();                       // Put the cursor in the message box so they can start typing
    updateCurrentGroupLabel();
    
}

/**
 * Handles username taken error from server
 * Shows the error so they know to pick a different name
 * 
 * @param {Object} data - Server error response with message
 */
function handleUsernameTaken(data) {
    
    showUsernameError(data.message); // Show the "username taken" message
    
}

// Message Handling
// ================
// Handles sending and displaying messages

/**
 * Generates HTML for a chat message
 * Creates the HTML structure for displaying a message
 * 
 * @param {string} username - Who sent the message
 * @param {Date|string} timestamp - When they sent it
 * @param {string} message - What they said
 * @returns {string} - HTML string to add to the page
 */
function generateMessageHTML(username, timestamp, message) {
    
    const formattedTimestamp = formatTimestamp(timestamp);  // Make the timestamp look nice
    const userInitial = username.charAt(0).toUpperCase();   // Get the first letter for the avatar
    const displayName = username.charAt(0).toUpperCase() + username.slice(1); // Make the name look nice
    
    // Create the HTML structure for a message
    // This creates a nice layout with an avatar circle, username, timestamp, and message text
    return `
        <li class="flex space-x-2 pl-2 pt-2">
            <div class="flex-shrink-0">
                <div class="h-10 w-10 rounded-full bg-indigo-400 flex items-center justify-center font-bold text-white">
                    ${userInitial}
                </div>
            </div>
            <div class="flex flex-col">
                <div class="flex items-baseline space-x-2">
                    <div class="font-bold text-gray-800">${displayName}</div>
                    <div class="text-sm text-gray-500">${formattedTimestamp}</div>
                </div>
                <div class="text-sm text-gray-700">${message}</div>
            </div>
        </li>
    `;
    
}

/**
 * Adds a message to the chat display
 * Puts the message on screen and scrolls to bottom for new messages
 * 
 * @param {string} username - Who sent the message
 * @param {Date|string} timestamp - When they sent it
 * @param {string} message - What they said
 * @param {boolean} prepend - If true, adds at top (for loading older messages)
 */
function addMessageToChat(username, timestamp, message, prepend = false) {
    
    const html = generateMessageHTML(username, timestamp, message); // Create the HTML
    const element = document.createElement('li');                    // Create a new list item
    element.innerHTML = html;                                       // Put the HTML inside it
    
    if (prepend) {
        // Add at the top for older messages
        elements.chatMessages.insertBefore(element, elements.chatMessages.firstChild);
    } else {
        // Add at the bottom for new messages
        elements.chatMessages.appendChild(element);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight; // Scroll to the bottom
    }
    
}

/**
 * Updates the current group label in the header
 * Shows which group you're in, or clears it if you're not in one
 */
function updateCurrentGroupLabel() {

    if (currentGroupId) {

        elements.currentGroupLabel.textContent = `(Group: ${currentGroupId})`;

    } else {

        elements.currentGroupLabel.textContent = '';

    }

}

/**
 * Loads more messages from the server
 * Requests older messages when you click "Load More"
 */
function loadMoreMessages() {
    
    if (!hasMoreMessages) return; // Don't load if there are no more messages
    
    // Show loading state
    elements.loadMoreBtn.textContent = 'Loading...';
    elements.loadMoreBtn.disabled = true;
    
    // Request more messages from the server
    socket.emit('load_more_messages', {
        offset: loadedMessageCount,
        limit: 50 // Load 50 messages at a time
    });
    
}

/**
 * Handles loading more messages from server
 * Processes the response and adds messages to the chat
 * 
 * @param {Object} data - Server response with messages and pagination info
 */
function handleLoadMoreMessages(data) {
    
    const { messages, hasMore, offset } = data;
    
    // Add each message to the top of the chat (older messages)
    messages.forEach(message => {
        addMessageToChat(message.username, message.timestamp, message.message, true);
    });
    
    // Update our state
    loadedMessageCount = offset;
    hasMoreMessages = hasMore;
    
    // Update the button
    if (hasMoreMessages) {
        elements.loadMoreBtn.textContent = 'Load More';
        elements.loadMoreBtn.disabled = false;
        elements.loadMoreBtn.classList.remove('hidden');
    } else {
        elements.loadMoreBtn.classList.add('hidden');
    }
    
}

/**
 * Shows the clear history confirmation modal
 * Safety check before clearing
 */
function showClearConfirmation() {
    
    elements.clearConfirmationModal.classList.remove('hidden');
    
}

/**
 * Hides the clear history confirmation modal
 * Closes the confirmation dialog
 */
function hideClearConfirmation() {
    
    elements.clearConfirmationModal.classList.add('hidden');
    
}

/**
 * Clears all messages from the chat display
 * Removes all messages from the screen
 */
function clearChatDisplay() {
    
    elements.chatMessages.innerHTML = '';
    loadedMessageCount = 0;
    hasMoreMessages = true;
    elements.loadMoreBtn.classList.add('hidden');
    
}

/**
 * Handles clearing chat history
 * Sends the clear request to the server
 */
function handleClearHistory() {
    
    // Hide the confirmation modal
    hideClearConfirmation();
    
    // Send clear request to server
    socket.emit('clear_history');
    
}

// Group Controls
// ==============
// Handles private group chat stuff

/**
 * Handles creating a new private group
 * Takes the group ID from input and asks server to create it
 */
function handleCreateGroup() {

    const groupId = (elements.groupIdInput.value || '').trim();
    if (!groupId) return; // Don't create if there's no group ID
    socket.emit('create_group', { groupId, name: groupId });

}

/**
 * Handles joining an existing private group
 * Takes the group ID from input and asks server to add them
 */
function handleJoinGroup() {

    const groupId = (elements.groupIdInput.value || '').trim();
    if (!groupId) return; // Don't join if there's no group ID
    socket.emit('join_group', { groupId });

}

/**
 * Handles leaving the current private group
 * Tells server to remove them and switches back to global chat
 * Requests global history so they can see what's been said
 */
function handleLeaveGroup() {

    if (!currentGroupId) return; // Can't leave if we're not in a group
    const groupId = currentGroupId;
    // Ask server to leave (updates membership and socket room)
    socket.emit('leave_group', { groupId });
    // Switch context back to global immediately
    currentGroupId = null;
    clearChatDisplay();
    updateCurrentGroupLabel();
    // Request fresh global history so they can see what's been said in the lobby
    socket.emit('request_global_history');

}

/**
 * Handles clearing the current group's chat history
 * Asks server to delete all messages in the group (group stays)
 */
function handleClearGroup() {

    if (!currentGroupId) return; // Can't clear if we're not in a group
    socket.emit('clear_group_history', { groupId: currentGroupId });

}

/**
 * Handles deleting the current private group entirely
 * Asks server to permanently remove the group
 * Supposed to be owner only but I'm not sure if that's working
 */
function handleDeleteGroup() {

    if (!currentGroupId) return; // Can't delete if we're not in a group
    socket.emit('delete_group', { groupId: currentGroupId });

}

/**
 * Handles sending a message
 * Takes the message and sends it to server (group or global)
 * 
 * @param {Event} event - The form submit event
 */
function handleMessageSubmit(event) {
    
    event.preventDefault(); // Stop the form from trying to reload the page
    
    const message = elements.messageInput.value.trim(); // Get what they typed and remove extra spaces
    
    // Only send if there's actually a message and they've picked a username
    if (!message || !selectedUsername) return;
    
    // Send to current group if in a group, else global chat
    if (currentGroupId) {

        socket.emit('group_message', {

            groupId: currentGroupId,
            message: message,
            timestamp: new Date()

        });

    } else {

        socket.emit('message', {

            username: selectedUsername,
            message: message,
            timestamp: new Date()

        });

    }
    
    elements.messageInput.value = ''; // Clear the input box so they can type their next message
    
}

// Socket Event Handlers
// =====================
// Listen for messages from the server

// When the server says "yes, your username is good to go"
socket.on('username_accepted', handleUsernameAccepted);

// When the server says "sorry, that username is already taken"
socket.on('username_taken', handleUsernameTaken);

// When someone sends a global message (including ourselves)
// This only shows up when you're in the global lobby, not when you're in a private group
socket.on('message', function(data) {
    
    // Only show global messages when not inside a group context
    // When you're in a group, you shouldn't see what's happening in the global chat
    if (!currentGroupId) {
        addMessageToChat(data.username, data.timestamp, data.message);
    }
    
});

// Group Chat Events
// =================
// Handle all the events related to private group chats

// Server confirms we created a new group
// Switches view to that group and clears old messages
socket.on('group_created', function(data) {

    currentGroupId = data.groupId;
    clearChatDisplay();
    updateCurrentGroupLabel();

});

// Server confirms we joined a group
// Loads all the group's historical messages
socket.on('group_joined', function(data) {

    currentGroupId = data.groupId;
    clearChatDisplay();
    updateCurrentGroupLabel();
    // Add all the historical messages from this group
    (data.messages || []).forEach(msg => {

        addMessageToChat(msg.username, msg.timestamp, msg.message);

    });

});

// Someone sent a message in the current group
// Only displays if it's for the group we're viewing
socket.on('group_message', function(data) {

    if (data.groupId === currentGroupId) {

        addMessageToChat(data.username, data.timestamp, data.message);

    }

});

// Someone cleared the history of the current group
// Removes all messages from display (group stays)
socket.on('group_history_cleared', function(data) {

    if (data.groupId === currentGroupId) {

        clearChatDisplay();

    }

});

// Someone cleared the global chat history
// Shouldn't affect users in a group they're in their own space
socket.on('global_history_cleared', function(data) {
    
    // Only clear the display if we're actually in the global lobby
    // If we're in a group, we don't want to lose our group messages
    if (!currentGroupId) {
        clearChatDisplay();
        console.log(`Global chat history cleared by ${data.clearedBy}`);
    }
});

// Current group got deleted
// Clears display and switches back to global lobby
socket.on('group_deleted', function(data) {

    if (data.groupId === currentGroupId) {

        clearChatDisplay();
        currentGroupId = null;
        updateCurrentGroupLabel();
        
    }

});

// Server confirms we left a group
// Safety check requests global history again just in case we missed it
socket.on('left_group', function(data) {

    if (data.status === 'ok') {

        // If user left while UI was already in lobby, ensure lobby history is present
        // This is like a safety net to make sure we have the latest global messages
        if (!currentGroupId) {

            socket.emit('request_global_history');

        }
        
    }

});

// When we first connect, the server sends us all the old messages
// This is like getting a history book of the conversation
socket.on('historical_messages', function(messages) {
    
    elements.chatMessages.innerHTML = ''; // Clear any old messages first
    loadedMessageCount = messages.length; // Update our count
    hasMoreMessages = messages.length >= 50; // Assume there might be more if we got 50+ messages
    
    messages.forEach(message => {         // Go through each old message
        addMessageToChat(message.username, message.timestamp, message.message); // And add it to the chat
    });
    
    // Show/hide load more button based on whether there might be more messages
    if (hasMoreMessages) {
        elements.loadMoreBtn.classList.remove('hidden');
    }
    
});

// When we request more messages, the server sends us paginated results
socket.on('paginated_messages', handleLoadMoreMessages);

// When someone clears the chat history, we need to clear our display too
socket.on('history_cleared', function(data) {
    
    clearChatDisplay();
    console.log(`Chat history cleared by ${data.clearedBy}`);
    
});

// When someone new joins the chat (we just log this for now, but we could show a notification)
socket.on('user_joined', function(data) {
    
    console.log(`User joined: ${data.username}`);
    
});

// When someone leaves the chat (we just log this for now, but we could show a notification)
socket.on('user_left', function(data) {
    
    console.log(`User left: ${data.username}`);
    
});

// When something goes wrong on the server
socket.on('error', function(data) {
    
    console.error('Server error:', data.message);
    
});

// Event Listeners
// ===============
// Listen for things the user does (clicking buttons, pressing keys)

// This runs when the page finishes loading
document.addEventListener('DOMContentLoaded', function() {
    
    // Hide the chat interface until the user picks a username
    elements.chatInterface.style.display = 'none';
    
    // Set up the username form when they submit it, run our handler
    elements.usernameForm.addEventListener('submit', handleUsernameSubmit);
    
    // Also handle the Enter key in the username input (some people prefer to press Enter)
    elements.usernameInput.addEventListener('keydown', function(event) {
        
        if (event.key === 'Enter') {
            
            event.preventDefault();
            handleUsernameSubmit(event);
            
        }
        
    });
    
    // Set up the message form when they submit it, run our handler
    elements.messageForm.addEventListener('submit', handleMessageSubmit);
    
    // Also handle the Enter key in the message input (but not Shift+Enter, that should make a new line)
    elements.messageInput.addEventListener('keydown', function(event) {
        
        if (event.key === 'Enter' && !event.shiftKey) {
            
            event.preventDefault();
            handleMessageSubmit(event);
            
        }
        
    });
    
    // Set up the load more messages button
    elements.loadMoreBtn.addEventListener('click', loadMoreMessages);
    
    // Set up the clear history button show confirmation modal
    elements.clearHistoryBtn.addEventListener('click', showClearConfirmation);
    
    // Set up the clear confirmation modal buttons
    elements.confirmClearBtn.addEventListener('click', handleClearHistory);
    elements.cancelClearBtn.addEventListener('click', hideClearConfirmation);

    // Set up the group control buttons these handle creating, joining, leaving, clearing, and deleting groups
    elements.createGroupBtn.addEventListener('click', handleCreateGroup);
    elements.joinGroupBtn.addEventListener('click', handleJoinGroup);
    elements.leaveGroupBtn.addEventListener('click', handleLeaveGroup);
    elements.clearGroupBtn.addEventListener('click', handleClearGroup);
    elements.deleteGroupBtn.addEventListener('click', handleDeleteGroup);
    
    // Close modal when clicking outside of it
    elements.clearConfirmationModal.addEventListener('click', function(event) {
        
        if (event.target === elements.clearConfirmationModal) {
            hideClearConfirmation();
        }
        
    });
    
    // Put the cursor in the username input so they can start typing immediately
    elements.usernameInput.focus();
    
});