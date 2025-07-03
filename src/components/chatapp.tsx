import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './ChatApp.css';

interface MessageData {
  _id?: string;
  id?: number;
  username: string;
  message: string;
  timestamp: string | number;
  type: 'message' | 'notification';
  socketId?: string;
}

interface UserTypingData {
  username: string;
  isTyping: boolean;
}

interface NotificationData {
  username?: string;
  message: string;
  timestamp: string;
}

const ChatApp: React.FC = () => {
  // State management
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false);
  const [usernameError, setUsernameError] = useState<string>('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Socket connection and event handlers
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('join', (data: { success: boolean; message: string }) => {
      console.log('data',data)
    if (data.success) {
      setIsJoined(true);
      // alert(data.message);
    } else {
      setIsJoined(false);
      alert(data.message);
    }
  });

    newSocket.on('message', (data: MessageData) => {
      setMessages(prev => [...prev, { ...data, type: 'message' }]);
    });

    newSocket.on('messageHistory', (historyMessages: MessageData[]) => {
      const formattedMessages = historyMessages.map(msg => ({
        ...msg,
        type: 'message' as const,
        timestamp: new Date(msg.timestamp).getTime()
      }));
      setMessages(prev => [...formattedMessages, ...prev.filter(m => m.type === 'notification')]);
    });

    newSocket.on('userJoined', (data: NotificationData) => {
      setMessages(prev => [...prev, { 
        username: '', 
        ...data, 
        type: 'notification',
        timestamp: new Date(data.timestamp).getTime()
      }]);
    });

    newSocket.on('userLeft', (data: NotificationData) => {
      setMessages(prev => [...prev, { 
        username: '', 
        ...data, 
        type: 'notification',
        timestamp: new Date(data.timestamp).getTime()
      }]);
    });

    newSocket.on('updateUsersList', (usersList: string[]) => {
      setUsers(usersList);
    });

    newSocket.on('userTyping', (data: UserTypingData) => {
      if (data.isTyping) {
        setTypingUsers(prev => [...prev.filter(user => user !== data.username), data.username]);
      } else {
        setTypingUsers(prev => prev.filter(user => user !== data.username));
      }
    });

    newSocket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
      alert(error.message);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages,typingUsers]);

  // Handle scroll detection for scroll-to-bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        setShowScrollButton(scrollTop + clientHeight < scrollHeight - 100);
      }
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const validateUsername = (username: string): boolean => {
    if (username.length < 3 || username.length > 20) {
      setUsernameError('Username must be between 3 and 20 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    
    if (validateUsername(trimmedUsername) && socket) {
      socket.emit('join', trimmedUsername);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    
    if (trimmedMessage && socket) {
      socket.emit('chatMessage', { message: trimmedMessage });
      setMessage('');

      if (isTyping) {
        socket.emit('typing', { isTyping: false });
        setIsTyping(false);
      }
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit('typing', { isTyping: true });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit('typing', { isTyping: false });
        setIsTyping(false);
      }
    }, 1000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string | number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLeaveChat = () => {
    if (window.confirm('Are you sure you want to leave the chat?')) {
      socket?.disconnect();
      setIsJoined(false);
      setMessages([]);
      setUsers([]);
      setUsername('');
      setMessage('');
      setTypingUsers([]);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (!isJoined) {
    return (
      <div className="login-container mx-auto d-flex align-items-center justify-content-center vh-100">
        <div className="login-card bg-white shadow rounded-4 p-3">
          <div className="card-body p-4">
            <div className="text-center">
              <i className="fas fa-comments fa-3x text-purple mb-3"></i>
              <h2 className="card-title text-dark">Join Chat Room</h2>
              <p className="text-muted">Enter your username to start chatting</p>
            </div>
            <form onSubmit={handleJoin}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username</label>
                <input
                  type="text"
                  className={`form-control ${usernameError ? 'is-invalid' : ''}`}
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  maxLength={20}
                  required
                />
                {usernameError && (
                  <div className="invalid-feedback">{usernameError}</div>
                )}
              </div>
              <button type="submit" className="btn btn-join w-100">
                <i className="fas fa-sign-in-alt me-2"></i>Join Chat
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="row g-0 h-100">
        {/* Sidebar */}
        <div className="col-md-3">
          <div className={`chat-sidebar ${sidebarOpen ? 'show' : ''}`}>
            <div className="sidebar-header">
              <h5 className="mb-0">
                <i className="fas fa-users me-2"></i>Online Users
                <span className="users-count">{users.length}</span>
              </h5>
              <div className={`connection-status mt-4 ${isConnected ? 'connected' : 'disconnected'}`}>
                    <i className="fas fa-circle me-2"></i>
                    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>
            <div className="p-3">
              {users.map((user, index) => (
                <div
                  key={index}
                  className={`user-item ${user === username ? 'current-user' : ''}`}
                >
                  <span className="online-indicator"></span>
                  <span>{user}</span>
                  {user === username && <small className="ms-2">(You)</small>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="col-md-9">
          <div className="chat-main vh-100 d-flex flex-column">
            {/* Chat Header */}
            <div className="chat-header d-flex justify-content-between align-items-center text-white p-4">
              <div className="d-flex align-items-center">
                <button 
                  className="btn btn-link text-white mobile-toggle me-3 d-md-none"
                  onClick={toggleSidebar}
                >
                  <i className="fas fa-bars"></i>
                </button>
                <h4 className="mb-0">
                  <i className="fas fa-comments me-2"></i>Chat Room
                </h4>
              </div>
              <div className="d-flex align-items-center">
                <span className="me-3">Welcome, <strong>{username}</strong>!</span>
                <button 
                  className="btn btn-link text-white" 
                  onClick={handleLeaveChat}
                  title="Leave Chat"
                >
                  <i className="fas fa-sign-out-alt"></i>
                </button>
              </div>
            </div>

            {/* Messages Container */}
            <div 
              ref={messagesContainerRef}
              className="messages-container"
            >
              <div className="text-center mb-4">
                <div className="badge p-3 text-secondary">
                  Welcome to the chat room! Start a conversation.
                </div>
              </div>
              
              {messages.map((msg, index) => (
                <div key={msg._id || msg.id || index} className={`mb-3 ${msg.type === 'notification' ? 'text-center' : ''}`}>
                  {msg.type === 'notification' ? (
                    <span className="badge notification-badge">{msg.message}</span>
                  ) : (
                    <div className={`message-bubble ${msg.username === username ? 'message-sent' : 'message-received'}`}>
                       {/* {msg.username !== username && (
                          <div className="d-flex align-items-start me-2">
                            <div className="rounded-circle bg-purple text-white d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                              {msg.username.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        )} */}
                      <div className="card">
                        <div className="card-body">
                          {msg.username !== username && (
                            <div className="message-username">{msg.username}</div>
                          )}
                          <div className="">{msg.message}</div>
                          <div className="message-time">
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  <i className="fas fa-user me-2"></i>
                  <span>
                    {typingUsers.length === 1 
                      ? `${typingUsers[0]} is typing`
                      : `${typingUsers.join(', ')} are typing`
                    }
                  </span>
                  <span className="typing-dots">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="message-input-container">
              <form onSubmit={handleSendMessage}>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    value={message}
                    onChange={handleTyping}
                    placeholder="Type your message..."
                    maxLength={500}
                    required
                  />
                  <button className="btn btn-send" type="submit">
                    <i className="fas fa-paper-plane me-2"></i>Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* {showScrollButton && (
        <button 
          className="scroll-to-bottom"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          <i className="fas fa-chevron-down"></i>
        </button>
      )}

      {sidebarOpen && (
        <div 
          className="overlay d-md-none"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )} */}
    </div>
  );
};

export default ChatApp;