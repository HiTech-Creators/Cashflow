from flask import Flask
from flask.json.provider import DefaultJSONProvider
from json import JSONEncoder as BaseJSONEncoder

# Patch flask.json BEFORE any imports that might use it
# This must happen at module level to ensure it's patched before flask_mongoengine imports
import flask.json as flask_json_module
if not hasattr(flask_json_module, 'JSONEncoder'):
    # Use Python's built-in JSONEncoder as a fallback for Flask 3.x compatibility
    flask_json_module.JSONEncoder = BaseJSONEncoder


def patch_flask_for_mongoengine():
    """
    Patch Flask for compatibility with flask_mongoengine and Flask 3.x.
    Flask 2.3+ removed JSONEncoder from flask.json, so we need to provide
    a compatibility shim for flask_mongoengine.
    
    This must be called BEFORE importing flask_mongoengine.
    """
    # Monkey-patch flask.json to provide JSONEncoder for backward compatibility
    # This needs to happen before flask_mongoengine tries to import it
    import flask.json as flask_json_module
    if not hasattr(flask_json_module, 'JSONEncoder'):
        # Use Python's built-in JSONEncoder as a fallback
        flask_json_module.JSONEncoder = BaseJSONEncoder
    
    # Patch Flask.json_encoder if needed
    if not hasattr(Flask, "json_encoder"):
        Flask.json_encoder = DefaultJSONProvider
    
    # Safely override json encoder for flask_mongoengine
    # Import here AFTER patching flask.json
    try:
        from flask_mongoengine import json as mongo_json
        def safe_override_json_encoder(app):
            return app
        if hasattr(mongo_json, 'override_json_encoder'):
            mongo_json.override_json_encoder = safe_override_json_encoder
    except (ImportError, AttributeError):
        # flask_mongoengine not available or doesn't have the attribute, skip
        pass
