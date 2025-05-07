import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// Toast types for visual styling
export type ToastType = 'success' | 'error' | 'info' | 'warning';

// Toast data structure
export interface Toast {
  id: string;
  title: string;
  message: string;
  type: ToastType;
}

// Toast creation data
export interface ToastData {
  title: string;
  message: string;
  type: ToastType;
}

// Context interface
interface ToastContextType {
  showToast: (data: ToastData) => void;
}

// Create context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast provider component
export const ToastProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Function to add a toast
  const showToast = useCallback((data: ToastData) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...data, id };
    
    setToasts((prevToasts) => [...prevToasts, newToast]);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prevToasts) => 
        prevToasts.filter((toast) => toast.id !== id)
      );
    }, 5000);
  }, []);

  // Function to remove a toast
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  // Toast icon based on type
  const getToastIcon = (type: ToastType) => {
    switch(type) {
      case 'success':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={20} />;
      case 'warning':
        return <AlertCircle className="text-yellow-500" size={20} />;
      case 'info':
      default:
        return <Info className="text-blue-500" size={20} />;
    }
  };

  // Toast background color based on type
  const getToastBgColor = (type: ToastType) => {
    switch(type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-0 right-0 p-4 space-y-4 z-50 max-w-md w-full">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`flex items-start p-4 rounded-lg shadow-md border ${getToastBgColor(toast.type)} animate-slide-up`}
          >
            <div className="flex-shrink-0 mr-3">
              {getToastIcon(toast.type)}
            </div>
            <div className="flex-1 mr-2">
              <h3 className="font-medium">{toast.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{toast.message}</p>
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Custom hook to use the toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};