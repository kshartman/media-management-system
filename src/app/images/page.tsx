'use client';

import CardPageLayout from '../../components/layout/CardPageLayout';

export default function ImagesPage() {
  return (
    <CardPageLayout 
      pageTitle="Image Resources"
      showTypeFilter={false}
      allowedTypes={['image']}
      showControls={true}
    />
  );
}