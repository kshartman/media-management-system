'use client';

import CardPageLayout from '../../components/layout/CardPageLayout';

export default function PostsPage() {
  return (
    <CardPageLayout 
      pageTitle="Social Post Resources"
      showTypeFilter={false}
      allowedTypes={['social']}
      showControls={true}
    />
  );
}