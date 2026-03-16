'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/client';

export default function Project() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const getProject = async () => {
      const docRef = doc(firestore, 'projects', id as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const projectData = docSnap.data();
        const serializableProject: { [key: string]: any } = { id: docSnap.id };

        for (const key in projectData) {
          const value = projectData[key];
          if (value && typeof value.toDate === 'function') {
            serializableProject[key] = value.toDate().toISOString();
          } else {
            serializableProject[key] = value;
          }
        }
        setProject(serializableProject);
      } else {
        setProject(null);
      }
      setIsLoading(false);
    };

    getProject();
  }, [id]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return <div>Project not found.</div>;
  }

  return (
    <iframe
      className="h-full w-full"
      srcDoc={project.htmlContent}
      sandbox="allow-scripts allow-same-origin"
      scrolling="no"
      seamless
    />
  );
}
