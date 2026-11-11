import { auth } from '../firebase';

export const fetchApi = async (endpoint, options = {}) => {
  const user = auth.currentUser;
  let token = '';
  
  if (user) {
    token = await user.getIdToken();
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  // SENIOR MOVE: If body is FormData, let the browser set the Content-Type with the boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'API Request Failed');
  }

  return response.json();
};