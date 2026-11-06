"""
Bug Report Service for Flowback Cashflow API.

This module provides bug report functionality including:
- Bug report CRUD operations
- File attachment handling
- Comment management
- Statistics for admin dashboard
"""

import os
from typing import Dict, Any, List, Optional
from flask import current_app
from werkzeug.utils import secure_filename

from src.models import BugReport, User, utc_now


class BugReportService:
    """
    Service for bug report operations.
    
    Handles bug report management, file uploads, and statistics.
    """
    
    UPLOAD_FOLDER = 'uploads/bug_reports'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'log', 'json', 'csv'}
    MAX_FILE_SIZE_MB = 10
    MAX_ATTACHMENTS = 5
    
    @staticmethod
    def allowed_file(filename: str) -> bool:
        """
        Check if file extension is allowed.
        
        Args:
            filename: Name of the file to check
        
        Returns:
            bool: True if extension is allowed
        """
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in BugReportService.ALLOWED_EXTENSIONS
    
    @staticmethod
    def save_attachment(file, bug_report_id: str) -> Optional[str]:
        """
        Save uploaded attachment to disk.
        
        Args:
            file: Werkzeug FileStorage object
            bug_report_id: The bug report's ObjectId as string
        
        Returns:
            str: Filepath where file was saved, or None if failed
        """
        if not file or not file.filename:
            return None
        
        if not BugReportService.allowed_file(file.filename):
            current_app.logger.warning(
                f"Rejected file upload: {file.filename} - not an allowed extension"
            )
            return None
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        max_size_bytes = BugReportService.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size > max_size_bytes:
            current_app.logger.warning(
                f"Rejected file upload: {file.filename} - exceeds {BugReportService.MAX_FILE_SIZE_MB}MB limit"
            )
            return None
        
        try:
            filename = secure_filename(file.filename)
            # Add timestamp to prevent overwrites
            import time
            timestamp = int(time.time())
            name, ext = os.path.splitext(filename)
            filename = f"{name}_{timestamp}{ext}"
            
            filepath = os.path.join(
                BugReportService.UPLOAD_FOLDER,
                str(bug_report_id),
                filename
            )
            
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            file.save(filepath)
            
            current_app.logger.info(f"Saved bug report attachment: {filepath}")
            return filepath
            
        except Exception as e:
            current_app.logger.error(f"Failed to save attachment: {str(e)}")
            return None
    
    @staticmethod
    def delete_attachments(bug_report_id: str) -> bool:
        """
        Delete all attachments for a bug report.
        
        Args:
            bug_report_id: The bug report's ObjectId as string
        
        Returns:
            bool: True if successful
        """
        import shutil
        
        try:
            folder_path = os.path.join(
                BugReportService.UPLOAD_FOLDER,
                str(bug_report_id)
            )
            
            if os.path.exists(folder_path):
                shutil.rmtree(folder_path)
                current_app.logger.info(f"Deleted attachments folder: {folder_path}")
            
            return True
            
        except Exception as e:
            current_app.logger.error(f"Failed to delete attachments: {str(e)}")
            return False
    
    @staticmethod
    def add_comment(
        bug_report_id: str,
        user_id: str,
        comment_text: str
    ) -> Dict[str, Any]:
        """
        Add comment to bug report.
        
        Args:
            bug_report_id: The bug report's ObjectId
            user_id: The commenting user's ObjectId
            comment_text: The comment content
        
        Returns:
            Dict with success status and bug report data
        """
        try:
            bug_report = BugReport.objects.get(id=bug_report_id)
            user = User.objects.get(id=user_id)
        except BugReport.DoesNotExist:
            return {'success': False, 'error': 'Bug report not found'}
        except User.DoesNotExist:
            return {'success': False, 'error': 'User not found'}
        
        if not comment_text or not comment_text.strip():
            return {'success': False, 'error': 'Comment cannot be empty'}
        
        comment = {
            'user_id': str(user_id),
            'username': user.username,
            'comment': comment_text.strip(),
            'timestamp': utc_now().isoformat()
        }
        
        bug_report.comments.append(comment)
        bug_report.save()
        
        current_app.logger.info(
            f"Comment added to bug report {bug_report_id} by user {user.username}"
        )
        
        return {
            'success': True,
            'comment': comment,
            'bug_report': bug_report.to_dict()
        }
    
    @staticmethod
    def update_status(
        bug_report_id: str,
        new_status: str,
        user_id: str,
        resolution_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update bug report status.
        
        Args:
            bug_report_id: The bug report's ObjectId
            new_status: New status value
            user_id: User making the update
            resolution_notes: Notes if resolving the bug
        
        Returns:
            Dict with success status and bug report data
        """
        valid_statuses = ['open', 'in_progress', 'resolved', 'closed', 'wont_fix']
        
        if new_status not in valid_statuses:
            return {
                'success': False,
                'error': f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            }
        
        try:
            bug_report = BugReport.objects.get(id=bug_report_id)
            user = User.objects.get(id=user_id)
        except BugReport.DoesNotExist:
            return {'success': False, 'error': 'Bug report not found'}
        except User.DoesNotExist:
            return {'success': False, 'error': 'User not found'}
        
        old_status = bug_report.status
        bug_report.status = new_status
        
        # Set resolution fields if resolved/closed
        if new_status in ['resolved', 'closed', 'wont_fix']:
            bug_report.resolved_by = user
            bug_report.resolved_at = utc_now()
            if resolution_notes:
                bug_report.resolution_notes = resolution_notes
        
        bug_report.save()
        
        current_app.logger.info(
            f"Bug report {bug_report_id} status changed: {old_status} -> {new_status} by {user.username}"
        )
        
        return {
            'success': True,
            'bug_report': bug_report.to_dict()
        }
    
    @staticmethod
    def get_bug_statistics() -> Dict[str, Any]:
        """
        Get bug report statistics for admin dashboard.
        
        Returns:
            Dict with bug report statistics
        """
        total = BugReport.objects.count()
        
        # Count by status
        by_status = {}
        for status in ['open', 'in_progress', 'resolved', 'closed', 'wont_fix']:
            by_status[status] = BugReport.objects(status=status).count()
        
        # Count active bugs by severity
        by_severity = {}
        for severity in ['low', 'medium', 'high', 'critical']:
            by_severity[severity] = BugReport.objects(
                severity=severity,
                status__in=['open', 'in_progress']
            ).count()
        
        # Count by category
        by_category = {}
        for category in ['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other']:
            by_category[category] = BugReport.objects(
                category=category,
                status__in=['open', 'in_progress']
            ).count()
        
        # Calculate resolution metrics
        resolved_bugs = BugReport.objects(status__in=['resolved', 'closed'])
        total_resolved = resolved_bugs.count()
        
        # Get recent activity (last 7 days)
        from datetime import timedelta
        week_ago = utc_now() - timedelta(days=7)
        
        recent_opened = BugReport.objects(created_at__gte=week_ago).count()
        recent_resolved = BugReport.objects(
            resolved_at__gte=week_ago,
            status__in=['resolved', 'closed']
        ).count()
        
        return {
            'total': total,
            'by_status': by_status,
            'by_severity': by_severity,
            'by_category': by_category,
            'total_resolved': total_resolved,
            'open_count': by_status.get('open', 0) + by_status.get('in_progress', 0),
            'recent_activity': {
                'opened_last_7_days': recent_opened,
                'resolved_last_7_days': recent_resolved
            },
            'critical_open': by_severity.get('critical', 0),
            'high_priority_open': by_severity.get('high', 0)
        }
    
    @staticmethod
    def get_user_bug_reports(
        user_id: str,
        status_filter: Optional[str] = None,
        page: int = 1,
        per_page: int = 20
    ) -> Dict[str, Any]:
        """
        Get bug reports for a specific user.
        
        Args:
            user_id: The user's ObjectId
            status_filter: Optional status to filter by
            page: Page number (1-indexed)
            per_page: Items per page
        
        Returns:
            Dict with bug reports and pagination info
        """
        query = BugReport.objects(reported_by=user_id)
        
        if status_filter:
            query = query.filter(status=status_filter)
        
        total = query.count()
        bugs = query.order_by('-created_at').skip((page - 1) * per_page).limit(per_page)
        
        return {
            'bug_reports': [bug.to_dict() for bug in bugs],
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page
        }
    
    @staticmethod
    def search_bug_reports(
        query_text: str,
        status_filter: Optional[str] = None,
        severity_filter: Optional[str] = None,
        category_filter: Optional[str] = None,
        page: int = 1,
        per_page: int = 20
    ) -> Dict[str, Any]:
        """
        Search bug reports by title or description.
        
        Args:
            query_text: Text to search for
            status_filter: Optional status filter
            severity_filter: Optional severity filter
            category_filter: Optional category filter
            page: Page number
            per_page: Items per page
        
        Returns:
            Dict with search results and pagination
        """
        import re
        
        # Build regex query for case-insensitive search
        query = BugReport.objects()
        
        if query_text:
            regex = re.compile(query_text, re.IGNORECASE)
            query = query.filter(
                __raw__={'$or': [
                    {'title': {'$regex': regex}},
                    {'description': {'$regex': regex}}
                ]}
            )
        
        if status_filter:
            query = query.filter(status=status_filter)
        if severity_filter:
            query = query.filter(severity=severity_filter)
        if category_filter:
            query = query.filter(category=category_filter)
        
        total = query.count()
        bugs = query.order_by('-created_at').skip((page - 1) * per_page).limit(per_page)
        
        return {
            'bug_reports': [bug.to_dict() for bug in bugs],
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page,
            'query': query_text
        }


def get_bug_report_service() -> BugReportService:
    """
    Factory function to get a BugReportService instance.
    
    Returns:
        BugReportService: Bug report service instance
    """
    return BugReportService()
