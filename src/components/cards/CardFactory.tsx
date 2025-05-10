'use client';

import React from 'react';
import { CardProps, ImageCardProps, SocialCardProps, ReelCardProps, BaseCardProps } from '../../types';
import ImageCard from './ImageCard';
import SocialCard from './SocialCard';
import ReelCard from './ReelCard';

interface FallbackCardProps {
  description: string;
  cardType?: string;
}

const FallbackCard: React.FC<FallbackCardProps> = ({ description, cardType }) => (
  <div className="bg-white rounded-lg shadow-md p-4">
    <p className="text-sm text-red-500">Unknown card type{cardType ? `: ${cardType}` : ''}</p>
    <p className="text-xs text-gray-700 mt-1">{description}</p>
  </div>
);

const ErrorCard: React.FC = () => (
  <div className="bg-white rounded-lg shadow-md p-4">
    <p className="text-sm text-red-500">Error rendering card</p>
  </div>
);

type AnyCardProps = ImageCardProps | SocialCardProps | ReelCardProps | BaseCardProps;

const CardFactory = (props: AnyCardProps) => {
  try {
    if (props.type === 'image') {
      return <ImageCard {...props as ImageCardProps} />;
    } else if (props.type === 'social') {
      return <SocialCard {...props as SocialCardProps} />;
    } else if (props.type === 'reel') {
      return <ReelCard {...props as ReelCardProps} />;
    } else {
      // Cast to any to handle unexpected types
      const anyProps = props as any;
      console.warn(`Unknown card type: ${anyProps.type}`);
      return <FallbackCard description={anyProps.description || 'No description'} cardType={anyProps.type} />;
    }
  } catch (error) {
    console.error('Error rendering card:', error);
    return <ErrorCard />;
  }
};

export default CardFactory;