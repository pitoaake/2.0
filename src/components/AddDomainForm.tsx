import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useDomainStore } from '../hooks/useDomainStore';
import { useToast } from './ui/Toast';

interface AddDomainFormProps {
  onClose: () => void;
}

export const AddDomainForm: React.FC<AddDomainFormProps> = ({ onClose }) => {
  const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single');
  const [domainName, setDomainName] = useState('');
  const [bulkDomains, setBulkDomains] = useState('');
  const [isValid, setIsValid] = useState(true);
  const { addDomain } = useDomainStore();
  const { showToast } = useToast();

  const validateDomain = (domain: string): boolean => {
    const pattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return pattern.test(domain);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDomainName(value);
    setIsValid(value.trim() === '' || validateDomain(value));
  };

  const handleBulkChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBulkDomains(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (inputMode === 'single') {
      if (!domainName.trim() || !validateDomain(domainName)) {
        setIsValid(false);
        return;
      }
      
      addDomain(domainName.trim());
      showToast({
        title: '添加成功',
        message: `${domainName} 已添加到监控列表`,
        type: 'success'
      });
      setDomainName('');
    } else {
      const domains = bulkDomains
        .split('\n')
        .map(d => d.trim())
        .filter(d => d && validateDomain(d));

      if (domains.length > 0) {
        domains.forEach(domain => {
          addDomain(domain);
        });
        showToast({
          title: '批量添加成功',
          message: `已添加 ${domains.length} 个域名到监控列表`,
          type: 'success'
        });
        setBulkDomains('');
      } else {
        showToast({
          title: '输入无效',
          message: '请输入有效的域名（每行一个）',
          type: 'error'
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">添加域名</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setInputMode('single')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                inputMode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              单个域名
            </button>
            <button
              onClick={() => setInputMode('bulk')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                inputMode === 'bulk'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              批量输入
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          {inputMode === 'single' ? (
            <div className="mb-4">
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                域名
              </label>
              <input
                type="text"
                id="domain"
                value={domainName}
                onChange={handleChange}
                placeholder="example.com"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 
                  ${isValid 
                    ? 'border-gray-300 focus:ring-blue-500 dark:border-gray-600' 
                    : 'border-red-500 focus:ring-red-500'}`}
              />
              {!isValid && (
                <p className="text-red-500 text-sm mt-1">请输入有效的域名</p>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <label htmlFor="bulkDomains" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                输入域名（每行一个）
              </label>
              <textarea
                id="bulkDomains"
                value={bulkDomains}
                onChange={handleBulkChange}
                placeholder="example1.com&#10;example2.com&#10;example3.com"
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {inputMode === 'bulk' ? '批量添加' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};