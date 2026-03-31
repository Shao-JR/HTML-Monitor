from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import eventlet
import os
eventlet.monkey_patch()

from data_generator import DataGenerator
from config import Config

# 获取当前文件所在目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(os.path.dirname(BASE_DIR), 'templates')
STATIC_DIR = os.path.join(os.path.dirname(BASE_DIR), 'backend', 'static')

app = Flask(__name__, 
            template_folder=TEMPLATE_DIR,
            static_folder=STATIC_DIR)
app.config.from_object(Config)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# 设置session密钥
app.secret_key = 'your-secret-key-here-change-in-production'

# 数据生成器实例
# 在 app.py 的 DataGenerator 部分修改
data_generator = DataGenerator(callback=lambda data: socketio.emit('new_data', data, namespace='/'))
# 模拟数据库
users_db = Config.ALLOWED_USERS

# 在 app.py 中添加以下WebSocket事件处理
@socketio.on('connect', namespace='/')
def handle_connect():
    print('WebSocket客户端已连接')
    emit('connected', {'status': 'connected', 'message': 'WebSocket连接成功'})

@socketio.on('disconnect', namespace='/')
def handle_disconnect():
    print('WebSocket客户端已断开连接')

@socketio.on('request_data', namespace='/')
def handle_request_data():
    """客户端请求当前所有数据"""
    emit('all_data', {'data': data_generator.get_all_data()})

@socketio.on('start_generator', namespace='/')
def handle_start_generator():
    data_generator.start()
    emit('generator_status', {'status': 'started'})

@socketio.on('stop_generator', namespace='/')
def handle_stop_generator():
    data_generator.stop()
    emit('generator_status', {'status': 'stopped'})

@socketio.on('heartbeat', namespace='/')
def handle_heartbeat():
    emit('heartbeat_response', {'timestamp': '2024-01-01T00:00:00'})

# 主页路由
@app.route('/')
def index():
    return render_template('index.html')

# 登录路由
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username in users_db and users_db[username] == password:
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('dashboard'))
        return '''
        <html>
        <body>
            <h2>登录失败，请重试</h2>
            <a href="/login">返回登录</a>
        </body>
        </html>
        '''
    
    return render_template('login.html')

# 仪表板路由
@app.route('/dashboard')
def dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    return render_template('dashboard.html')

# 退出登录
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# 静态文件路由
@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(STATIC_DIR, 'js'), filename)

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(STATIC_DIR, 'css'), filename)

# API路由
@app.route('/api/data')
def get_data():
    if not session.get('logged_in'):
        return jsonify({'error': '未登录'}), 401
    return jsonify(data_generator.get_all_data())

@app.route('/api/start')
def start_generator():
    if not session.get('logged_in'):
        return jsonify({'error': '未登录'}), 401
    data_generator.start()
    return jsonify({'status': 'started'})

@app.route('/api/stop')
def stop_generator():
    if not session.get('logged_in'):
        return jsonify({'error': '未登录'}), 401
    data_generator.stop()
    return jsonify({'status': 'stopped'})

@app.route('/api/status')
def get_status():
    # 不需要登录检查，用于首页检查服务器状态
    return jsonify({
        'data_points': len(data_generator.get_all_data()),
        'running': data_generator.running,
        'server': 'running'
    })

# WebSocket事件
@socketio.on('connect')
def handle_connect():
    print('客户端已连接')
    emit('connected', {'data': '连接成功', 'timestamp': '2024-01-01T00:00:00'})

@socketio.on('disconnect')
def handle_disconnect():
    print('客户端已断开')

@socketio.on('control')
def handle_control(data):
    print(f'收到控制命令: {data}')
    command = data.get('command')
    if command == 'start':
        data_generator.start()
        emit('control_response', {'status': 'started', 'command': command})
    elif command == 'stop':
        data_generator.stop()
        emit('control_response', {'status': 'stopped', 'command': command})

@socketio.on('get_history')
def handle_get_history(data):
    limit = data.get('limit', 100)
    history_data = data_generator.get_all_data()[-limit:]
    emit('history_response', {'data': history_data})

@socketio.on('heartbeat')
def handle_heartbeat(data):
    emit('heartbeat_response', {'timestamp': '2024-01-01T00:00:00', 'received': data})

if __name__ == '__main__':
    # 确保目录存在
    if not os.path.exists(TEMPLATE_DIR):
        os.makedirs(TEMPLATE_DIR, exist_ok=True)
    if not os.path.exists(STATIC_DIR):
        os.makedirs(STATIC_DIR, exist_ok=True)
        os.makedirs(os.path.join(STATIC_DIR, 'js'), exist_ok=True)
        os.makedirs(os.path.join(STATIC_DIR, 'css'), exist_ok=True)
    
    # 启动数据生成器
    data_generator.start()
    
    # 启动Flask应用
    print(f"服务器启动在: http://{Config.HOST}:{Config.PORT}")
    print(f"手机访问地址: http://<电脑IP>:{Config.PORT}")
    print(f"模板目录: {TEMPLATE_DIR}")
    print(f"静态文件目录: {STATIC_DIR}")
    socketio.run(app, host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)