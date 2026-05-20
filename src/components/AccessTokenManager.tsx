import React from 'react';

interface AccessTokenManagerProps {
  organizationId: string;
}

export default function AccessTokenManager({ organizationId }: AccessTokenManagerProps) {
  return (
    <div>
      <h2>Access Token Manager</h2>
      <p>Organization ID: {organizationId}</p>
    </div>
  );
} 
