from functools import wraps
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from flask import jsonify, request
from src.constants import PERMISSIONS


def role_required(*allowed_roles):
    """
    Decorator to require specific roles for accessing an endpoint.
    Checks the role from JWT additional claims.
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            try:
                verify_jwt_in_request()
            except Exception as e:
                return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
            
            # Get JWT claims which contain the role information
            jwt_claims = get_jwt()
            user_role = jwt_claims.get('role', 'User')
            
            if user_role in allowed_roles:
                return fn(*args, **kwargs)
            else:
                return jsonify({"error": "Insufficient permissions", "details": f"Requires one of: {', '.join(allowed_roles)}"}), 403
        return decorator
    return wrapper


def view_only_for_admins(fn):
    """
    Decorator that restricts SuperAdmin and CompanyAdmin to view-only access.
    These roles can only use GET, HEAD, OPTIONS methods on company data.
    Regular Users retain full CRUD access.
    """
    @wraps(fn)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception as e:
            return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
        
        jwt_claims = get_jwt()
        user_role = jwt_claims.get('role', 'User')
        request_method = request.method
        
        # SuperAdmin and CompanyAdmin have view-only on company data
        if user_role in ['SuperAdmin', 'CompanyAdmin'] and request_method not in ['GET', 'HEAD', 'OPTIONS']:
            return jsonify({
                "error": "Admins have view-only access to company data",
                "details": f"{user_role} cannot perform {request_method} operations on this resource"
            }), 403
        
        return fn(*args, **kwargs)
    return decorated_function


def can_invite_employees(user_role):
    """
    Check if a user role has permission to invite employees.
    
    Args:
        user_role: The role name from JWT claims
    
    Returns:
        bool: True if user can invite employees, False otherwise
    """
    role_permissions = PERMISSIONS.get(user_role, {})
    return role_permissions.get('invite_employees', False)


def has_permission(user_role, permission_name):
    """
    Generic permission check function.
    
    Args:
        user_role: The role name from JWT claims
        permission_name: The permission to check (e.g., 'edit_data', 'invite_employees')
    
    Returns:
        bool: True if user has the permission, False otherwise
    """
    role_permissions = PERMISSIONS.get(user_role, {})
    return role_permissions.get(permission_name, False)
