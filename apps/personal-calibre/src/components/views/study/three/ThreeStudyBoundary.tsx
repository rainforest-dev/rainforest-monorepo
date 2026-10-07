'use client';

import { Alert, AlertTitle, Button } from '@rainforest-dev/rainforest-react';
import { TriangleAlert } from 'lucide-react';
import { Component, type ReactNode } from 'react';

interface Props {
  onUseCss: () => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ThreeStudyBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert variant="destructive" data-study-error="" className="my-6">
        <TriangleAlert aria-hidden />
        <AlertTitle>Couldn&apos;t start the 3D renderer</AlertTitle>
        <div className="col-start-2 mt-2">
          <Button variant="outline" size="sm" onClick={this.props.onUseCss}>
            Use CSS study
          </Button>
        </div>
      </Alert>
    );
  }
}
