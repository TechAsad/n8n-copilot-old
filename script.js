// script-new.js

const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const newChatButton = document.getElementById('newChatButton');
const viewChatsButton = document.getElementById('viewChatsButton');
const chatList = document.getElementById('chatList');
const currentChatTitle = document.getElementById('currentChatTitle');

let currentChatId = null;
let isViewingChatList = false;

// Chat management functions
async function createNewChat() {
    const timestamp = new Date().toISOString();
    const chatId = `chat_${timestamp}`;
    
    try {
        const result = await chrome.storage.local.get('chats');
        const chats = result.chats || {};
        
        // Check if current chat is empty
        if (currentChatId && chats[currentChatId] && chats[currentChatId].messages.length === 0) {
            return; // Don't create new chat if current chat is empty
        }
        
        chats[chatId] = {
            id: chatId,
            title: `New Chat (${new Date().toLocaleString()})`,
            messages: [],
            created: timestamp
        };
        
        await chrome.storage.local.set({ chats });
        currentChatId = chatId;
        
        // Clear current messages and update UI
        messagesDiv.innerHTML = '';
        updateChatTitle(chats[chatId].title);
        
        if (isViewingChatList) {
            await showChatList();
        } else {
            chatList.classList.remove('visible');
        }
        
    } catch (error) {
        console.error('Error creating new chat:', error);
    }
}

