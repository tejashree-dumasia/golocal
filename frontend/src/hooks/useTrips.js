import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../utils/apiClient';

export const useTrips = () => {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => fetchApi('/trips'),
    // Automatically caches data and handles the loading state
  });
};