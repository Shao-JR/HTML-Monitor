// frontend/js/websocket.js
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 3000;
        this.listeners = {};
        this.heartbeatInterval = null;
        this.connectionCheckInterval = null;
    }
    
    // 连接到WebSocket服务器
    connect() {
        if (this.socket && this.isConnected) {
            console.log('WebSocket已连接，无需重新连接');
            return;
        }
        
        // 如果已有连接，先断开
        if (this.socket) {
            this.socket.disconnect();
        }
        
        console.log('正在连接到WebSocket服务器...');
        
        // 构建WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
            timeout: 10000
        });
        
        this.setupEventListeners();
    }
    
    // 设置事件监听器
    setupEventListeners() {
        if (!this.socket) return;
        
        // 连接成功
        this.socket.on('connect', () => {
            console.log('WebSocket连接成功');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected', { 
                timestamp: new Date().toISOString(),
                socketId: this.socket.id
            });
            this.startHeartbeat();
        });
        
        // 连接断开
        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket断开连接，原因:', reason);
            this.isConnected = false;
            this.stopHeartbeat();
            this.emit('disconnected', { 
                reason, 
                timestamp: new Date().toISOString() 
            });
            
            // 如果不是正常断开，尝试重连
            if (reason !== 'io client disconnect') {
                setTimeout(() => {
                    this.connect();
                }, this.reconnectDelay);
            }
        });
        
        // 连接错误
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket连接错误:', error);
            this.emit('error', { 
                error: error.message, 
                timestamp: new Date().toISOString() 
            });
        });
        
        // 接收新数据
        this.socket.on('new_data', (data) => {
            console.log('接收到新数据:', data);
            this.emit('data', data);
        });
        
        // 服务器确认连接
        this.socket.on('connected', (data) => {
            console.log('服务器确认连接:', data);
            this.emit('server_connected', data);
        });
        
        // 所有数据
        this.socket.on('all_data', (data) => {
            console.log('接收到所有数据，数量:', data.data?.length || 0);
            this.emit('all_data', data.data);
        });
        
        // 生成器状态
        this.socket.on('generator_status', (data) => {
            console.log('生成器状态:', data.status);
            this.emit('generator_status', data);
        });
        
        // 心跳响应
        this.socket.on('heartbeat_response', (data) => {
            this.emit('heartbeat_response', data);
        });
        
        // 重连成功
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`重连成功，第${attemptNumber}次尝试`);
            this.emit('reconnected', { attemptNumber });
        });
        
        // 重连尝试
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`正在尝试重连，第${attemptNumber}次`);
            this.emit('reconnect_attempt', { attemptNumber });
        });
        
        // 重连失败
        this.socket.on('reconnect_failed', () => {
            console.error('重连失败');
            this.emit('reconnect_failed');
        });
    }
    
    // 发送数据
    send(event, data = {}) {
        if (!this.socket || !this.isConnected) {
            console.warn('WebSocket未连接，无法发送数据');
            this.emit('send_error', { error: '未连接', event, data });
            return false;
        }
        
        try {
            this.socket.emit(event, data);
            console.log(`发送事件: ${event}`, data);
            return true;
        } catch (error) {
            console.error('发送数据失败:', error);
            this.emit('send_error', { error, event, data });
            return false;
        }
    }
    
    // 心跳检测
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('heartbeat', {
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent
                });
            }
        }, 10000); // 每10秒发送一次心跳
        
        // 连接检查
        this.connectionCheckInterval = setInterval(() => {
            if (!this.isConnected) {
                console.log('检测到连接断开，尝试重连...');
                this.connect();
            }
        }, 5000);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }
    
    // 断开连接
    disconnect() {
        this.stopHeartbeat();
        if (this.socket) {
            this.socket.disconnect();
        }
        this.isConnected = false;
        console.log('WebSocket已手动断开');
    }
    
    // 重新连接
    reconnect() {
        console.log('手动重连...');
        this.disconnect();
        setTimeout(() => this.connect(), 1000);
    }
    
    // 事件监听器管理
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件监听器错误 (${event}):`, error);
                }
            });
        }
    }
    
    // 请求历史数据
    requestAllData() {
        return this.send('request_data');
    }
    
    // 控制数据生成器
    startGenerator() {
        return this.send('start_generator');
    }
    
    stopGenerator() {
        return this.send('stop_generator');
    }
    
    // 获取连接状态
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            socketId: this.socket?.id,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// 导出为全局变量
window.WebSocketManager = WebSocketManager;