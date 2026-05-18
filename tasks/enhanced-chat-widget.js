// Enhanced Learning Platform Chat Widget v3.0.0 - With Dual Backend Support
// Integrates with ChatService abstraction layer

class EnhancedChatWidget {
  constructor() {
    this.config = window.CHAT_WIDGET_CONFIG || {};
    this.sessionId = null;
    this.isInitialized = false;
    this.messageHistory = [];
    this.isTyping = false;
    this.currentTopic = 'general';
    this.currentContext = 'general';
    this.learnerData = {};
    this.contextData = null;
    this.currentSubConceptId = null; // Track current sub-concept for greeting
  }

  async initChatWidget(options = {}) {
    this.currentTopic = options.topic || 'general';
    this.currentContext = options.context || 'general';
    this.learnerData = options.learnerData || {};
    this.contextData = options.contextData || null;

    if (!this.isInitialized) {
      this.createUI();
      this.isInitialized = true;
    }

    // Always ensure trigger exists (it might have been removed during navigation)
    this.createTrigger();

    // Load conversation history if ChatService is available
    await this.loadConversationHistory();

    this.showChat();

    if (options.initialMessage) {
      this.sendMessage(options.initialMessage, true);
    }
  }

  createUI() {
    // Remove any existing chat widget
    const existing = document.getElementById('chat-widget');
    if (existing) existing.remove();

    // Add skip link for accessibility
    const skipLink = document.createElement('a');
    skipLink.href = '#chat-input';
    skipLink.className = 'skip-to-chat';
    skipLink.textContent = 'Skip to chat input';
    document.body.appendChild(skipLink);

    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-widget';
    chatContainer.innerHTML = `
      <div class="chat-header">
        <h3>Learning Assistant</h3>
        <button onclick="window.chatWidget.hideChat()" title="Close chat" aria-label="Close chat">×</button>
      </div>
      <div id="chat-messages" class="chat-messages" aria-live="polite" aria-label="Chat messages"></div>
      <div class="chat-input-container">
        <input type="text" id="chat-input" placeholder="Ask your question..." rows="1" aria-label="Type your message">
        <button onclick="window.chatWidget.sendMessage()" id="chat-send" title="Send message" aria-label="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 12L21 3L14 21L11 13L3 12Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(chatContainer);

    // Add event listeners
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize input
    chatInput.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
    });

    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not typing in input fields
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      );

      // Escape to close chat
      if (e.key === 'Escape') {
        if (this.isChatOpen()) {
          this.hideChat();
        }
      }

      // Ctrl/Cmd + K to open chat (when not typing)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !isInputFocused) {
        e.preventDefault();
        if (!this.isChatOpen()) {
          this.showChat();
          // Focus input after opening
          setTimeout(() => {
            document.getElementById('chat-input')?.focus();
          }, 400);
        }
      }

      // Ctrl/Cmd + / to focus input (when chat is open)
      if ((e.ctrlKey || e.metaKey) && e.key === '/' && this.isChatOpen()) {
        e.preventDefault();
        document.getElementById('chat-input')?.focus();
      }

      // Up arrow when input is focused and empty to navigate history
      if (e.key === 'ArrowUp' && !isInputFocused && this.isChatOpen()) {
        e.preventDefault();
        document.getElementById('chat-input')?.focus();
      }
    });
  }

  isChatOpen() {
    const chatWidget = document.getElementById('chat-widget');
    return chatWidget && chatWidget.classList.contains('open');
  }

  createTrigger() {
    // Remove existing trigger
    const existing = document.querySelector('.chat-trigger');
    if (existing) existing.remove();

    const trigger = document.createElement('button');
    trigger.className = 'chat-trigger';
    trigger.title = 'Open Learning Assistant';
    trigger.setAttribute('aria-label', 'Open Learning Assistant');
    trigger.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M20 2H4C2.895 2 2 2.895 2 4V22L6 18H20C21.105 18 22 17.105 22 16V4C22 2.895 21.105 2 20 2Z" fill="currentColor"/>
      </svg>`;
    trigger.onclick = () => this.showChat();

    document.body.appendChild(trigger);
  }

