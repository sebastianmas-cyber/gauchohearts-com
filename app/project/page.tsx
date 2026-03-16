import { Suspense } from 'react';
import Project from './project';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Project />
    </Suspense>
  );
}
