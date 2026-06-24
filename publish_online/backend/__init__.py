import os
import certifi
from flask import Flask
from config import Config
from backend.models import db

def create_app():
    # Determine base and frontend directories robustly
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    frontend_dir = os.path.join(base_dir, 'frontend')

    # Initialize Flask app serving frontend statically
    app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
    
    # Load configuration
    app.config.from_object(Config)
    
    # Configure Database with SSL arguments
    app.config['SQLALCHEMY_DATABASE_URI'] = Config.DATABASE_URL
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        "connect_args": {
            "ssl": {
                "ca": certifi.where()
            }
        }
    }
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Bind SQLAlchemy db instance
    db.init_app(app)

    # Register routes
    with app.app_context():
        from backend import routes
        app.register_blueprint(routes.bp)

    return app
