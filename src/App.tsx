import React from 'react';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { DomainDashboard } from './components/DomainDashboard';
import { ToastProvider } from './components/ui/Toast';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
          <DomainDashboard />
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;