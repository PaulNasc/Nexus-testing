import React from 'react';
import { NexusIcon } from './NexusLogo';

type KrigzisLogoProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
};

export const KrigzisLogo: React.FC<KrigzisLogoProps> = ({
  size = 28,
  className,
}) => {
  return <NexusIcon size={size} className={className} />;
};

export default KrigzisLogo;