  async sendMessage(message = null, isFirst = false) {
    const input = document.getElementById('chat-input');
    const messageText = message || input.value.trim();
    
    if (!messageText) return;
    
    if (!message) {
      input.value = '';
      input.style.height = 'auto';
    }
    
    this.addMessage('user', messageText);
    this.showTyping();
    
    try {
      // Check if ChatService is available
      if (!window.chatService) {
        throw new Error('ChatService not available');
      }
      
      // Determine context: use initial context for first message, then switch to general
      let contextForMessage = this.currentContext;
      if (!isFirst && (this.currentContext === 'learn_more' || this.currentContext === 'quiz_failed')) {
        contextForMessage = 'general';
        console.log(`Context switched from '${this.currentContext}' to 'general' for follow-up message`);
      }
      
      const response = await window.chatService.sendMessage(
        messageText,
        contextForMessage,
        this.learnerData
      );

      // Store session ID
      if (response.sessionId) {
        this.sessionId = response.sessionId;
        window.chatService.setSessionId(response.sessionId);
      }

      // Add message with hideTypingBefore=true to hide typing before adding message
      this.addMessage('assistant', response.reply, true, true);
      
      // Log additional info if available
      if (response.sources && response.sources.length > 0) {
        console.log('Sources:', response.sources);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      // Add error message with hideTypingBefore=true
      this.addMessage('assistant', "I'm sorry, I'm having trouble connecting. Please try again in a moment.", true, true);
    }
  }

  async loadConversationHistory() {
    if (!window.chatService || !this.learnerData) {
      console.log('Cannot load history: ChatService or learnerData not available');
      return;
    }

    try {
      const history = await window.chatService.loadHistory(this.learnerData);

      if (history && history.messages && history.messages.length > 0) {
        console.log(`Restoring ${history.totalMessages} messages from history`);

        // Clear any existing messages first
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
          messagesContainer.innerHTML = '';
        }
        this.messageHistory = [];

        // Restore existing messages with their original timestamps
        history.messages.forEach(msg => {
          this.addMessageWithTimestamp(msg.role, msg.content, msg.timestamp || new Date(), false);
        });

        // Store session ID
        if (history.sessionId) {
          this.sessionId = history.sessionId;
          window.chatService.setSessionId(history.sessionId);
        }

        console.log(`Successfully restored ${history.messages.length} messages`);
      } else {
        console.log('No existing conversation history found');
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  }

  
  addMessage(sender, text, saveToHistory = true, hideTypingBefore = false) {
    return this.addMessageWithTimestamp(sender, text, new Date(), saveToHistory, hideTypingBefore);
  }

  addMessageWithTimestamp(sender, text, timestamp, saveToHistory = true, hideTypingBefore = false) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    // Hide typing indicator immediately if requested
    if (hideTypingBefore) {
      this.hideTyping();
    }

    // Create message object
    const message = {
      role: sender,
      content: text,
      timestamp: timestamp,
      isLocal: false // Regular messages are not local
    };

    // Create and append message element
    const messageDiv = this.createMessageElement(message);

    // Add timestamp for tracking
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.setAttribute('data-timestamp', timestamp.toISOString());
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Store in history
    if (saveToHistory) {
      this.messageHistory.push({ sender, text, timestamp: timestamp });
    }
  }

  formatMessage(text) {
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 1) Code fences to HTML blocks first
    const renderCodeFences = (s) => s.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${escapeHtml(code.trim())}</code></pre>`);

    // 2) Markdown tables to HTML blocks
    const renderTables = (s) => {
      const lines = s.split('\n');
      const out = [];
      let i = 0;
      while (i < lines.length) {
        const header = lines[i] || '';
        const sep = lines[i + 1] || '';
        const isHeader = /\|/.test(header) && /^\s*\|?\s*(:?-{3,}:?\s*\|\s*)+(:?-{3,}:?)?\s*\|?\s*$/.test(sep);
        if (isHeader) {
          const headerCells = header.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
          i += 2;
          const rows = [];
          while (i < lines.length && /\|/.test(lines[i])) {
            const rowCells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
            rows.push(rowCells);
            i++;
          }
          let html = '<div class="table-wrapper"><table class="md-table"><thead><tr>';
          headerCells.forEach(h => { html += `<th>${escapeHtml(h)}</th>`; });
          html += '</tr></thead><tbody>';
          rows.forEach(r => { html += '<tr>' + r.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>'; });
          html += '</tbody></table></div>';
          out.push(html);
          continue;
        }
        out.push(lines[i]);
        i++;
      }
      return out.join('\n');
    };

    const renderInline = (s) => s
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1<\/a>');

    // 3) Block renderer that preserves previously generated HTML blocks
    const renderBlocks = (s) => {
      const blocks = s.split(/\n\n+/);
      const out = [];
      for (let b of blocks) {
        const trimmed = b.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('<pre') || trimmed.startsWith('<div class="table-wrapper"')) {
          out.push(trimmed);
          continue;
        }
        // Handle lists: allow optional blank lines inside the block
        const lines = trimmed.split('\n');
        const listLines = lines.filter(l => /^\s*[-*•]\s+\S/.test(l));
        if (listLines.length > 0 && listLines.length >= lines.length - 1) {
          const items = lines
            .filter(l => /^\s*[-*•]\s+\S/.test(l))
            .map(l => l.replace(/^\s*[-*•]\s+/, ''));
          out.push('<ul>' + items.map(it => `<li>${renderInline(escapeHtml(it))}</li>`).join('') + '</ul>');
          continue;
        }
        // Heuristic: convert multiple "Term: description" lines into a bullet list
        const termDescMatches = lines
          .map(l => l.match(/^\s*([^:]{2,80}):\s+(.+)$/))
          .filter(m => !!m);
        if (termDescMatches.length >= 3 && termDescMatches.length >= Math.floor(lines.length * 0.6)) {
          const items = lines
            .map(l => l.match(/^\s*([^:]{2,80}):\s+(.+)$/))
            .filter(m => !!m)
            .map(m => `<li><strong>${renderInline(escapeHtml(m[1]))}:</strong> ${renderInline(escapeHtml(m[2]))}</li>`);
          out.push('<ul>' + items.join('') + '</ul>');
          continue;
        }
        // Headings (single-line)
        if (/^#{1,6} \S/.test(trimmed)) {
          const level = (trimmed.match(/^#+/)[0] || '#').length;
          out.push(`<h${level}>${renderInline(escapeHtml(trimmed.replace(/^#+\s*/, '')))}</h${level}>`);
          continue;
        }
        // Paragraph: join lines with a space to avoid large gaps
        out.push(`<p>${renderInline(escapeHtml(lines.join(' ')))}</p>`);
      }
      return out.join('');
    };

    let processed = String(text || '');
    processed = renderCodeFences(processed);
    processed = renderTables(processed);
    processed = renderBlocks(processed);
    return processed;
  }

  showTyping() {
    if (this.isTyping) return;

    this.isTyping = true;
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant-message typing-message';
    typingDiv.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTyping() {
    this.isTyping = false;
    const typingMessage = document.querySelector('.typing-message');
    if (typingMessage) {
      typingMessage.remove();
    }
  }

  showChat() {
    const chatWidget = document.getElementById('chat-widget');
    if (chatWidget) {
      chatWidget.classList.add('open');
      document.body.classList.add('chat-open');
      
      // Focus input when opening
      setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) input.focus();
      }, 300);
      
      // Fire custom event
      window.dispatchEvent(new CustomEvent('chatOpened'));
    }
  }

  hideChat() {
    const chatWidget = document.getElementById('chat-widget');
    if (chatWidget) {
      chatWidget.classList.remove('open');
      document.body.classList.remove('chat-open');
      
      // Fire custom event
      window.dispatchEvent(new CustomEvent('chatClosed'));
    }
  }

  clearChat() {
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }
    this.messageHistory = [];
    this.sessionId = null;
    localStorage.removeItem('chat_session_id');
  }

  // New initialization method for greeting mode
  async initChatWidgetWithGreeting(options = {}) {
    // Standard initialization without initial message
    await this.initChatWidget({ ...options, initialMessage: null });

    // Handle greeting after loading history
    this.handleGreetingForCurrentSubConcept();
  }

  // Handle greeting logic - temporary greeting approach
  handleGreetingForCurrentSubConcept() {
    console.log('Greeting handler called');
    const currentPage = window.paginationSystem?.getCurrentPage();

    if (!currentPage) {
      console.warn('No current page found');
      return;
    }

    if (currentPage.type !== 'sub-concept') {
      console.warn('Current page is not a sub-concept:', currentPage.type);
      return;
    }

    const subConceptId = currentPage.data.subConcept.id;

    // Remove any existing greeting from DOM (temporary approach)
    this.removeGreetingFromDOM();

    // Check if greeting already exists for this sub-concept in current session
    if (this.currentSubConceptId === subConceptId) {
      console.log('Greeting already shown for this sub-concept in current session');
      return;
    }

    // Create and add new greeting
    this.addTemporaryGreeting(currentPage.data, subConceptId);
    this.currentSubConceptId = subConceptId;
  }

  // Add temporary greeting that stays only for current sub-concept
  addTemporaryGreeting(pageData, subConceptId) {
    console.log(`Adding temporary greeting for sub-concept: ${subConceptId}`);
    const { concept, subConcept } = pageData;

    // Get learner name from learner data
    const learnerName = this.learnerData?.name || 'there';

    const greetingText = `Hello **${learnerName}**!\n\nI'm here to help you with **${subConcept.title}** from the **${concept.title}** topic. What would you like to explore?`;

    // Create greeting message
    const greetingMessage = {
      id: `temp-greeting-${subConceptId}-${Date.now()}`,
      type: 'greeting',
      role: 'assistant',
      content: greetingText,
      subConceptId: subConceptId,
      timestamp: new Date(),
      isLocal: true // Flag to prevent saving
    };

    // Add to DOM at the bottom (after all messages)
    this.addTemporaryGreetingToDOM(greetingMessage);
  }

  // Remove existing greeting from DOM
  removeGreetingFromDOM() {
    const existingGreeting = document.querySelector('.chat-message[data-message-type="greeting"]');
    if (existingGreeting) {
      console.log('Removing existing greeting from DOM');
      existingGreeting.remove();
    }
    // Also remove suggestion cards
    const suggestionCards = document.querySelector('.suggestion-cards-container');
    if (suggestionCards) {
      suggestionCards.remove();
    }
  }

  // Add suggestion cards based on sub-concept
  addSuggestionCards(subConceptId) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    // Define suggestion questions for different types of content
    const suggestions = [
      "What are some practical examples of this topic?",
      "How does this relate to real-world applications?",
      "Can you break this down into simpler terms?",
      "What should I focus on to understand this better?"
    ];

    // Create suggestion cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'suggestion-cards-container';
    cardsContainer.innerHTML = `
      <div class="suggestion-cards-grid">
        ${suggestions.map((suggestion, index) => `
          <div class="suggestion-card" data-suggestion="${suggestion}">
            <div class="card-arrow">
              <i class="fas fa-arrow-right"></i>
            </div>
            <div class="card-text">${suggestion}</div>
          </div>
        `).join('')}
      </div>
    `;

    messagesContainer.appendChild(cardsContainer);

    // Add click handlers to cards
    cardsContainer.querySelectorAll('.suggestion-card').forEach(card => {
      card.addEventListener('click', () => {
        const suggestion = card.getAttribute('data-suggestion');
        this.sendMessage(suggestion);

        // Remove cards after clicking
        cardsContainer.remove();
      });
    });
  }

  // Add temporary greeting to DOM
  addTemporaryGreetingToDOM(greetingMessage) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) {
      console.error('Messages container not found');
      return;
    }

    // Create and append greeting element
    const messageElement = this.createMessageElement(greetingMessage);
    messagesContainer.appendChild(messageElement);

    // Add suggestion cards after the greeting
    this.addSuggestionCards(greetingMessage.subConceptId);

    // Scroll to show the greeting
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
  }

  
  
  // Create message element with support for greeting type
  createMessageElement(message) {
    const messageDiv = document.createElement('div');
    const messageClass = message.type === 'greeting' ? 'greeting' : '';
    messageDiv.className = `chat-message ${message.role}-message ${messageClass}`;
    messageDiv.setAttribute('data-message-id', message.id || '');
    messageDiv.setAttribute('data-message-type', message.type || 'regular');
    if (message.type === 'greeting') {
      messageDiv.setAttribute('data-greeting-for', message.subConceptId);
    }
    messageDiv.innerHTML = `<div class="message-content">${this.formatMessage(message.content)}</div>`;
    return messageDiv;
  }

  
  // Get current widget state
  getState() {
    return {
      isInitialized: this.isInitialized,
      currentTopic: this.currentTopic,
      currentContext: this.currentContext,
      learnerData: this.learnerData,
      sessionId: this.sessionId,
      messageCount: this.messageHistory.length,
      currentSubConceptId: this.currentSubConceptId
    };
  }
}

// Create global instance
window.chatWidget = new EnhancedChatWidget();

console.log('Enhanced Chat Widget loaded successfully');