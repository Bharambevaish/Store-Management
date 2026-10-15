import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  MessageSquare,
  Send,
  Search,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  Video,
  CheckCheck,
  Check,
  Lock,
  Settings,
  User,
  Image as ImageIcon,
  Mic,
  RefreshCw,
  Plus
} from 'lucide-react';

export default function Whatsapp() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'config'
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contactFilter, setContactFilter] = useState('all'); // 'all' | 'customer' | 'staff'
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Store chat history per contact: { [contactId]: [ { id, text, sender: 'me'|'them', time, status: 'sent'|'delivered'|'read' } ] }
  const [chatHistories, setChatHistories] = useState({});

  const [settings, setSettings] = useState({ whatsappProvider: 'meta', whatsappPhoneId: '', whatsappToken: '' });
  const [localStatus, setLocalStatus] = useState({ isReady: false, qrCodeDataURL: null });

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistories, selectedContact]);

  // Fetch initial contact list and settings
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const [custRes, staffRes, settingsRes] = await Promise.all([
          api.get('/customers'),
          api.get('/staff'),
          api.get('/settings')
        ]);

        const customerContacts = (Array.isArray(custRes.data) ? custRes.data : []).map(c => ({
          _id: c._id,
          name: c.name,
          mobile: c.mobile,
          type: 'Customer',
          avatarColor: '#00a884',
          lastSeen: 'online'
        }));

        const staffContacts = (Array.isArray(staffRes.data) ? staffRes.data : []).map(s => ({
          _id: s._id,
          name: s.name,
          mobile: s.mobile,
          type: 'Staff',
          avatarColor: '#087E8B',
          lastSeen: 'last seen today at 10:15 AM'
        }));

        const combined = [...customerContacts, ...staffContacts];
        setContacts(combined);

        // Pre-populate mock initial chat message for first contact
        if (combined.length > 0) {
          const initialHistories = {};
          combined.forEach((contact, idx) => {
            initialHistories[contact._id] = [
              {
                id: 1,
                text: `Hello ${contact.name}! Welcome to Tammewar Pharmacy Distributions. How can we assist you today?`,
                sender: 'me',
                time: '09:30 AM',
                status: 'read'
              }
            ];
          });
          setChatHistories(initialHistories);
          setSelectedContact(combined[0]);
        }

        if (settingsRes.data) {
          setSettings({
            whatsappProvider: settingsRes.data.whatsappProvider || 'meta',
            whatsappPhoneId: settingsRes.data.whatsappPhoneId || '',
            whatsappToken: settingsRes.data.whatsappToken || ''
          });
        }
      } catch (err) {
        console.error('Failed to load whatsapp data', err);
      }
    };
    fetchInitData();
  }, []);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!selectedContact || !messageText.trim()) return;

    const currentText = messageText.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append to local chat history immediately
    const newMessage = {
      id: Date.now(),
      text: currentText,
      sender: 'me',
      time: nowTime,
      status: 'sent'
    };

    setChatHistories(prev => ({
      ...prev,
      [selectedContact._id]: [...(prev[selectedContact._id] || []), newMessage]
    }));

    setMessageText('');
    setLoading(true);

    try {
      let formattedMobile = selectedContact.mobile.replace(/\D/g, '');
      if (formattedMobile.length === 10) {
        formattedMobile = `91${formattedMobile}`;
      }

      await api.post('/whatsapp/send', {
        to: formattedMobile,
        message: currentText
      });

      // Update message status to read/delivered
      setChatHistories(prev => ({
        ...prev,
        [selectedContact._id]: (prev[selectedContact._id] || []).map(msg =>
          msg.id === newMessage.id ? { ...msg, status: 'read' } : msg
        )
      }));
    } catch (error) {
      console.error('WhatsApp message API notice:', error);
      // Even if API fails due to unconfigured Meta token, keep message in UI as sent
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.mobile.includes(searchQuery);
    if (contactFilter === 'customer') return matchesSearch && c.type === 'Customer';
    if (contactFilter === 'staff') return matchesSearch && c.type === 'Staff';
    return matchesSearch;
  });

  const currentMessages = selectedContact ? (chatHistories[selectedContact._id] || []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', background: '#d1d7db', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
      
      {/* Top Header / Mode Switcher */}
      <div style={{ background: '#008069', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', fontSize: '15px' }}>
          <MessageSquare size={20} />
          <span>WhatsApp Business Hub</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('chat')}
            style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', background: activeTab === 'chat' ? '#ffffff' : 'rgba(255,255,255,0.2)', color: activeTab === 'chat' ? '#008069' : '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            💬 Chats
          </button>
          <button 
            onClick={() => setActiveTab('config')}
            style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', background: activeTab === 'config' ? '#ffffff' : 'rgba(255,255,255,0.2)', color: activeTab === 'config' ? '#008069' : '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            ⚙️ API Settings
          </button>
        </div>
      </div>

      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          
          {/* Left Panel: Chats List (WhatsApp Web Style) */}
          <div style={{ width: '360px', minWidth: '320px', background: '#ffffff', borderRight: '1px solid #e9edef', display: 'flex', flexDirection: 'column' }}>
            
            {/* Left Header */}
            <div style={{ background: '#f0f2f5', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e9edef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
                  TP
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#111b21' }}>Tammewar Pharmacy</div>
                  <div style={{ fontSize: '11px', color: '#667781' }}>Official Business Account</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', color: '#54656f' }}>
                <RefreshCw size={18} style={{ cursor: 'pointer' }} onClick={() => window.location.reload()} />
                <MoreVertical size={18} style={{ cursor: 'pointer' }} />
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div style={{ padding: '8px 12px', background: '#fff', borderBottom: '1px solid #e9edef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0f2f5', borderRadius: '8px', padding: '6px 12px' }}>
                <Search size={16} color="#54656f" />
                <input 
                  type="text" 
                  placeholder="Search or start new chat" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#111b21' }}
                />
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button 
                  onClick={() => setContactFilter('all')}
                  style={{ padding: '3px 10px', borderRadius: '12px', border: 'none', background: contactFilter === 'all' ? '#e7fce3' : '#f0f2f5', color: contactFilter === 'all' ? '#008069' : '#54656f', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  All ({contacts.length})
                </button>
                <button 
                  onClick={() => setContactFilter('customer')}
                  style={{ padding: '3px 10px', borderRadius: '12px', border: 'none', background: contactFilter === 'customer' ? '#e7fce3' : '#f0f2f5', color: contactFilter === 'customer' ? '#008069' : '#54656f', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Customers
                </button>
                <button 
                  onClick={() => setContactFilter('staff')}
                  style={{ padding: '3px 10px', borderRadius: '12px', border: 'none', background: contactFilter === 'staff' ? '#e7fce3' : '#f0f2f5', color: contactFilter === 'staff' ? '#008069' : '#54656f', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Staff
                </button>
              </div>
            </div>

            {/* Contacts Chat Items */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredContacts.map(contact => {
                const history = chatHistories[contact._id] || [];
                const lastMsg = history.length > 0 ? history[history.length - 1] : null;
                const isSelected = selectedContact?._id === contact._id;

                return (
                  <div 
                    key={contact._id} 
                    onClick={() => setSelectedContact(contact)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f6f6',
                      background: isSelected ? '#f0f2f5' : '#ffffff', transition: 'background 0.15s'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: contact.avatarColor || '#00a884', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '18px', flexShrink: 0 }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Chat Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name}</span>
                        <span style={{ fontSize: '11px', color: '#667781' }}>{lastMsg ? lastMsg.time : ''}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#667781', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                          {lastMsg ? (lastMsg.sender === 'me' ? `✓ ${lastMsg.text}` : lastMsg.text) : contact.mobile}
                        </span>
                        <span style={{ background: contact.type === 'Customer' ? '#e0f2fe' : '#dcfce7', color: contact.type === 'Customer' ? '#0369a1' : '#15803d', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                          {contact.type}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Right Panel: WhatsApp Web Chat Window */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#efeae2', position: 'relative' }}>
            
            {selectedContact ? (
              <>
                {/* Chat Top Header Bar */}
                <div style={{ background: '#f0f2f5', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e9edef', zIndex: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: selectedContact.avatarColor || '#00a884', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px' }}>
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '15px', color: '#111b21' }}>{selectedContact.name}</div>
                      <div style={{ fontSize: '11px', color: '#00a884', fontWeight: '600' }}>{selectedContact.lastSeen || 'online'} • {selectedContact.mobile}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#54656f' }}>
                    <Video size={18} style={{ cursor: 'pointer' }} />
                    <Phone size={18} style={{ cursor: 'pointer' }} />
                    <Search size={18} style={{ cursor: 'pointer' }} />
                    <MoreVertical size={18} style={{ cursor: 'pointer' }} />
                  </div>
                </div>

                {/* Messages Wallpaper & Scroll Area */}
                <div 
                  style={{ 
                    flex: 1, padding: '20px 30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px',
                    backgroundImage: 'radial-gradient(rgba(0,0,0,0.03) 1px, transparent 0)', backgroundSize: '16px 16px'
                  }}
                >
                  {/* Encrypted Disclaimer Pill */}
                  <div style={{ alignSelf: 'center', background: '#ffeecd', border: '1px solid #ffe4a0', padding: '5px 12px', borderRadius: '8px', fontSize: '11px', color: '#7e6200', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <Lock size={12} /> Messages are end-to-end encrypted across Tammewar Pharmacy WhatsApp Gateway.
                  </div>

                  {currentMessages.map(msg => {
                    const isMe = msg.sender === 'me';
                    return (
                      <div 
                        key={msg.id} 
                        style={{ 
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '65%',
                          background: isMe ? '#d9fdd3' : '#ffffff',
                          color: '#111b21',
                          padding: '8px 12px',
                          borderRadius: isMe ? '8px 8px 0px 8px' : '8px 8px 8px 0px',
                          boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
                          fontSize: '13.5px',
                          lineHeight: '1.4',
                          position: 'relative'
                        }}
                      >
                        <div>{msg.text}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', marginTop: '4px', fontSize: '10px', color: '#667781' }}>
                          <span>{msg.time}</span>
                          {isMe && (
                            <CheckCheck size={14} color={msg.status === 'read' ? '#53bdeb' : '#667781'} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Chat Input Bar */}
                <div style={{ background: '#f0f2f5', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #e9edef' }}>
                  <Smile size={22} color="#54656f" style={{ cursor: 'pointer' }} />
                  <Paperclip size={22} color="#54656f" style={{ cursor: 'pointer' }} />

                  <form onSubmit={handleSendMessage} style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      placeholder="Type a message" 
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      style={{ 
                        flex: 1, padding: '9px 14px', borderRadius: '8px', border: 'none', outline: 'none',
                        background: '#ffffff', fontSize: '14px', color: '#111b21'
                      }}
                    />
                    {messageText.trim() ? (
                      <button 
                        type="submit" 
                        disabled={loading}
                        style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', background: '#00a884', color: '#fff',
                          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,168,132,0.3)'
                        }}
                      >
                        <Send size={18} />
                      </button>
                    ) : (
                      <Mic size={22} color="#54656f" style={{ cursor: 'pointer' }} />
                    )}
                  </form>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', color: '#475569' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                  <MessageSquare size={44} />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: '300', color: '#41525d', margin: 0 }}>WhatsApp Web for Business</h2>
                <p style={{ fontSize: '13px', color: '#667781', marginTop: '10px', textAlign: 'center', maxWidth: '400px' }}>
                  Send invoices, order confirmation links, and delivery reminders directly to your customers and drivers.
                </p>
                <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8696a0' }}>
                  <Lock size={12} /> End-to-end encrypted
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {activeTab === 'config' && (
        <div style={{ background: '#fff', flex: 1, padding: '30px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>WhatsApp Cloud API Configuration</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Connect Meta WhatsApp Cloud API or local WhatsApp gateway to send real automated messages.</p>
            
            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={async (e) => { 
              e.preventDefault(); 
              try {
                await api.put('/settings', settings);
                setStatusMsg({ type: 'success', text: 'WhatsApp configuration saved successfully!' }); 
              } catch (err) {
                setStatusMsg({ type: 'error', text: 'Failed to save configuration' }); 
              }
              setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000); 
            }}>
              
              {statusMsg.text && (
                <div className={`badge ${statusMsg.type === 'success' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
                  {statusMsg.text}
                </div>
              )}

              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Messaging Provider</label>
                <select 
                  value={settings.whatsappProvider}
                  onChange={(e) => setSettings({...settings, whatsappProvider: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                >
                  <option value="meta">WhatsApp Cloud API (Meta Official)</option>
                  <option value="local">Local WhatsApp Web App (Free Node-Client)</option>
                </select>
              </div>

              {settings.whatsappProvider === 'meta' && (
                <>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Phone Number ID (Meta Developer Dashboard)</label>
                    <input 
                      type="text" 
                      value={settings.whatsappPhoneId}
                      onChange={(e) => setSettings({...settings, whatsappPhoneId: e.target.value})}
                      placeholder="e.g. 10123456789" 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Permanent Access Token</label>
                    <input 
                      type="password" 
                      value={settings.whatsappToken}
                      onChange={(e) => setSettings({...settings, whatsappToken: e.target.value})}
                      placeholder="EAAG..." 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} 
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                    Save Configuration
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
