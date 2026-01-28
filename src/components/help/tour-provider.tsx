'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { Button, Card, CardContent } from '@/components/ui';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for the element to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void; // Optional action to perform when step is shown
}

export interface Tour {
  id: string;
  name: string;
  steps: TourStep[];
  onComplete?: () => void;
}

interface TourContextValue {
  currentTour: Tour | null;
  currentStep: number;
  isActive: boolean;
  startTour: (tour: Tour) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [currentTour, setCurrentTour] = useState<Tour | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const startTour = (tour: Tour) => {
    setCurrentTour(tour);
    setCurrentStep(0);
    setIsActive(true);

    // Execute first step action if defined
    if (tour.steps[0]?.action) {
      tour.steps[0].action();
    }
  };

  const endTour = () => {
    if (currentTour?.onComplete) {
      currentTour.onComplete();
    }
    setCurrentTour(null);
    setCurrentStep(0);
    setIsActive(false);
  };

  const nextStep = () => {
    if (!currentTour) return;

    if (currentStep < currentTour.steps.length - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);

      // Execute step action if defined
      if (currentTour.steps[nextStepIndex]?.action) {
        currentTour.steps[nextStepIndex].action();
      }
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const prevStepIndex = currentStep - 1;
      setCurrentStep(prevStepIndex);

      // Execute step action if defined
      if (currentTour && currentTour.steps[prevStepIndex]?.action) {
        currentTour.steps[prevStepIndex].action();
      }
    }
  };

  const skipTour = () => {
    // Mark as skipped (can be used to not show again)
    if (currentTour) {
      localStorage.setItem(`tour-skipped-${currentTour.id}`, 'true');
    }
    endTour();
  };

  return (
    <TourContext.Provider
      value={{
        currentTour,
        currentStep,
        isActive,
        startTour,
        endTour,
        nextStep,
        prevStep,
        skipTour,
      }}
    >
      {children}
      {isActive && currentTour && <TourOverlay />}
    </TourContext.Provider>
  );
}

function TourOverlay() {
  const { currentTour, currentStep, nextStep, prevStep, skipTour } = useTour();

  if (!currentTour) return null;

  const step = currentTour.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === currentTour.steps.length - 1;
  const progress = ((currentStep + 1) / currentTour.steps.length) * 100;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={skipTour} />

      {/* Tour Card */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md">
        <Card className="shadow-2xl border-2 border-accent">
          <CardContent className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {currentTour.steps.length}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={skipTour}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Content */}
            <div className="py-4">
              <p className="text-sm leading-relaxed">{step.content}</p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="text-muted-foreground"
              >
                Skip Tour
              </Button>

              <div className="flex gap-2">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevStep}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={nextStep}
                >
                  {isLastStep ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Finish
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Helper hook to check if a tour has been completed or skipped
export function useTourStatus(tourId: string): {
  hasCompleted: boolean;
  hasSkipped: boolean;
  shouldShow: boolean;
} {
  const { hasCompleted, hasSkipped } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { hasCompleted: false, hasSkipped: false };
    }
    const completed = localStorage.getItem(`tour-completed-${tourId}`) === 'true';
    const skipped = localStorage.getItem(`tour-skipped-${tourId}`) === 'true';
    return { hasCompleted: completed, hasSkipped: skipped };
  }, [tourId]);

  return {
    hasCompleted,
    hasSkipped,
    shouldShow: !hasCompleted && !hasSkipped,
  };
}

// Helper to mark tour as completed
export function markTourCompleted(tourId: string) {
  localStorage.setItem(`tour-completed-${tourId}`, 'true');
}
