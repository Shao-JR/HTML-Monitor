import random
import time
import threading
import numpy as np
from datetime import datetime
import json

class DataGenerator:
    def __init__(self, callback=None):
        self.callback = callback
        self.running = False
        self.data_points = []
        self.max_points = 50
        self.thread = None
        self.socketio = None  # 添加socketio引用
        
    def set_socketio(self, socketio):
        """设置socketio实例用于推送"""
        self.socketio = socketio

    def start(self):
        """开始生成数据"""
        self.running = True
        self.thread = threading.Thread(target=self._generate_data)
        self.thread.daemon = True
        self.thread.start()
        
    def stop(self):
        """停止生成数据"""
        self.running = False
        
    def _generate_data(self):
        """生成随机数据"""
        counter = 0
        while self.running:
            # 生成模拟数据
            timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]  # 毫秒级时间戳
            
            data = {
                'timestamp': timestamp,
                'temperature': round(20 + 10 * np.sin(counter * 0.1) + random.uniform(-1, 1), 2),
                'humidity': round(50 + 20 * np.sin(counter * 0.05) + random.uniform(-2, 2), 2),
                'cpu_usage': round(30 + 40 * abs(np.sin(counter * 0.2)) + random.uniform(-5, 5), 2),
                'memory_usage': round(40 + 20 * np.sin(counter * 0.15) + random.uniform(-3, 3), 2),
                'counter': counter
            }
            
            # 保存数据点
            self.data_points.append(data)
            if len(self.data_points) > self.max_points:
                self.data_points.pop(0)
            
            # 如果有回调函数，调用回调
            if self.callback:
                self.callback(data)
            # 同时通过socketio推送
            elif self.socketio:
                self.socketio.emit('new_data', data, namespace='/')
            
            counter += 1
            time.sleep(1)  # 每秒更新一次
            
    def get_all_data(self):
        """获取所有数据点"""
        return self.data_points