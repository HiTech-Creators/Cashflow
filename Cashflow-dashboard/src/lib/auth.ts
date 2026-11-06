// Temporary import fix
import { authApi } from './api';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, ApiError } from './api';
import toast from 'react-hot-toast';

export type UserRole = "superadmin" | "companyAdmin" | "user"

export type AuthUser = {
  id: string
  name: string
  email: string
  username?: string
  role: UserRole
  companyId?: string
}

const USER_STORAGE_KEY = "novatech_auth_user"
const TOKEN_STORAGE_KEY = "access_token"
const COMPANY_STORAGE_KEY = "default_company_id"

// Legacy function for backward compatibility (deprecated)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function loginWithStaticCredentials(_email: string, _password: string): AuthUser | null {
  console.warn('loginWithStaticCredentials is deprecated. Use loginWithApi instead.');
  return null;
}

// New API-based authentication functions
export async function loginWithApi(credentials: LoginRequest): Promise<AuthUser | null> {
  // Client-side validation
  if (!credentials.username?.trim()) {
    toast.error('Please enter your username or email');
    return null;
  }

  if (!credentials.password?.trim()) {
    toast.error('Please enter your password');
    return null;
  }

  try {
    const response: LoginResponse = await authApi.login(credentials);

    // Store the access token
    if (response.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
    }

    // Store default company ID if provided (will be validated by CompanySelector)
    if (response.default_company_id) {
      localStorage.setItem(COMPANY_STORAGE_KEY, response.default_company_id);
    }

    // Decode JWT token to get user information
    let decodedUser: any = {};
    if (response.access_token) {
      try {
        const payload = response.access_token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        decodedUser = decodedPayload;
      } catch (decodeError) {
        console.warn('Failed to decode JWT token:', decodeError);
      }
    }

    // Create user object from decoded JWT or response
    const user: AuthUser = {
      id: decodedUser.sub || response.user?.id || 'unknown',
      name: decodedUser.username || response.user?.username || credentials.username,
      email: decodedUser.email || response.user?.email || '',
      username: decodedUser.username || response.user?.username || credentials.username,
      role: (decodedUser.role?.toLowerCase() as UserRole) || (response.user?.role as UserRole) || 'user',
      companyId: decodedUser.default_company_id || response.default_company_id,
    };

    // Store user data
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

    toast.success('Login successful!');

    // Dispatch event to notify components about company change
    window.dispatchEvent(new Event('auth-login-success'));

    return user;
  } catch (error) {
    const apiError = error as ApiError;
    toast.error(apiError.message || 'Login failed. Please try again.');
    return null;
  }
}

export async function registerWithApi(userData: RegisterRequest): Promise<boolean> {
  // Client-side validation
  if (!userData.username?.trim()) {
    toast.error('Please enter a username');
    return false;
  }

  if (!userData.password?.trim()) {
    toast.error('Please enter a password');
    return false;
  }

  if (userData.password.length < 8) {
    toast.error('Password must be at least 8 characters long');
    return false;
  }

  if (!userData.invitation_token?.trim()) {
    toast.error('Please enter your invitation token');
    return false;
  }

  try {
    const response: RegisterResponse = await authApi.register(userData);

    toast.success(response.message || 'Registration successful! Please log in.');
    return true;
  } catch (error) {
    const apiError = error as ApiError;
    toast.error(apiError.message || 'Registration failed. Please try again.');
    return false;
  }
}

export async function createSuperAdmin(adminData: { username: string; email: string; password: string }): Promise<boolean> {
  try {
    await authApi.createSuperAdmin(adminData);
    toast.success('Super admin created successfully!');
    return true;
  } catch (error) {
    const apiError = error as ApiError;
    toast.error(apiError.message || 'Failed to create super admin.');
    return false;
  }
}

export function logout(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(COMPANY_STORAGE_KEY);
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getDefaultCompanyId(): string | null {
  return localStorage.getItem(COMPANY_STORAGE_KEY);
}

export function setDefaultCompanyId(companyId: string): void {
  localStorage.setItem(COMPANY_STORAGE_KEY, companyId);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null && getAccessToken() !== null;
}


