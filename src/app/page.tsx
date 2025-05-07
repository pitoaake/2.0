'use client';

import { DomainDashboard } from '../components/DomainDashboard';
import { Toaster } from 'react-hot-toast';

export default function Home() {
  return (
    <main>
      <Toaster />
      <DomainDashboard />
    </main>
  );
} 