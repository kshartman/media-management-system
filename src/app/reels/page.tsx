'use client';

import CardPageLayout from '../../components/layout/CardPageLayout';

export default function ReelsPage() {
  return (
    <CardPageLayout 
      pageTitle="Reel Resources"
      showTypeFilter={false}
      allowedTypes={['reel']}
      showControls={true}
    />
  );
}