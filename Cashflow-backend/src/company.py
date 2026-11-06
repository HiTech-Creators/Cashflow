from src.models import Company, User


def create_company(name, currency='USD', created_by_user_id=None):
    if not name:
        raise ValueError("Company name is required")
    
    if not created_by_user_id:
        raise ValueError("created_by_user_id is required")
    
    creator = User.objects.get(id=created_by_user_id)
    
    if Company.objects(name=name).first():
        raise ValueError(f"Company '{name}' already exists")
    
    company = Company(
        name=name,
        currency=currency,
        created_by=creator
    ).save()
    
    return company


def get_user_companies(user_id):
    """
    Get all companies a user has access to.
    
    Returns:
        list[Company]: List of Company objects the user can access
    """
    user = User.objects.get(id=user_id)
    
    if user.role_id and user.role_id.level == 1:
        # SuperAdmin can access all companies
        return list(Company.objects(is_active=True).all())
    
    # For regular users, get actual Company objects from memberships
    company_ids = [membership.company_id.id for membership in user.company_memberships]
    return list(Company.objects(id__in=company_ids, is_active=True).all())


def get_company(company_id):
    return Company.objects(id=company_id).first()


def update_company(company_id, user_id, **kwargs):
    company = Company.objects(id=company_id).first()
    if not company:
        raise ValueError("Company not found")
    
    user = User.objects.get(id=user_id)
    
    is_creator = str(company.created_by.id) == str(user_id)
    is_superadmin = user.role_id and user.role_id.level == 1
    
    if not (is_creator or is_superadmin):
        raise ValueError("You don't have permission to update this company")
    
    allowed_fields = ['name', 'currency', 'settings', 'is_active']
    for key, value in kwargs.items():
        if key in allowed_fields and hasattr(company, key) and value is not None:
            setattr(company, key, value)
    
    company.save()
    return company


def delete_company(company_id, user_id):
    company = Company.objects(id=company_id).first()
    if not company:
        raise ValueError("Company not found")
    
    user = User.objects.get(id=user_id)
    
    if not (user.role_id and user.role_id.level == 1):
        raise ValueError("Only SuperAdmin can delete companies")
    
    company.is_active = False
    company.save()

