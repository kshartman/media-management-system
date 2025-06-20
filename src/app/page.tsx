'use client';

import CardPageLayout from '../components/layout/CardPageLayout';

export default function Home() {
  return (
    <CardPageLayout 
      pageTitle="Media Library"
      showTypeFilter={true}
      allowedTypes={[]}
      showControls={true}
    />
  );
}