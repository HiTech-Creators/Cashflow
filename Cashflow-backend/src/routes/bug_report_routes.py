"""
Bug Report Routes for Flowback Cashflow API.

This module provides API endpoints for:
- Submitting and managing bug reports
- Adding comments to bug reports
- Admin statistics and management
- File attachment handling
"""

from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt

from src.models import BugReport, User, Company, utc_now
from src.services.bug_report_service import get_bug_report_service


bug_reports_bp = Blueprint('bug_reports', __name__)


# =============================================================================
# Bug Report CRUD Endpoints
# =============================================================================

@bug_reports_bp.route('/bug-reports', methods=['POST'])
def submit_bug_report():
    """
    Submit a new bug report.
    
    Supports both JSON and multipart/form-data for file uploads.
    
    JSON/Form fields:
    - title: (required) Bug title
    - description: (required) Detailed description
    - company_id: (optional) Related company ID
    - severity: low, medium, high, critical (default: medium)
    - category: ui, api, performance, data, security, feature_request, other
    - browser: User's browser info
    - device: User's device info
    - url_path: URL where bug occurred
    
    File uploads (multipart/form-data):
    - attachments: File(s) to attach (max 5 files, 10MB each)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    # Handle both JSON and form data
    if request.content_type and 'multipart/form-data' in request.content_type:
        data = request.form.to_dict()
    else:
        data = request.get_json() or {}
    
    # Validate required fields
    if not data.get('title'):
        return jsonify({"error": "title is required"}), 400
    if len(data.get('title', '')) > 200:
        return jsonify({"error": "title must be 200 characters or less"}), 400
    if not data.get('description'):
        return jsonify({"error": "description is required"}), 400
    
    # Validate severity
    severity = data.get('severity', 'medium')
    if severity not in ['low', 'medium', 'high', 'critical']:
        return jsonify({"error": "Invalid severity. Must be: low, medium, high, critical"}), 400
    
    # Validate category
    category = data.get('category', 'other')
    valid_categories = ['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other']
    if category not in valid_categories:
        return jsonify({"error": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}), 400
    
    try:
        user = User.objects.get(id=current_user_id)
        
        # Validate company_id if provided
        company = None
        if data.get('company_id'):
            try:
                company = Company.objects.get(id=data['company_id'])
            except Company.DoesNotExist:
                return jsonify({"error": "Company not found"}), 404
        
        # Create bug report
        bug_report = BugReport(
            title=data['title'],
            description=data['description'],
            reported_by=user,
            company_id=company,
            severity=severity,
            category=category,
            browser=data.get('browser'),
            device=data.get('device'),
            url_path=data.get('url_path'),
            status='open',
            priority=int(data.get('priority', 3))
        )
        bug_report.save()
        
        # Handle file attachments
        service = get_bug_report_service()
        attachments = []
        
        if 'attachments' in request.files:
            files = request.files.getlist('attachments')
            
            # Limit number of attachments
            if len(files) > service.MAX_ATTACHMENTS:
                return jsonify({
                    "error": f"Maximum {service.MAX_ATTACHMENTS} attachments allowed"
                }), 400
            
            for file in files:
                filepath = service.save_attachment(file, str(bug_report.id))
                if filepath:
                    attachments.append(filepath)
            
            if attachments:
                bug_report.attachments = attachments
                bug_report.save()
        
        current_app.logger.info(
            f"Bug report created: {bug_report.id} by user {user.username}"
        )
        
        return jsonify({
            "message": "Bug report submitted successfully",
            "bug_report": bug_report.to_dict()
        }), 201
        
    except User.DoesNotExist:
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        current_app.logger.error(f"Error creating bug report: {str(e)}")
        return jsonify({"error": f"Failed to create bug report: {str(e)}"}), 400


@bug_reports_bp.route('/bug-reports', methods=['GET'])
def list_bug_reports():
    """
    List bug reports.
    
    SuperAdmin sees all bug reports.
    Regular users see only their own bug reports.
    
    Query params:
    - status: Filter by status
    - severity: Filter by severity
    - category: Filter by category
    - search: Search in title/description
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    # Parse query params
    status_filter = request.args.get('status')
    severity_filter = request.args.get('severity')
    category_filter = request.args.get('category')
    search_query = request.args.get('search')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 100))
    
    # Build query based on role
    if user_role == 'SuperAdmin':
        query = BugReport.objects()
    else:
        query = BugReport.objects(reported_by=current_user_id)
    
    # Apply filters
    if status_filter:
        query = query.filter(status=status_filter)
    if severity_filter:
        query = query.filter(severity=severity_filter)
    if category_filter:
        query = query.filter(category=category_filter)
    
    # Apply search
    if search_query:
        import re
        regex = re.compile(search_query, re.IGNORECASE)
        query = query.filter(
            __raw__={'$or': [
                {'title': {'$regex': regex}},
                {'description': {'$regex': regex}}
            ]}
        )
    
    # Get total and paginate
    total = query.count()
    bugs = query.order_by('-created_at').skip((page - 1) * per_page).limit(per_page)
    
    return jsonify({
        "bug_reports": [bug.to_dict() for bug in bugs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page
    })


@bug_reports_bp.route('/bug-reports/<bug_id>', methods=['GET'])
def get_bug_report(bug_id):
    """Get specific bug report details."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    try:
        bug = BugReport.objects.get(id=bug_id)
    except BugReport.DoesNotExist:
        return jsonify({"error": "Bug report not found"}), 404
    
    # Access control: SuperAdmin sees all, others see only their own
    if user_role != 'SuperAdmin' and str(bug.reported_by.id) != current_user_id:
        return jsonify({"error": "Access denied"}), 403
    
    return jsonify(bug.to_dict())


@bug_reports_bp.route('/bug-reports/<bug_id>', methods=['PUT', 'PATCH'])
def update_bug_report(bug_id):
    """
    Update bug report.
    
    Regular users can update title, description, severity, category only if they own the report.
    SuperAdmin can update all fields including status, priority, and resolution.
    
    JSON body fields:
    - title: Bug title
    - description: Detailed description
    - severity: low, medium, high, critical
    - category: ui, api, performance, data, security, feature_request, other
    - status: open, in_progress, resolved, closed, wont_fix (SuperAdmin only)
    - priority: 1-5 (SuperAdmin only)
    - resolution_notes: Notes when resolving (SuperAdmin only)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400
    
    try:
        bug = BugReport.objects.get(id=bug_id)
    except BugReport.DoesNotExist:
        return jsonify({"error": "Bug report not found"}), 404
    
    # Access control
    is_owner = str(bug.reported_by.id) == current_user_id
    is_admin = user_role == 'SuperAdmin'
    
    if not is_owner and not is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    # Update fields based on permissions
    if 'title' in data and is_owner:
        if len(data['title']) > 200:
            return jsonify({"error": "title must be 200 characters or less"}), 400
        bug.title = data['title']
    
    if 'description' in data and is_owner:
        bug.description = data['description']
    
    if 'severity' in data:
        if data['severity'] not in ['low', 'medium', 'high', 'critical']:
            return jsonify({"error": "Invalid severity"}), 400
        bug.severity = data['severity']
    
    if 'category' in data:
        valid_categories = ['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other']
        if data['category'] not in valid_categories:
            return jsonify({"error": "Invalid category"}), 400
        bug.category = data['category']
    
    # Admin-only fields
    if is_admin:
        if 'status' in data:
            valid_statuses = ['open', 'in_progress', 'resolved', 'closed', 'wont_fix']
            if data['status'] not in valid_statuses:
                return jsonify({"error": "Invalid status"}), 400
            
            old_status = bug.status
            bug.status = data['status']
            
            # Set resolution fields if resolving
            if data['status'] in ['resolved', 'closed', 'wont_fix'] and old_status not in ['resolved', 'closed', 'wont_fix']:
                user = User.objects.get(id=current_user_id)
                bug.resolved_by = user
                bug.resolved_at = utc_now()
                if 'resolution_notes' in data:
                    bug.resolution_notes = data['resolution_notes']
        
        if 'priority' in data:
            try:
                priority = int(data['priority'])
                if priority < 1 or priority > 5:
                    return jsonify({"error": "Priority must be between 1 and 5"}), 400
                bug.priority = priority
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid priority value"}), 400
        
        if 'resolution_notes' in data:
            bug.resolution_notes = data['resolution_notes']
    
    bug.save()
    
    return jsonify({
        "message": "Bug report updated successfully",
        "bug_report": bug.to_dict()
    })


@bug_reports_bp.route('/bug-reports/<bug_id>', methods=['DELETE'])
def delete_bug_report(bug_id):
    """
    Delete bug report.
    
    Only SuperAdmin can delete any bug report.
    Regular users can delete their own bug reports only if status is 'open'.
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    try:
        bug = BugReport.objects.get(id=bug_id)
    except BugReport.DoesNotExist:
        return jsonify({"error": "Bug report not found"}), 404
    
    is_owner = str(bug.reported_by.id) == current_user_id
    is_admin = user_role == 'SuperAdmin'
    
    # Access control
    if not is_admin:
        if not is_owner:
            return jsonify({"error": "Access denied"}), 403
        if bug.status != 'open':
            return jsonify({"error": "Can only delete open bug reports"}), 400
    
    # Delete attachments
    service = get_bug_report_service()
    service.delete_attachments(str(bug.id))
    
    bug.delete()
    
    current_app.logger.info(f"Bug report {bug_id} deleted by user {current_user_id}")
    
    return jsonify({"message": "Bug report deleted successfully"})


# =============================================================================
# Comment Endpoints
# =============================================================================

@bug_reports_bp.route('/bug-reports/<bug_id>/comments', methods=['POST'])
def add_bug_comment(bug_id):
    """
    Add comment to bug report.
    
    JSON body:
    - comment: (required) Comment text
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    data = request.get_json()
    if not data or not data.get('comment'):
        return jsonify({"error": "comment is required"}), 400
    
    try:
        bug = BugReport.objects.get(id=bug_id)
    except BugReport.DoesNotExist:
        return jsonify({"error": "Bug report not found"}), 404
    
    # Access control: SuperAdmin or bug owner can comment
    is_owner = str(bug.reported_by.id) == current_user_id
    is_admin = user_role == 'SuperAdmin'
    
    if not is_owner and not is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    service = get_bug_report_service()
    result = service.add_comment(bug_id, current_user_id, data['comment'])
    
    if not result['success']:
        return jsonify({"error": result['error']}), 400
    
    return jsonify({
        "message": "Comment added successfully",
        "comment": result['comment'],
        "bug_report": result['bug_report']
    })


@bug_reports_bp.route('/bug-reports/<bug_id>/comments', methods=['GET'])
def get_bug_comments(bug_id):
    """Get all comments for a bug report."""
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    try:
        bug = BugReport.objects.get(id=bug_id)
    except BugReport.DoesNotExist:
        return jsonify({"error": "Bug report not found"}), 404
    
    # Access control
    is_owner = str(bug.reported_by.id) == current_user_id
    is_admin = user_role == 'SuperAdmin'
    
    if not is_owner and not is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    return jsonify({
        "bug_id": str(bug.id),
        "comments": bug.comments,
        "count": len(bug.comments)
    })


# =============================================================================
# Admin Endpoints
# =============================================================================

@bug_reports_bp.route('/bug-reports/statistics', methods=['GET'])
def get_bug_statistics():
    """
    Get bug report statistics for admin dashboard.
    
    SuperAdmin only.
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    if user_role != 'SuperAdmin':
        return jsonify({"error": "Access denied. SuperAdmin only."}), 403
    
    service = get_bug_report_service()
    stats = service.get_bug_statistics()
    
    return jsonify(stats)


@bug_reports_bp.route('/bug-reports/recent', methods=['GET'])
def get_recent_bug_reports():
    """
    Get recent bug reports for admin dashboard.
    
    SuperAdmin only.
    
    Query params:
    - limit: Number of reports to return (default: 10, max: 50)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    if user_role != 'SuperAdmin':
        return jsonify({"error": "Access denied. SuperAdmin only."}), 403
    
    limit = request.args.get('limit', 10, type=int)
    limit = max(1, min(limit, 50))
    
    bugs = BugReport.objects().order_by('-created_at').limit(limit)
    
    return jsonify({
        "recent_bug_reports": [bug.to_dict() for bug in bugs],
        "count": len(bugs)
    })


@bug_reports_bp.route('/bug-reports/critical', methods=['GET'])
def get_critical_bug_reports():
    """
    Get critical/high severity open bug reports.
    
    SuperAdmin only.
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    if user_role != 'SuperAdmin':
        return jsonify({"error": "Access denied. SuperAdmin only."}), 403
    
    bugs = BugReport.objects(
        severity__in=['critical', 'high'],
        status__in=['open', 'in_progress']
    ).order_by('priority', '-created_at')
    
    return jsonify({
        "critical_bug_reports": [bug.to_dict() for bug in bugs],
        "count": bugs.count()
    })


# =============================================================================
# Attachment Endpoints
# =============================================================================

@bug_reports_bp.route('/bug-reports/<bug_id>/attachments', methods=['POST'])
def add_bug_attachment(bug_id):
    """
    Add attachment to existing bug report.
    
    Multipart/form-data:
    - attachment: File to attach
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    try:
        bug = BugReport.objects.get(id=bug_id)
    except BugReport.DoesNotExist:
        return jsonify({"error": "Bug report not found"}), 404
    
    # Access control
    is_owner = str(bug.reported_by.id) == current_user_id
    is_admin = user_role == 'SuperAdmin'
    
    if not is_owner and not is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    if 'attachment' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    service = get_bug_report_service()
    
    # Check attachment limit
    if len(bug.attachments) >= service.MAX_ATTACHMENTS:
        return jsonify({
            "error": f"Maximum {service.MAX_ATTACHMENTS} attachments allowed"
        }), 400
    
    file = request.files['attachment']
    filepath = service.save_attachment(file, str(bug.id))
    
    if not filepath:
        return jsonify({"error": "Failed to save attachment. Check file type and size."}), 400
    
    bug.attachments.append(filepath)
    bug.save()
    
    return jsonify({
        "message": "Attachment added successfully",
        "filepath": filepath,
        "total_attachments": len(bug.attachments)
    })


@bug_reports_bp.route('/bug-reports/<bug_id>/attachments/<int:attachment_index>', methods=['GET'])
def get_bug_attachment(bug_id, attachment_index):
    """
    Download bug report attachment.
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    jwt_claims = get_jwt()
    user_role = jwt_claims.get('role', 'User')
    
    try:
        bug = BugReport.objects.get(id=bug_id)
    except BugReport.DoesNotExist:
        return jsonify({"error": "Bug report not found"}), 404
    
    # Access control
    is_owner = str(bug.reported_by.id) == current_user_id
    is_admin = user_role == 'SuperAdmin'
    
    if not is_owner and not is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    if attachment_index < 0 or attachment_index >= len(bug.attachments):
        return jsonify({"error": "Attachment not found"}), 404
    
    filepath = bug.attachments[attachment_index]
    
    import os
    if not os.path.exists(filepath):
        return jsonify({"error": "Attachment file not found"}), 404
    
    return send_file(filepath, as_attachment=True)


# =============================================================================
# User's Own Bug Reports
# =============================================================================

@bug_reports_bp.route('/my-bug-reports', methods=['GET'])
def get_my_bug_reports():
    """
    Get current user's bug reports.
    
    Query params:
    - status: Filter by status
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20)
    """
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error": "Invalid or missing JWT token", "details": str(e)}), 401
    
    current_user_id = get_jwt_identity()
    
    status_filter = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = max(1, min(per_page, 100))
    
    service = get_bug_report_service()
    result = service.get_user_bug_reports(
        user_id=current_user_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page
    )
    
    return jsonify(result)
