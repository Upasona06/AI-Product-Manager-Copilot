import React, { useState, useEffect, useRef, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {
  Send,
  Paperclip,
  Trash2,
  Bot,
  User,
  Sparkles,
  X,
  FileText,
  HelpCircle,
  ArrowRight,
  Plus,
  MessageSquare,
  Clock
} from 'lucide-react';

const AssistantPage = () => {
  const { user } = useContext(AuthContext);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Active conversation state
  const [currentChatId, setCurrentChatId] = useState(null);
  const [currentChatTitle, setCurrentChatTitle] = useState('New Conversation');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I'm your AI Product Manager Assistant. I can help analyze customer feedback, prioritize features, estimate business impact, generate product insights, and answer product management questions.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);

  // History list state
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Suggested Prompts
  const suggestedPrompts = [
    "Summarize customer feedback",
    "Prioritize backlog",
    "Predict business impact",
    "Generate product roadmap",
    "Analyze feature requests"
  ];

  // Fetch saved chat sessions from PostgreSQL database
  const fetchHistory = async () => {
    if (!user || !user.project_id) return;
    try {
      setLoadingHistory(true);
      const res = await api.get(`/api/assistant/history?project_id=${user.project_id}`);
      if (res.data.success) {
        setHistoryList(res.data.chats || []);
      }
    } catch (err) {
      console.error("Failed to load assistant chat history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Start a brand new conversation
  const handleStartNewChat = () => {
    setCurrentChatId(null);
    setCurrentChatTitle('New Conversation');
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: "Hello! I'm your AI Product Manager Assistant. I can help analyze customer feedback, prioritize features, estimate business impact, generate product insights, and answer product management questions.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setInputText('');
    setAttachedFile(null);
  };

  // Load a saved chat session from database
  const handleSelectChat = async (chatId) => {
    if (chatId === currentChatId) return;

    try {
      const res = await api.get(`/api/assistant/history/${chatId}?project_id=${user.project_id}`);
      if (res.data.success && res.data.chat) {
        setCurrentChatId(res.data.chat.chat_id);
        setCurrentChatTitle(res.data.chat.title || 'Conversation');
        setMessages(res.data.chat.messages || []);
      }
    } catch (err) {
      console.error("Failed to load chat session:", err);
    }
  };

  // Delete a chat session from database
  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat conversation?")) return;

    try {
      const res = await api.delete(`/api/assistant/history/${chatId}`);
      if (res.data.success) {
        if (currentChatId === chatId) {
          handleStartNewChat();
        }
        fetchHistory();
      }
    } catch (err) {
      console.error("Failed to delete chat session:", err);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() && !attachedFile) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Construct User Message
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      file: attachedFile ? attachedFile.name : null,
      timestamp: nowTime
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setAttachedFile(null);
    setIsTyping(true);

    try {
      const response = await api.post('/api/assistant/chat', {
        message: query,
        chat_id: currentChatId,
        project_id: user?.project_id,
        file: userMsg.file
      });

      if (response.data.success) {
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: response.data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, aiMsg]);

        // If a new chat session was created, update state and refresh history
        if (response.data.chat_id) {
          setCurrentChatId(response.data.chat_id);
          if (response.data.title) {
            setCurrentChatTitle(response.data.title);
          }
          fetchHistory();
        }
      } else {
        throw new Error(response.data.error || "Failed to get AI response.");
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      const backendError = resData
        ? `${resData.error || ""}${resData.details ? " Details: " + resData.details : ""}`
        : err.message || "Unknown error";
      const errorMsg = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `Sorry, I encountered an error: ${backendError}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Preset User Message click handler
  const handleExampleQuery = () => {
    handleSendMessage("What are the top 3 features requested by users?");
  };

  // Attach File Action
  const handleAttachFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="page-layout assistant-page-container">
      
      {/* Header Section */}
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div className="header-meta">
          <h1>💬 AI Product Manager Assistant</h1>
          <p>Real-time conversational intelligence connected to your customer feedback database with persistent history.</p>
        </div>
      </div>

      <div className="assistant-split-layout">
        
        {/* Left Column: Chat History Sidebar */}
        <aside className="assistant-history-sidebar glass-panel-premium">
          <div className="history-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} color="#c084fc" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Saved Chats ({historyList.length})</h3>
            </div>
            <button
              onClick={handleStartNewChat}
              className="new-chat-action-btn"
              title="Start a new conversation"
            >
              <Plus size={15} />
              <span>New Chat</span>
            </button>
          </div>

          <hr style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '0.75rem 0 1rem 0' }} />

          {/* History List */}
          <div className="history-sessions-list">
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <p>Loading conversation history...</p>
              </div>
            ) : historyList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <MessageSquare size={28} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p style={{ fontSize: '0.85rem', margin: 0 }}>No saved chats yet.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>Ask a question on the right to start your first session.</p>
              </div>
            ) : (
              historyList.map((chat) => {
                const isActive = chat.chat_id === currentChatId;
                return (
                  <div
                    key={chat.chat_id}
                    onClick={() => handleSelectChat(chat.chat_id)}
                    className={`history-session-card ${isActive ? 'active-session-card' : ''}`}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong className="session-card-title">{chat.title || 'Conversation'}</strong>
                      {chat.last_preview && (
                        <p className="session-card-preview">{chat.last_preview}</p>
                      )}
                      <div className="session-card-meta">
                        <span><Clock size={11} style={{ display: 'inline', marginRight: '3px' }} /> {new Date(chat.updated_at || chat.created_at).toLocaleDateString()}</span>
                        <span className="session-count-badge">{chat.message_count || 0} msgs</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteChat(chat.chat_id, e)}
                      className="session-delete-btn"
                      title="Delete Conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Chat Feed & Controls */}
        <main className="assistant-chat-main glass-panel-premium">
          
          {/* Active Chat Header */}
          <div className="chat-main-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="active-bot-badge">
                <Bot size={18} color="#fff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentChatTitle}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                  Gemini Tool-Calling Live Database Mode
                </span>
              </div>
            </div>

            <button
              onClick={handleStartNewChat}
              className="chat-clear-btn"
              title="Reset conversation"
            >
              <Plus size={14} />
              <span>New Session</span>
            </button>
          </div>

          {/* Chat Feed */}
          <div className="chat-feed-box">
            <div className="chat-scroll-viewport">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-bubble-row ${msg.sender === 'user' ? 'align-right' : 'align-left'}`}
                >
                  {/* Bot Avatar */}
                  {msg.sender === 'ai' && (
                    <div className="bubble-avatar avatar-bot">
                      <Bot size={18} color="#ffffff" />
                    </div>
                  )}

                  {/* Bubble Container */}
                  <div className={`chat-message-bubble ${msg.sender === 'user' ? 'bubble-style-user' : 'bubble-style-ai'}`}>
                    {/* File preview badge */}
                    {msg.file && (
                      <div className="bubble-attachment-badge">
                        <FileText size={13} />
                        <span className="bubble-attachment-name">{msg.file}</span>
                      </div>
                    )}

                    {/* Message body */}
                    <div className="bubble-body-text">
                      {msg.sender === 'ai' ? (
                        <MarkdownRenderer content={msg.text} />
                      ) : (
                        <span>{msg.text}</span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="bubble-timestamp">{msg.timestamp}</span>
                  </div>

                  {/* User Avatar */}
                  {msg.sender === 'user' && (
                    <div className="bubble-avatar avatar-user">
                      <User size={18} color="#ffffff" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Loader Indicator */}
              {isTyping && (
                <div className="chat-bubble-row align-left">
                  <div className="bubble-avatar avatar-bot">
                    <Bot size={18} color="#ffffff" />
                  </div>
                  <div className="chat-message-bubble bubble-style-ai loading-bubble">
                    <div className="typing-loader-dots">
                      <span className="loading-dot-pulse"></span>
                      <span className="loading-dot-pulse"></span>
                      <span className="loading-dot-pulse"></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Prompts Grid */}
              {messages.length === 1 && !isTyping && (
                <div className="welcome-prompt-suggestions-grid">
                  
                  {/* Demo Card */}
                  <div className="prompt-card highlight-card" onClick={handleExampleQuery}>
                    <div className="prompt-card-meta">
                      <HelpCircle size={16} color="#c084fc" />
                      <span className="card-badge">Demo Query</span>
                    </div>
                    <h4 className="prompt-card-title">"What are the top 3 features requested by users?"</h4>
                    <p className="prompt-card-description">Queries PostgreSQL feedback database and summarizes top customer requests.</p>
                    <div className="prompt-card-action">
                      <span>Run Query</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>

                  {/* Standard Suggested Cards */}
                  {suggestedPrompts.map((prompt, idx) => (
                    <div key={idx} className="prompt-card" onClick={() => setInputText(prompt)}>
                      <div className="prompt-card-meta">
                        <Sparkles size={14} color="#a78bfa" />
                        <span className="card-badge">Quick Prompt</span>
                      </div>
                      <h4 className="prompt-card-title">{prompt}</h4>
                      <p className="prompt-card-description">Generate instant insights relating to "{prompt.toLowerCase()}".</p>
                      <div className="prompt-card-action">
                        <span>Fill input</span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  ))}

                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Sticky Input Bar */}
          <footer className="chat-input-sticky-panel">
            <div className="input-inner-wrapper">
              
              {/* Attachment preview capsule */}
              {attachedFile && (
                <div className="chat-input-attachment-preview">
                  <div className="attachment-preview-badge">
                    <FileText size={14} color="#c084fc" />
                    <span className="attachment-file-label">{attachedFile.name}</span>
                    <button onClick={() => setAttachedFile(null)} className="remove-attachment-btn" title="Remove attachment">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="chat-input-form"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAttachFile}
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="action-icon-btn clip-btn"
                  title="Attach feedback file"
                >
                  <Paperclip size={18} />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask anything about feedback, prioritization, PRDs, or analytics..."
                  className="chat-textarea-box"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() && !attachedFile}
                  className="action-icon-btn send-btn-gradient"
                  title="Send message"
                >
                  <Send size={16} color="#ffffff" />
                </button>
              </form>
            </div>
          </footer>

        </main>
      </div>

      {/* Embedded Component Styles */}
      <style>{`
        .assistant-page-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .assistant-split-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 1.5rem;
          height: calc(100vh - 170px);
          min-height: 600px;
        }

        @media (max-width: 1024px) {
          .assistant-split-layout {
            grid-template-columns: 1fr;
            height: auto;
          }
        }

        .glass-panel-premium {
          background: rgba(15, 15, 26, 0.45);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);
        }

        /* History Sidebar */
        .assistant-history-sidebar {
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          height: 100%;
          overflow: hidden;
        }

        .history-sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .new-chat-action-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--accent-primary);
          border: none;
          color: #fff;
          padding: 0.4rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .new-chat-action-btn:hover {
          background: var(--accent-secondary);
          transform: translateY(-1px);
        }

        .history-sessions-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-right: 0.25rem;
        }

        .history-sessions-list::-webkit-scrollbar {
          width: 4px;
        }
        .history-sessions-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .history-session-card {
          padding: 0.75rem 0.9rem;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .history-session-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .active-session-card {
          background: rgba(124, 58, 237, 0.15) !important;
          border-color: rgba(124, 58, 237, 0.4) !important;
          border-left: 3px solid var(--accent-primary) !important;
        }

        .session-card-title {
          display: block;
          font-size: 0.88rem;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 0.2rem;
        }

        .session-card-preview {
          font-size: 0.76rem;
          color: var(--text-secondary);
          margin: 0 0 0.35rem 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .session-card-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .session-count-badge {
          background: rgba(255, 255, 255, 0.08);
          padding: 0.1rem 0.4rem;
          border-radius: 10px;
          color: #c4b5fd;
        }

        .session-delete-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          padding: 0.3rem;
          border-radius: 4px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .session-delete-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        /* Main Chat Window */
        .assistant-chat-main {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .chat-main-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .active-bot-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px rgba(124, 58, 237, 0.3);
        }

        .chat-clear-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .chat-clear-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        /* Feed */
        .chat-feed-box {
          flex: 1;
          overflow: hidden;
          padding: 1.25rem 1.5rem;
        }

        .chat-scroll-viewport {
          height: 100%;
          overflow-y: auto;
          padding-right: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .chat-scroll-viewport::-webkit-scrollbar {
          width: 5px;
        }
        .chat-scroll-viewport::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }

        .chat-bubble-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          max-width: 90%;
        }

        .align-left {
          align-self: flex-start;
        }

        .align-right {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .bubble-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-bot {
          background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
        }

        .avatar-user {
          background: rgba(255, 255, 255, 0.1);
        }

        .chat-message-bubble {
          border-radius: 14px;
          padding: 0.9rem 1.25rem;
          font-size: 0.92rem;
          line-height: 1.6;
        }

        .bubble-style-ai {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-top-left-radius: 2px;
          flex: 1;
        }

        .bubble-style-user {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(147, 51, 234, 0.12) 100%);
          border: 1px solid rgba(124, 58, 237, 0.3);
          border-top-right-radius: 2px;
          color: #fff;
        }

        .bubble-timestamp {
          display: block;
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.35);
          text-align: right;
          margin-top: 0.35rem;
        }

        /* Suggestions */
        .welcome-prompt-suggestions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .prompt-card {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .prompt-card:hover {
          background: rgba(124, 58, 237, 0.1);
          border-color: rgba(124, 58, 237, 0.3);
          transform: translateY(-2px);
        }

        .highlight-card {
          border-color: rgba(124, 58, 237, 0.3);
          background: rgba(124, 58, 237, 0.08);
        }

        .prompt-card-meta {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.5rem;
        }

        .card-badge {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #c4b5fd;
          font-weight: 600;
        }

        .prompt-card-title {
          margin: 0 0 0.4rem 0;
          font-size: 0.9rem;
          color: var(--text-primary);
        }

        .prompt-card-description {
          margin: 0 0 0.75rem 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .prompt-card-action {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.75rem;
          color: var(--accent-primary);
          font-weight: 600;
        }

        /* Sticky Input */
        .chat-input-sticky-panel {
          padding: 1rem 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(10, 10, 18, 0.6);
        }

        .chat-input-form {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 0.4rem 0.6rem;
        }

        .chat-textarea-box {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 0.92rem;
          padding: 0.5rem;
        }

        .action-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clip-btn {
          background: transparent;
          color: var(--text-secondary);
        }

        .clip-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .send-btn-gradient {
          background: var(--accent-primary);
          color: #fff;
        }

        .send-btn-gradient:hover:not(:disabled) {
          background: var(--accent-secondary);
          transform: scale(1.05);
        }

        .send-btn-gradient:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Typing Dots */
        .loading-bubble {
          padding: 0.75rem 1.25rem;
        }

        .typing-loader-dots {
          display: flex;
          gap: 0.35rem;
          align-items: center;
        }

        .loading-dot-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c084fc;
          animation: pulse 1.4s infinite ease-in-out both;
        }
        .loading-dot-pulse:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot-pulse:nth-child(2) { animation-delay: -0.16s; }

        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AssistantPage;
