'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';
import { AppLayout } from '@/components/layout';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <p className="text-muted-foreground">
            Interactive documentation for all Conduit API endpoints
          </p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border">
          <SwaggerUI url="/openapi.yaml" />
        </div>
      </div>
    </AppLayout>
  );
}
