import os
from dotenv import load_dotenv

load_dotenv()

def create_app():
    from backend import create_app as backend_create_app
    return backend_create_app()


# Expose a top-level "app" for hosts (like Vercel) that expect it.
# Keep the factory function for local development and tests.
app = create_app()


if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)