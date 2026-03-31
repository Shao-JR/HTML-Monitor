import os

class Config:
    SECRET_KEY = 'your-secret-key-change-this-in-production'
    HOST = '0.0.0.0'
    PORT = 5000
    DEBUG = True
    ALLOWED_USERS = {
        'admin': 'admin123',
        'user': 'user123'
    }