'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore"; 
import { useFirebase } from '../../firebase/client-provider';

interface ProjectData {
  name: string;
  description: string;
  htmlContent: string | null;
  isChunked?: boolean;
  chunkCount?: number;
  sandbox?: string;
  allow?: string;
  legacy?: string[];
}

export default function ProjectPage() {
  const { app } = useFirebase();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !app) {
        setIsLoading(false);
        setError('Project ID is missing or Firebase app is not available.');
        return;
    }
    setIsLoading(true);
    const db = getFirestore(app);
    const projectRef = doc(db, 'projects', projectId);

    getDoc(projectRef).then(async docSnap => {
        if (docSnap.exists()) {
            const data = docSnap.data() as ProjectData;
            if (data.isChunked) {
                const chunksCollectionRef = collection(db, "projects", projectId, "htmlChunks");
                const q = query(chunksCollectionRef, orderBy("order"));
                const querySnapshot = await getDocs(q);
                const chunks = querySnapshot.docs.map(doc => doc.data().content);
                data.htmlContent = chunks.join('');
            }
            setProjectData(data);
        } else {
            setError("No such project!");
        }
    }).catch(e => {
        console.error("Error getting document:", e);
        setError("Failed to load project.");
    }).finally(() => {
        setIsLoading(false);
    });
  }, [projectId, app]);

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading project...</div>;
  }

  if (error) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Error: {error}</div>;
  }

  if (!projectData) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Project not found.</div>;
  }

  const legacyProps = projectData.legacy?.reduce((acc, p) => ({...acc, [p]: 'true'}), {}) || {};

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
        <iframe
            style={{ width: '100%', height: '100%', border: 'none' }}
            srcDoc={projectData.htmlContent || ''}
            sandbox={projectData.sandbox || ''}
            allow={projectData.allow || ''}
            {...legacyProps}
            title={projectData.name}
        />
    </div>
  );
}
