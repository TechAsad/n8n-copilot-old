// script-old.js
const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

// Load messages from storage when the popup opens
async function loadMessages() {
    try {
        const result = await chrome.storage.local.get('chatHistory');
        if (result.chatHistory) {
            const messages = JSON.parse(result.chatHistory);
            messages.forEach(msg => {
                addMessage(msg.text, msg.isUser, false);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Save messages to storage
async function saveMessage(text, isUser) {
    try {
        const result = await chrome.storage.local.get('chatHistory');
        let messages = result.chatHistory ? JSON.parse(result.chatHistory) : [];
        messages.push({
            text,
            isUser,
            timestamp: new Date().toISOString()
        });
        await chrome.storage.local.set({
            chatHistory: JSON.stringify(messages)
        });
    } catch (error) {
        console.error('Error saving message:', error);
    }
}

function addMessage(text, isUser, save = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    if (save) {
        saveMessage(text, isUser);
    }
}

function addClearButton() {
    const header = document.querySelector('.chat-header');
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Chat';
    clearButton.style.float = 'right';
    clearButton.style.padding = '0.5rem';
    clearButton.style.marginTop = '-2.5rem';
    clearButton.addEventListener('click', clearChat);
    header.appendChild(clearButton);
}

async function clearChat() {
    try {
        await chrome.storage.local.remove('chatHistory');
        messagesDiv.innerHTML = '';
    } catch (error) {
        console.error('Error clearing chat:', error);
    }
}

async function captureTab() {
    return new Promise((resolve) => {
        chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
            const base64Image = dataUrl.replace(/^data:image\/png;base64,/, '');
            resolve(base64Image);
        });
    });
}

async function sendMessageToBackend(message, screenshot, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const data = {
                message: message,
                screenshot: {
                    type: 'image/png',
                    data: screenshot,
                    filename: `screenshot-${Date.now()}.png`
                }
            };

            const response = await fetch('https://n8n-5v15.onrender.com/webhook/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                timeout: 30000 // 30 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.text();
            try {
                return { reply: JSON.parse(responseData).message || JSON.parse(responseData).answer || responseData };
            } catch (e) {
                return { reply: responseData };
            }
        } catch (e) {
            console.error(`Attempt ${attempt} failed:`, e);
            if (attempt === retries) {
                throw new Error(`Failed after ${retries} attempts: ${e.message}`);
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

sendButton.addEventListener('click', async () => {
    const message = userInput.value;
    if (!message) return;
    
    // Disable input and button while processing
    userInput.disabled = true;
    sendButton.disabled = true;
    
    addMessage(message, true);
    userInput.value = '';
    
    try {
        // Add a "thinking" message
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message bot-message';
        thinkingDiv.textContent = 'Thinking...';
        messagesDiv.appendChild(thinkingDiv);
        
        const screenshot = await captureTab();
        const botResponse = await sendMessageToBackend(message, screenshot);
        
        // Remove thinking message
        messagesDiv.removeChild(thinkingDiv);
        
        // Add the actual response
        addMessage(botResponse.reply, false);
    } catch (error) {
        addMessage(`Error: ${error.message}`, false);
    } finally {
        // Re-enable input and button
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !userInput.disabled) {
        sendButton.click();
    }
});

// Initialize chat
document.addEventListener('DOMContentLoaded', () => {
    loadMessages();
    addClearButton();
});



