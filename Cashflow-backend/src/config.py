import os
import certifi
from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, '..', 'instance', 'cash_flow.db')

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("CRITICAL: SECRET_KEY environment variable must be set for production")
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cashflow_db')
    
    ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
    if not ANTHROPIC_API_KEY:
        print("WARNING: ANTHROPIC_API_KEY not found in environment variables")
    
    EXCHANGE_API_KEY = os.environ.get('EXCHANGE_API_KEY')
    if not EXCHANGE_API_KEY:
        print("WARNING: EXCHANGE_API_KEY not found in environment variables")
    
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')

    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')

    print(f"Configuration initialized:")
    print(f"- Database path: {db_path}")
    print(f"- Anthropic API Key status: {'Set' if ANTHROPIC_API_KEY else 'Not set'}")
    print(f"- API Key length: {len(ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else 0}")
    
    # Configure MongoDB settings
    mongo_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cashflow_db')
    MONGODB_SETTINGS = {
        'host': mongo_uri
    }
    
    # Only use TLS/SSL for MongoDB Atlas (mongodb+srv://) or when explicitly configured
    # Local MongoDB instances don't need TLS
    if 'mongodb+srv://' in mongo_uri or os.environ.get('MONGO_USE_TLS', '').lower() == 'true':
        MONGODB_SETTINGS['tlsCAFile'] = certifi.where()
        print(f"- MongoDB TLS: Enabled (Atlas or explicit configuration)")
    else:
        print(f"- MongoDB TLS: Disabled (local connection)")
    
    print(f"- MongoDB Host: {MONGODB_SETTINGS['host']}")