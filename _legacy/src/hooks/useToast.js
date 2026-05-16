import { useState, useCallback } from 'react';

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((message, duration = 3000) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message, duration = 3000) => showToast(message, 'error', duration), [showToast]);
  const warning = useCallback((message, duration = 3000) => showToast(message, 'warning', duration), [showToast]);
  const info = useCallback((message, duration = 3000) => showToast(message, 'info', duration), [showToast]);

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
};
