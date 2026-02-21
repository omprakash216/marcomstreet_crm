import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { getEmployee } from '../../utils/auth';

export default function Chat() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const currentUser = getEmployee();

  const location = useLocation();

  useEffect(() => {
    // If navigating from notification, auto-select the user
    if (location.state?.selectedUserId && users.length > 0) {
      const userToSelect = users.find(u => u.id === parseInt(location.state.selectedUserId));
      if (userToSelect) {
        selectUser(userToSelect);
        // Optional: Clear state to avoid persistent selection on reload (needs history manipulation or just leave it)
      }
    }
  }, [location.state, users]); // Run when users are loaded or location changes

  useEffect(() => {
    fetchUsers();
    // Poll for new messages every 3 seconds for a more responsive feel
    const interval = setInterval(() => {
      if (selectedUser) fetchMessages(selectedUser.id);
      fetchUsers(); // Also update user status/unread counts
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  useEffect(() => {
    // Only scroll if we are near bottom or it's the first load
    const container = messagesContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom || messages.length <= 10) {
        scrollToBottom();
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      messagesContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/chat?action=users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await api.get(`/chat?user_id=${userId}`);
      if (response.data.success) {
        setMessages(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    try {
      const response = await api.post('/chat', {
        to_employee_id: selectedUser.id,
        message: newMessage
      });
      if (response.data.success) {
        setNewMessage('');
        fetchMessages(selectedUser.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('to_employee_id', selectedUser.id);
    formData.append('message', `Sent a file: ${file.name}`);

    setUploading(true);
    try {
      const response = await api.post('/chat', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.data.success) {
        fetchMessages(selectedUser.id);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
      fileInputRef.current.value = ''; // Reset input
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
    fetchMessages(user.id);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (type) => {
    if (type?.startsWith('image/')) return 'fa-file-image';
    if (type?.startsWith('video/')) return 'fa-file-video';
    if (type?.startsWith('audio/')) return 'fa-file-audio';
    if (type?.includes('pdf')) return 'fa-file-pdf';
    if (type?.includes('word') || type?.includes('officedocument')) return 'fa-file-word';
    if (type?.includes('excel') || type?.includes('sheet')) return 'fa-file-excel';
    return 'fa-file-alt';
  };

  return (
    <div className="flex h-[calc(100vh-12.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Sidebar: User List */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/30">
        <div className="p-5 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">Team Directory</h2>
            <div className="flex items-center space-x-2 bg-green-50 px-2 py-1 rounded-md border border-green-100">
              <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              <span className="text-[9px] font-black text-green-700 uppercase tracking-wider">Online</span>
            </div>
          </div>
          <div className="relative group">
            <input
              type="text"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-100 border border-transparent rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading directory</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className={`w-full flex items-center p-3 rounded-xl transition-all relative group ${selectedUser?.id === user.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-transform group-hover:scale-105 ${selectedUser?.id === user.id ? 'bg-white/20 text-white border-white/30' : 'bg-gradient-to-br from-slate-200 to-slate-100 text-slate-600 border-slate-200'
                    } border`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 ${selectedUser?.id === user.id ? 'border-blue-600' : 'border-white'} rounded-full ${user.unread_count > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                </div>
                <div className="text-left ml-3 flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <p className={`text-sm font-bold truncate ${selectedUser?.id === user.id ? 'text-white' : 'text-slate-800'}`}>{user.name}</p>
                    <span className={`text-[9px] font-bold ${selectedUser?.id === user.id ? 'text-blue-100' : 'text-slate-400'}`}>
                      {user.last_message_time ? new Date(user.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-tight truncate ${selectedUser?.id === user.id ? 'text-blue-100/80' : 'text-slate-400'}`}>
                    {user.role} <span className="mx-1">•</span> <span className={selectedUser?.id === user.id ? 'text-white' : 'text-blue-600'}>{user.department}</span>
                  </p>
                  {user.unread_count > 0 && (
                    <div className="absolute top-1/2 right-2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                      {user.unread_count}
                    </div>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-10">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No members found</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedUser ? (
          <>
            {/* Professional Chat Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm relative z-10">
              <div className="flex items-center space-x-4">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-black text-lg shadow-md">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 leading-none mb-1">{selectedUser.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{selectedUser.role}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">• {selectedUser.department}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><i className="fas fa-search text-sm"></i></button>
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><i className="fas fa-paperclip text-sm"></i></button>
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><i className="fas fa-ellipsis-h text-sm"></i></button>
              </div>
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar bg-white/50 pattern-grid-slate">
              {messages.map((msg, index) => {
                const isMine = msg.from_employee_id === currentUser.id;
                return (
                  <div key={msg.id} className={`flex items-end space-x-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {!isMine && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 mb-1 flex-shrink-0 border border-slate-300">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`group relative p-3 px-4 shadow-sm transition-all duration-300 ${isMine
                        ? 'bg-blue-600 text-white rounded-[1.25rem] rounded-tr-none'
                        : 'bg-white text-slate-800 rounded-[1.25rem] rounded-tl-none border border-slate-200'
                        }`}>
                        {msg.file_path ? (
                          <div className="space-y-3">
                            {msg.file_type?.startsWith('image/') ? (
                              <img
                                src={`/${msg.file_path}`}
                                alt={msg.file_name}
                                className="rounded-xl max-h-72 object-cover border border-white/10"
                              />
                            ) : (
                              <div className={`flex items-center p-3 rounded-xl border ${isMine ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-100'}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg mr-3 shadow-sm ${isMine ? 'bg-white/20 text-white' : 'bg-white text-blue-600'}`}>
                                  <i className={`fas ${getFileIcon(msg.file_type)}`}></i>
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className={`text-xs font-black truncate uppercase tracking-tight ${isMine ? 'text-white' : 'text-slate-900'}`}>{msg.file_name}</p>
                                  <p className={`text-[9px] font-bold uppercase ${isMine ? 'text-blue-100/60' : 'text-slate-400'}`}>{(msg.file_type || 'Unknown').split('/')[1] || 'FILE'}</p>
                                </div>
                                <a href={`/${msg.file_path}`} download className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${isMine ? 'bg-white/10 hover:bg-white text-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                  <i className="fas fa-download text-xs"></i>
                                </a>
                              </div>
                            )}
                            {msg.message && msg.message !== `Sent a file: ${msg.file_name}` && (
                              <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                        )}
                      </div>
                      <div className={`flex items-center mt-2 px-1 ${isMine ? 'flex-row-reverse space-x-reverse' : 'space-x-2'}`}>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && <i className={`fas fa-check-double text-[9px] ${msg.is_read ? 'text-blue-500' : 'text-slate-300'}`}></i>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-all shadow-sm flex-shrink-0"
                >
                  {uploading ? <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div> : <i className="fas fa-plus text-sm"></i>}
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full pl-6 pr-14 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-medium placeholder:text-slate-400 text-slate-700"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <button type="button" className="p-2 text-slate-300 hover:text-yellow-500 transition-colors"><i className="far fa-smile text-lg"></i></button>
                    <button type="submit" disabled={!newMessage.trim()} className="p-2 text-blue-600 hover:text-blue-700 disabled:opacity-30 transition-all">
                      <i className="fas fa-paper-plane text-lg shadow-sm"></i>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-white rounded-full shadow-2xl flex items-center justify-center border border-slate-100">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                <i className="fas fa-comments text-4xl text-blue-600"></i>
              </div>
            </div>
            <div className="text-center max-w-xs">
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Team Communications</h3>
              <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase tracking-widest">
                Select a team member from the directory to start a secure internal discussion.
              </p>
            </div>
            <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
              <i className="fas fa-shield-alt text-blue-600 text-xs"></i>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Internal CRM Network</span>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .pattern-grid-slate {
          background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
          background-size: 24px 24px;
        }
      `}} />
    </div>
  );
}
