  import { useState, useEffect } from 'react';
import { offlineService, OfflineState } from '../services/offline/offlineService';

export function useOffline() {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: true,
    lastSync: null,
    pendingOperations: [],
    tasks: [],
    focusSessions: []
  });

  useEffect(() => {
    // Get initial state
    offlineService.getOfflineState().then(setOfflineState);

    // Subscribe to state changes
    const unsubscribe = offlineService.subscribe(setOfflineState);

    return unsubscribe;
  }, []);

  const syncData = () => {
    offlineService.syncPendingOperations();
  };

  const clearOfflineData = () => {
    offlineService.clearOfflineData();
  };

  return {
    ...offlineState,
    syncData,
    clearOfflineData,
    isOnline: offlineState.isOnline,
    pendingOperationsCount: offlineState.pendingOperations.length
  };
} 