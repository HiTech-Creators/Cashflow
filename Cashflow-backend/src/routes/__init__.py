"""
Routes package for Flowback Cashflow API.

This package contains all API endpoint blueprints organized by module.
"""

from src.routes.reconciliation_routes import reconciliation_bp
from src.routes.drawings_routes import drawings_bp
from src.routes.salary_routes import salary_bp

__all__ = [
    'reconciliation_bp',
    'drawings_bp',
    'salary_bp',
]
