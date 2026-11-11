import { auth } from '../firebase';

export const fetchApi = async (endpoint, options = {}) => {
  const user = auth.currentUser;
  let token = '';
  
  if (user) {
    token = await user.getIdToken();
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'API Request Failed');
  }

  return response.json();
};