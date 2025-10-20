// Chat Application - Main Client Logic
// =====================================
// This file handles everything that happens in the user's browser
// It's like the brain of the chat app. It manages the user interface,
// talks to the server, and makes sure everything works smoothly

// Socket.IO connection - our lifeline to the server
// This creates a real-time connection so we can send and receive messages instantly
// Think of it like a phone line that's always open between your browser and the server
const socket = io();

// Application state - keeping track of important information
// This is like our app's memory - it remembers things between different actions
let selectedUsername = null; // We'll store the user's chosen name here once they pick one
let loadedMessageCount = 0;  // How many messages we've loaded from the server
let hasMoreMessages = true;  // Whether there are more messages to load

// DOM Elements (cached for performance)
// Instead of searching for these elements every time we need them,
// we find them once and store them in this object for quick access
// This makes our app faster because we don't have to dig through the HTML every time
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
    cancelClearBtn: document.getElementById('cancel-clear')       // Cancel clear button
    
};

// Configuration - all the rules and settings for our app
// This is like a settings file - we put all our "magic numbers" and rules here
// so if we need to change something later, we only have to change it in one place
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
 * Validates username according to application rules
 * This function checks if a username is "good enough" to use
 * It's like a bouncer at a club - it decides who gets in and who doesn't
 * 
 * @param {string} username - The username the user wants to use
 * @returns {string|null} - If there's a problem, it returns an error message. If everything's fine, it returns null
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
 * When something goes wrong with the username (like it's already taken),
 * we need to tell the user what happened. This function makes the error visible.
 * 
 * @param {string} message - The error message we want to show the user
 */
function showUsernameError(message) {
    
    elements.usernameError.textContent = message;  // Put the error message in the error box
    elements.usernameError.classList.remove('hidden'); // Make the error box visible
    
}

/**
 * Hides username error message
 * When the user fixes their username or tries again, we hide any old error messages
 * This keeps the interface clean and not confusing
 */
function hideUsernameError() {
    
    elements.usernameError.classList.add('hidden'); // Hide the error box
    
}

/**
 * Formats timestamp for display
 * Timestamps are stored as dates, but we want to show them in a nice, human-readable format
 * This function decides whether to show just the time (if it's today) or the full date and time
 * 
 * @param {Date|string} timestamp - The timestamp we want to format
 * @returns {string} - A nicely formatted time string that humans can understand
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
// This section handles everything related to picking a username
// It's like the "getting to know you" part of the chat experience

/**
 * Handles username form submission
 * When the user clicks "Join Chat" or presses Enter, this function runs
 * It checks if their username is valid, and if so, sends it to the server
 * 
 * @param {Event} event - The form submit event (contains information about what happened)
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
 * When the server says "yes, that username is available", this function runs
 * It hides the username popup and shows the main chat interface
 * 
 * @param {Object} data - The server's response (contains the accepted username)
 */
function handleUsernameAccepted(data) {
    
    selectedUsername = data.username;                    // Remember the username for later
    elements.usernameModal.style.display = 'none';      // Hide the username popup
    elements.chatInterface.style.display = 'flex';      // Show the main chat area
    elements.messageInput.focus();                       // Put the cursor in the message box so they can start typing
    
}

/**
 * Handles username taken error from server
 * When the server says "sorry, someone else is already using that username", this function runs
 * It shows the error message so the user knows they need to pick a different name
 * 
 * @param {Object} data - The server's error response (contains the error message)
 */
function handleUsernameTaken(data) {
    
    showUsernameError(data.message); // Show the "username taken" message
    
}

// Message Handling
// ================
// This section handles everything related to sending and displaying messages
// It's like the "actual chatting" part of the chat experience

/**
 * Generates HTML for a chat message
 * When we receive a message, we need to turn it into HTML that looks nice
 * This function creates the HTML structure for displaying a single message
 * 
 * @param {string} username - Who sent the message
 * @param {Date|string} timestamp - When they sent it
 * @param {string} message - What they said
 * @returns {string} - A complete HTML string that we can add to the page
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
 * This function takes a message and actually puts it on the screen
 * It also scrolls to the bottom so users can see the newest message
 * 
 * @param {string} username - Who sent the message
 * @param {Date|string} timestamp - When they sent it
 * @param {string} message - What they said
 * @param {boolean} prepend - If true, adds message at the top (for loading older messages)
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
 * Loads more messages from the server
 * This function requests older messages when the user clicks "Load More"
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
 * This function processes the response when we request more messages
 * 
 * @param {Object} data - The server's response with messages and pagination info
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
 * This function displays a safety check before clearing all messages
 */
function showClearConfirmation() {
    
    elements.clearConfirmationModal.classList.remove('hidden');
    
}

/**
 * Hides the clear history confirmation modal
 * This function closes the confirmation dialog
 */
function hideClearConfirmation() {
    
    elements.clearConfirmationModal.classList.add('hidden');
    
}

/**
 * Clears all messages from the chat display
 * This function removes all messages from the screen
 */
function clearChatDisplay() {
    
    elements.chatMessages.innerHTML = '';
    loadedMessageCount = 0;
    hasMoreMessages = true;
    elements.loadMoreBtn.classList.add('hidden');
    
}

/**
 * Handles clearing chat history
 * This function sends the clear request to the server
 */
function handleClearHistory() {
    
    // Hide the confirmation modal
    hideClearConfirmation();
    
    // Send clear request to server
    socket.emit('clear_history');
    
}

/**
 * Handles sending a message
 * When the user clicks send or presses Enter, this function runs
 * It takes their message and sends it to the server
 * 
 * @param {Event} event - The form submit event
 */
function handleMessageSubmit(event) {
    
    event.preventDefault(); // Stop the form from trying to reload the page
    
    const message = elements.messageInput.value.trim(); // Get what they typed and remove extra spaces
    
    // Only send if there's actually a message and they've picked a username
    if (!message || !selectedUsername) return;
    
    // Send the message to the server with all the necessary information
    socket.emit('message', {
        
        username: selectedUsername,  // Who sent it (we use the stored username for security)
        message: message,            // What they said
        timestamp: new Date()        // When they sent it
        
    });
    
    elements.messageInput.value = ''; // Clear the input box so they can type their next message
    
}

// Socket Event Handlers
// =====================
// These functions listen for messages from the server
// Think of them as "mailboxes" - when the server sends us something, the right function picks it up

// When the server says "yes, your username is good to go"
socket.on('username_accepted', handleUsernameAccepted);

// When the server says "sorry, that username is already taken"
socket.on('username_taken', handleUsernameTaken);

// When someone sends a message (including ourselves)
socket.on('message', function(data) {
    
    addMessageToChat(data.username, data.timestamp, data.message);
    
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
// These functions listen for things the user does (like clicking buttons or pressing keys)
// They're like "listeners" that wait for specific actions and then do something in response

// This runs when the page finishes loading
document.addEventListener('DOMContentLoaded', function() {
    
    // Hide the chat interface until the user picks a username
    elements.chatInterface.style.display = 'none';
    
    // Set up the username form - when they submit it, run our handler
    elements.usernameForm.addEventListener('submit', handleUsernameSubmit);
    
    // Also handle the Enter key in the username input (some people prefer to press Enter)
    elements.usernameInput.addEventListener('keydown', function(event) {
        
        if (event.key === 'Enter') {
            
            event.preventDefault();
            handleUsernameSubmit(event);
            
        }
        
    });
    
    // Set up the message form - when they submit it, run our handler
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
    
    // Set up the clear history button - show confirmation modal
    elements.clearHistoryBtn.addEventListener('click', showClearConfirmation);
    
    // Set up the clear confirmation modal buttons
    elements.confirmClearBtn.addEventListener('click', handleClearHistory);
    elements.cancelClearBtn.addEventListener('click', hideClearConfirmation);
    
    // Close modal when clicking outside of it
    elements.clearConfirmationModal.addEventListener('click', function(event) {
        
        if (event.target === elements.clearConfirmationModal) {
            hideClearConfirmation();
        }
        
    });
    
    // Put the cursor in the username input so they can start typing immediately
    elements.usernameInput.focus();
    
});