'use client';

import { useState } from 'react';
import { HelpCircle, BookOpen, PlayCircle, FileText, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useTour } from './tour-provider';
import { allTours } from './tours';

export function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { startTour } = useTour();

  const handleStartTour = (tourKey: keyof typeof allTours) => {
    startTour(allTours[tourKey]);
    setIsOpen(false);
  };

  return (
    <>
      {/* Help Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-accent text-accent-foreground hover:bg-accent/90 z-50"
        title="Help & Tours"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      {/* Help Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-2xl">
            <Card className="shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Help & Interactive Tours
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tours Section */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <PlayCircle className="h-4 w-4" />
                    Interactive Tours
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TourCard
                      title="Getting Started"
                      description="Complete walkthrough for new users"
                      onClick={() => handleStartTour('onboarding')}
                      duration="5 min"
                    />
                    <TourCard
                      title="API Keys"
                      description="Learn key management features"
                      onClick={() => handleStartTour('apiKeys')}
                      duration="3 min"
                    />
                    <TourCard
                      title="Templates"
                      description="Bulk key creation with templates"
                      onClick={() => handleStartTour('templates')}
                      duration="2 min"
                    />
                    <TourCard
                      title="Analytics"
                      description="Understanding usage analytics"
                      onClick={() => handleStartTour('analytics')}
                      duration="3 min"
                    />
                  </div>
                </div>

                {/* Documentation Links */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Documentation
                  </h3>
                  <div className="space-y-2">
                    <DocLink
                      title="API Documentation"
                      href="/admin/api-docs"
                      description="Complete API reference and examples"
                    />
                    <DocLink
                      title="Provider Setup"
                      href="/admin/providers"
                      description="Configure Claude, OpenAI, and Gemini"
                    />
                    <DocLink
                      title="Security Best Practices"
                      href="#"
                      description="Secure your API keys and gateway"
                      external
                    />
                  </div>
                </div>

                {/* Quick Tips */}
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Quick Tips
                  </h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <Tip text="Use templates to standardize key creation and save 90% of configuration time" />
                    <Tip text="Monitor quota usage in real-time by clicking the chart icon on any API key" />
                    <Tip text="Set alert thresholds to get notified before hitting rate limits" />
                    <Tip text="Use bulk operations to manage multiple keys efficiently" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

interface TourCardProps {
  title: string;
  description: string;
  onClick: () => void;
  duration: string;
}

function TourCard({ title, description, onClick, duration }: TourCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 p-4 rounded-lg border border-border hover:bg-accent/5 hover:border-accent transition-all text-left"
    >
      <div className="flex items-center justify-between w-full">
        <h4 className="font-medium">{title}</h4>
        <span className="text-xs text-muted-foreground">{duration}</span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex items-center gap-1 text-xs text-accent mt-1">
        <PlayCircle className="h-3 w-3" />
        Start Tour
      </div>
    </button>
  );
}

interface DocLinkProps {
  title: string;
  href: string;
  description: string;
  external?: boolean;
}

function DocLink({ title, href, description, external }: DocLinkProps) {
  return (
    <a
      href={href}
      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/5 hover:border-accent transition-all"
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="flex-1">
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </a>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-accent mt-0.5">•</span>
      <span>{text}</span>
    </div>
  );
}
