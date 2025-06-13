import HelpContent from '@/components/help/HelpContent';
import AppHeader from '@/components/layout/AppHeader';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <HelpContent />
    </div>
  );
}