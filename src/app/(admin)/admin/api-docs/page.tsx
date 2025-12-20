'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">API Documentation</h1>
        <p className="text-gray-600 mt-2">
          Interactive documentation for all Conduit API endpoints
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <SwaggerUI url="/openapi.yaml" />
      </div>
    </div>
  );
}
