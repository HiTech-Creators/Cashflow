from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from src.models import User, Role, Company, CompanyMembership, UserInvitation
import secrets
from datetime import datetime, timedelta
from flask_mail import Message
from flask import current_app

def create_superadmin(username, email, password):
    superadmin_role = Role.objects(name='SuperAdmin', level=1).first()
    if not superadmin_role:
        superadmin_role = Role(
            name='SuperAdmin',
            level=1,
            permissions=['manage_companies', 'manage_users', 'view_all_data', 'system_admin']
        ).save()
    
    existing_superadmin = User.objects(role_id=superadmin_role).first()
    if existing_superadmin:
        raise ValueError("SuperAdmin already exists")
    
    password_hash = generate_password_hash(password)
    superadmin = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role_id=superadmin_role,
        is_active=True,
        company_memberships=[]
    ).save()
    
    return superadmin

def create_company_admin(username, email, password, company_id, created_by_user_id):
    creator = User.objects.get(id=created_by_user_id)
    if not creator.role_id or creator.role_id.level != 1:
        raise ValueError("Only SuperAdmin can create CompanyAdmin users")
    
    company_admin_role = Role.objects(name='CompanyAdmin', level=2).first()
    if not company_admin_role:
        company_admin_role = Role(
            name='CompanyAdmin',
            level=2,
            permissions=['manage_company_users', 'view_company_data', 'manage_company_settings']
        ).save()
    
    company = Company.objects.get(id=company_id)
    
    password_hash = generate_password_hash(password)
    user = User(
        username=username,
        email=email,
        password_hash=password_hash,
        role_id=company_admin_role,
        is_active=True,
        created_by=creator,
        company_memberships=[
            CompanyMembership(
                company_id=company,
                role='admin',
                invited_by=creator
            )
        ]
    ).save()
    
    return user, company

def register_user_by_invitation(username, password, invitation_token):
    invitation = UserInvitation.objects(
        token=invitation_token,
        is_used=False,
        expires_at__gte=datetime.utcnow()
    ).first()
    
    if not invitation:
        raise ValueError("Invalid or expired invitation token")
    
    user_role = Role.objects(name='User', level=3).first()
    if not user_role:
        user_role = Role(
            name='User',
            level=3,
            permissions=['view_company_data', 'create_transactions']
        ).save()
    
    password_hash = generate_password_hash(password)
    user = User(
        username=username,
        email=invitation.email,
        password_hash=password_hash,
        role_id=user_role,
        is_active=True,
        created_by=invitation.invited_by,
        company_memberships=[
            CompanyMembership(
                company_id=invitation.company_id,
                role=invitation.role,
                invited_by=invitation.invited_by
            )
        ]
    ).save()
    
    invitation.is_used = True
    invitation.save()
    
    return user, invitation.company_id

def login_user(username, password):
    if not username or not password:
        raise ValueError("Username and password are required")
    
    user = User.objects(username=username).first()
    if not user:
        user = User.objects(email=username).first()
    
    if not user or not check_password_hash(user.password_hash, password):
        raise ValueError("Invalid credentials")
    
    if not user.is_active:
        raise ValueError("Account is deactivated")
    
    role_name = user.role_id.name if user.role_id else 'User'
    role_level = user.role_id.level if user.role_id else 3
    
    default_company_id = None
    if user.company_memberships:
        default_company_id = str(user.company_memberships[0].company_id.id)
    elif role_level == 1: 
        any_company = Company.objects().first()
        if any_company:
            default_company_id = str(any_company.id)
    
    additional_claims = {
        'username': user.username,
        'email': user.email,
        'role': role_name,
        'role_level': role_level,
        'default_company_id': default_company_id
    }
    
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims=additional_claims
    )
    
    return access_token, default_company_id

def invite_user_to_company(email, company_id, role, invited_by_user_id):
    from src.utils import can_manage_users
    
    if not can_manage_users(invited_by_user_id, company_id):
        raise ValueError("You don't have permission to invite users to this company")
    
    existing_user = User.objects(email=email).first()
    if existing_user:
        for membership in existing_user.company_memberships:
            if str(membership.company_id.id) == company_id:
                raise ValueError("User is already a member of this company")
        
        inviter = User.objects.get(id=invited_by_user_id)
        company = Company.objects.get(id=company_id)
        
        new_membership = CompanyMembership(
            company_id=company,
            role=role,
            invited_by=inviter
        )
        existing_user.company_memberships.append(new_membership)
        existing_user.save()
        
        return existing_user, "User added to company"
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)  
    
    invitation = UserInvitation(
        email=email,
        company_id=Company.objects.get(id=company_id),
        invited_by=User.objects.get(id=invited_by_user_id),
        role=role,
        token=token,
        expires_at=expires_at
    ).save()
    
    return invitation, "Invitation sent"

def get_user_permissions(user_id, company_id=None):
    user = User.objects.get(id=user_id)
    
    if not user.role_id:
        return []
    
    permissions = list(user.role_id.permissions)
    
    if company_id:
        from src.utils import get_user_role_in_company
        company_role = get_user_role_in_company(user_id, company_id)
        
        if company_role == 'admin':
            permissions.extend(['manage_company_data', 'invite_users'])
        elif company_role == 'user':
            permissions.extend(['view_company_data', 'create_transactions'])

    return list(set(permissions))

def send_invitation_email(invitation):
    """
    Send invitation email with the invitation token.
    This function handles errors gracefully to not break the invitation flow.
    """
    try:
        if not current_app or 'mail' not in current_app.extensions:
            if current_app:
                current_app.logger.warning("Mail extension not available, skipping email send")
            return False
        
        company = invitation.company_id
        inviter = invitation.invited_by
        
        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
        invitation_link = f"{frontend_url}/register?token={invitation.token}"
        
        subject = f"Invitation to join {company.name}"
        body = f"""Hello,

You have been invited by {inviter.username} ({inviter.email}) to join {company.name} as a {invitation.role}.

To accept this invitation, please use the following invitation token:
{invitation.token}

Or click this link to register:
{invitation_link}

This invitation will expire on {invitation.expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')}.

If you did not expect this invitation, please ignore this email.

Best regards,
CashFlow Team"""
        
        msg = Message(subject, recipients=[invitation.email])
        msg.body = body
        current_app.extensions['mail'].send(msg)
        current_app.logger.info(f"Invitation email sent successfully to {invitation.email}")
        return True
    except Exception as e:
        if current_app:
            current_app.logger.error(f"Failed to send invitation email to {invitation.email}: {str(e)}")
        return False