async function deleteChat(chatId, event) {
    event.stopPropagation();
    
    try {
        const result = await chrome.storage.local.get('chats');
        const chats = result.chats || {};
        
        delete chats[chatId];
        await chrome.storage.local.set({ chats });
        
        // If we're deleting the current chat
        if (chatId === currentChatId) {
            currentChatId = null;
            messagesDiv.innerHTML = '';
            updateChatTitle('');
        }
        
        // Refresh chat list while keeping it visible
        await showChatList();
        
        // If this was the last chat, create a new one but keep chat list visible
        const remainingChats = Object.keys(chats);
        if (remainingChats.length === 0) {
            isViewingChatList = true; // Maintain chat list visibility
            await createNewChat();
        }
    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}



async function loadChat(chatId) {
    try {
        const result = await chrome.storage.local.get('chats');
        const chats = result.chats || {};
        const chat = chats[chatId];
        
        if (chat) {
            currentChatId = chatId;
            messagesDiv.innerHTML = '';
            chat.messages.forEach(msg => {
                addMessage(msg.text, msg.isUser, false);
            });
            updateChatTitle(chat.title);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            isViewingChatList = false;
            chatList.classList.remove('visible');
        }
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

async function getChatHistory(chatId) {
    try {
        const result = await chrome.storage.local.get('chats');
        const chats = result.chats || {};
        const chat = chats[chatId];
        
        if (chat) {
            // Get last 20 messages
            const lastMessages = chat.messages.slice(-20);
            return {
                chatId: chat.id,
                messages: lastMessages.map(msg => ({
                    text: msg.text,
                    isUser: msg.isUser,
                    timestamp: msg.timestamp
                }))
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting chat history:', error);
        return null;
    }
}



// Add message save function with retry mechanism
async function saveMessage(text, isUser, retryCount = 3) {
    if (!currentChatId) return;
    
    try {
        const result = await chrome.storage.local.get('chats');
        const chats = result.chats || {};
        const chat = chats[currentChatId];
        
        if (chat) {
            chat.messages.push({
                text,
                isUser,
                timestamp: new Date().toISOString()
            });
            
            // Update chat title with first user message
            if (isUser && chat.messages.filter(m => m.isUser).length === 1) {
                chat.title = `${text.substring(0, 30)}${text.length > 30 ? '...' : ''} (${new Date().toLocaleString()})`;
                updateChatTitle(chat.title);
            }
            
            try {
                await chrome.storage.local.set({ chats });
            } catch (error) {
                if (retryCount > 0) {
                    console.log(`Retrying save message... (${retryCount} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await saveMessage(text, isUser, retryCount - 1);
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error('Error saving message:', error);
        addMessage('Error saving message. Please try again.', false, false);
    }
}




async function showChatList() {
    try {
        const result = await chrome.storage.local.get('chats');
        const chats = result.chats || {};
        
        chatList.innerHTML = '';
        
        if (Object.keys(chats).length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-chat-message';
            emptyMessage.textContent = 'No chats yet';
            chatList.appendChild(emptyMessage);
        } else {
            Object.values(chats)
                .sort((a, b) => new Date(b.created) - new Date(a.created))
                .forEach(chat => {
                    const chatItem = document.createElement('div');
                    chatItem.className = 'chat-item';
                    
                    const chatTitle = document.createElement('div');
                    chatTitle.className = 'chat-item-title';
                    chatTitle.textContent = chat.title;
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-chat-btn';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.title = 'Delete chat';
                    deleteBtn.onclick = (e) => deleteChat(chat.id, e);
                    
                    chatItem.appendChild(chatTitle);
                    chatItem.appendChild(deleteBtn);
                    
                    chatItem.addEventListener('click', () => {
                        loadChat(chat.id);
                    });
                    
                    chatList.appendChild(chatItem);
                });
        }
        
        chatList.classList.add('visible');
        isViewingChatList = true;
    } catch (error) {
        console.error('Error loading chat list:', error);
    }
}

function updateChatTitle(title) {
    currentChatTitle.textContent = title;
}

function addMessage(text, isUser, save = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    const messageText = document.createElement('div');
    messageText.textContent = text;
    messageDiv.appendChild(messageText);
    
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(timestamp);
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    if (save) {
        saveMessage(text, isUser);
    }
}

// Event listeners
newChatButton.addEventListener('click', createNewChat);
viewChatsButton.addEventListener('click', showChatList);


userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !userInput.disabled) {
        sendButton.click();
    }
});




async function captureTab() {
    try {
        // Get the active tab in the current window
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            console.log('No active tab found');
            return null;
        }

        return new Promise((resolve) => {
            chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: 'png' },
                (dataUrl) => {
                    if (chrome.runtime.lastError) {
                        // Log the specific error message
                        console.error('Screenshot error details:', {
                            message: chrome.runtime.lastError.message,
                            stack: new Error().stack
                        });
                        
                        // Check for specific error conditions
                        if (chrome.runtime.lastError.message.includes('permission')) {
                            addMessage("Screenshot failed: Permission denied. Please ensure the extension has the necessary permissions.", false);
                        } else if (chrome.runtime.lastError.message.includes('internal')) {
                            addMessage("Screenshot failed: Internal browser error. Please try again.", false);
                        } else {
                            addMessage(`Screenshot failed: ${chrome.runtime.lastError.message}`, false);
                        }
                        
                        resolve(null);
                        return;
                    }
                    
                    if (!dataUrl) {
                        console.log('No screenshot data received');
                        resolve(null);
                        return;
                    }

                    try {
                        const base64Image = dataUrl.replace(/^data:image\/png;base64,/, '');
                        resolve(base64Image);
                    } catch (error) {
                        console.error('Error processing screenshot:', error);
                        addMessage("Error processing screenshot. Continuing without it.", false);
                        resolve(null);
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error capturing tab:', {
            error: error,
            message: error.message,
            stack: error.stack
        });
        addMessage("Failed to capture screenshot. Continuing without it.", false);
        return null;
    }
}


async function sendMessageToBackend(message, screenshot) {
    try {
        const chatHistory = await getChatHistory(currentChatId);
        
        const data = {
            message: message,
            chatId: currentChatId,
            chatHistory: chatHistory ? chatHistory.messages : []
        };

        // Only add screenshot if it was successfully captured
        if (screenshot) {
            data.screenshot = {
                type: 'image/png',
                data: screenshot,
                filename: `screenshot-${Date.now()}.png`
            };
        }

        const response = await fetch('https://n8n-5v15.onrender.com/webhook/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.text();
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseData);
        } catch (e) {
            return { reply: responseData };
        }

        return { reply: parsedResponse.message || parsedResponse.answer || parsedResponse };
    } catch (e) {
        console.error('Error:', e);
        return { reply: `Error: ${e.message}` };
    }
}

// Updated send button event listener with better error handling
sendButton.addEventListener('click', async () => {
    const message = userInput.value.trim();
    if (!message) return;
    
    userInput.disabled = true;
    sendButton.disabled = true;
    
    addMessage(message, true);
    userInput.value = '';
    
    try {
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message bot-message';
        thinkingDiv.textContent = 'Thinking...';
        messagesDiv.appendChild(thinkingDiv);
        
        let screenshot = null;
        try {
            screenshot = await captureTab();
        } catch (screenshotError) {
            console.error('Screenshot capture failed:', screenshotError);
            // Continue without screenshot
        }
        
        const botResponse = await sendMessageToBackend(message, screenshot);
        
        messagesDiv.removeChild(thinkingDiv);
        addMessage(botResponse.reply, false);
    } catch (error) {
        console.error('Error in message processing:', {
            error: error,
            message: error.message,
            stack: error.stack
        });
        addMessage(`Error: ${error.message}. Please try again.`, false);
    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }
});

// Add this function to check tab permissions
async function checkTabPermissions() {
    try {
        const permissions = {
            permissions: ['activeTab', 'tabs'],
            origins: ['<all_urls>']
        };
        
        const hasPermissions = await chrome.permissions.contains(permissions);
        console.log('Tab permissions status:', hasPermissions);
        
        if (!hasPermissions) {
            console.warn('Missing required permissions for screenshots');
            addMessage("Note: Some permissions are missing. Screenshots may not work properly.", false);
        }
    } catch (error) {
        console.error('Error checking permissions:', error);
    }
}

// Call this when the extension loads
document.addEventListener('DOMContentLoaded', async () => {
    await checkTabPermissions();
    
    // Rest of your initialization code...
    const result = await chrome.storage.local.get('chats');
    const chats = result.chats || {};
    
    if (Object.keys(chats).length === 0) {
        await createNewChat();
    } else {
        const mostRecentChat = Object.values(chats)
            .sort((a, b) => new Date(b.created) - new Date(a.created))[0];
        await loadChat(mostRecentChat.id);
    }
});